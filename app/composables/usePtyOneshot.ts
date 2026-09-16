import type { Ref } from 'vue';
import * as opencodeApi from '../utils/opencode';
import { GIT_PAGER_ENV, buildOneShotPtySpawn, PTY_ONESHOT_EXIT_PREFIX, stripPtyNoise } from '../utils/gitStatus';

type UsePtyOneshotOptions = {
  activeDirectory: Ref<string>;
};

type PtyInfo = {
  id: string;
};

const PTY_ONESHOT_TIMEOUT_MS = 30000;
const PTY_ONESHOT_COLS = 500;
const PTY_ONESHOT_ROWS = 40;

let boundOptions: UsePtyOneshotOptions | null = null;

function parsePtyInfo(value: unknown): PtyInfo | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : '';
  if (!id) return null;
  return { id };
}

function getOptions() {
  if (!boundOptions) {
    throw new Error('usePtyOneshot must be initialized with options before use');
  }
  return boundOptions;
}

function init(options: UsePtyOneshotOptions) {
  if (boundOptions) return;
  boundOptions = options;
}

function isCursorMetaBytes(bytes: Uint8Array) {
  if (bytes.length === 0 || bytes[0] !== 0) return false;
  const payload = new TextDecoder().decode(bytes.subarray(1));
  const trimmed = payload.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  try {
    const meta = JSON.parse(trimmed) as Record<string, unknown>;
    return (
      Object.keys(meta).length === 1 &&
      typeof meta.cursor === 'number' &&
      Number.isSafeInteger(meta.cursor) &&
      meta.cursor >= 0
    );
  } catch {
    return false;
  }
}

function isCursorMetaString(value: string) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
  try {
    const meta = JSON.parse(trimmed) as Record<string, unknown>;
    return (
      Object.keys(meta).length === 1 &&
      typeof meta.cursor === 'number' &&
      Number.isSafeInteger(meta.cursor) &&
      meta.cursor >= 0
    );
  } catch {
    return false;
  }
}

function isPtyAlreadyGone(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /request failed \(404\)/i.test(message);
}

function extractOneShotExitCode(output: string): { output: string; exitCode: number | null } {
  const normalized = output.replace(/\r/g, '');
  const lines = normalized.split('\n');
  const index = lines.findIndex((line) => line.trim().startsWith(PTY_ONESHOT_EXIT_PREFIX));
  if (index < 0) return { output: normalized, exitCode: null };

  const line = lines[index]?.trim() ?? '';
  const rawExitCode = line.slice(PTY_ONESHOT_EXIT_PREFIX.length).trim();
  const exitCode = Number.parseInt(rawExitCode, 10);
  if (!Number.isFinite(exitCode)) {
    return { output: normalized, exitCode: null };
  }

  return {
    output: lines.slice(0, index).join('\n'),
    exitCode,
  };
}

async function runOneShotPtyCommand(command: string, args: string[]): Promise<string> {
  const { activeDirectory } = getOptions();
  const directory = activeDirectory.value || undefined;
  const spawn = buildOneShotPtySpawn(directory, command, args);
  const data = await opencodeApi.createPty({
    directory,
    command: spawn.command,
    args: spawn.args,
    cwd: directory,
    title: 'One-shot PTY',
    env: GIT_PAGER_ENV,
  });
  const pty = parsePtyInfo(data);
  if (!pty) {
    throw new Error('failed to create PTY command session');
  }

  void opencodeApi
    .updatePtySize(pty.id, {
      directory,
      rows: PTY_ONESHOT_ROWS,
      cols: PTY_ONESHOT_COLS,
    })
    .catch(() => {});

  return new Promise<string>((resolve, reject) => {
    const url = opencodeApi.createWsUrl(`/pty/${pty.id}/connect`, { directory });
    const socket = new WebSocket(url);
    const decoder = new TextDecoder();
    let captured = '';
    let settled = false;

    const finish = (output: string) => stripPtyNoise(output);

    const closeSocket = () => {
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };

    const settle = (handler: () => void, killPty = false) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      handler();
      // Command already finished (or the socket already dropped): OpenCode has
      // removed the session. DELETE 404s in DevTools even if we swallow the error.
      if (!killPty) {
        closeSocket();
        return;
      }
      void opencodeApi
        .deletePty(pty.id, directory)
        .catch((error) => {
          if (isPtyAlreadyGone(error)) return;
          console.error('[pty-oneshot] failed to delete PTY:', pty.id, error);
        })
        .finally(() => {
          closeSocket();
        });
    };

    const resolveIfComplete = () => {
      const parsed = extractOneShotExitCode(captured);
      if (parsed.exitCode === null) return false;
      if (parsed.exitCode !== 0) {
        console.error(
          `[pty-oneshot] command exited with non-zero code ${parsed.exitCode}:`,
          command,
          args,
        );
      }
      settle(() => resolve(finish(parsed.output)));
      return true;
    };

    const timeoutId = setTimeout(() => {
      console.error('[pty-oneshot] command timed out:', command, args);
      settle(() => reject(new Error('PTY command timed out')), true);
    }, PTY_ONESHOT_TIMEOUT_MS);

    socket.binaryType = 'arraybuffer';
    socket.addEventListener('open', () => {
      if (socket.readyState !== WebSocket.OPEN) return;
      if (spawn.command === 'env') socket.send('\n');
    });
    socket.addEventListener('message', (event) => {
      if (event.data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(event.data);
        if (isCursorMetaBytes(bytes)) return;
        captured += decoder.decode(bytes, { stream: true });
        resolveIfComplete();
        return;
      }
      if (typeof event.data !== 'string') return;
      if (isCursorMetaString(event.data)) return;
      captured += event.data;
      resolveIfComplete();
    });
    socket.addEventListener('close', () => {
      settle(() => {
        captured += decoder.decode();
        const parsed = extractOneShotExitCode(captured);
        if (parsed.exitCode !== null && parsed.exitCode !== 0) {
          console.error(
            `[pty-oneshot] command exited with non-zero code ${parsed.exitCode}:`,
            command,
            args,
          );
        }
        resolve(finish(parsed.output));
      });
    });
    socket.addEventListener('error', () => {
      console.error('[pty-oneshot] command socket error:', command, args);
      settle(() => reject(new Error('PTY command socket failed')), true);
    });
  });
}

export function usePtyOneshot(options?: UsePtyOneshotOptions) {
  if (options) init(options);
  getOptions();
  return {
    runOneShotPtyCommand,
  };
}
