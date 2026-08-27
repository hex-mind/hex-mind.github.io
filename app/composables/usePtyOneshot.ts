import type { Ref } from 'vue';
import * as opencodeApi from '../utils/opencode';

type UsePtyOneshotOptions = {
  activeDirectory: Ref<string>;
};

type PtyInfo = {
  id: string;
};

const PTY_ONESHOT_TIMEOUT_MS = 30000;
const PTY_ONESHOT_EXIT_PREFIX = '__OPENCODE_PTY_EXIT_CODE__:';

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

function extractOneShotExitCode(output: string): { output: string; exitCode: number | null } {
  const normalized = output.replace(/\r/g, '');
  const lines = normalized.split('\n');
  let index = lines.length - 1;

  while (index >= 0 && !lines[index]?.trim()) {
    index -= 1;
  }

  if (index < 0) return { output: normalized, exitCode: null };

  const line = lines[index]?.trim() ?? '';
  if (!line.startsWith(PTY_ONESHOT_EXIT_PREFIX)) {
    return { output: normalized, exitCode: null };
  }

  const rawExitCode = line.slice(PTY_ONESHOT_EXIT_PREFIX.length).trim();
  const exitCode = Number.parseInt(rawExitCode, 10);
  if (!Number.isFinite(exitCode)) {
    return { output: normalized, exitCode: null };
  }

  lines.splice(index, 1);
  return {
    output: lines.join('\n'),
    exitCode,
  };
}

async function runOneShotPtyCommand(command: string, args: string[]): Promise<string> {
  const { activeDirectory } = getOptions();
  const directory = activeDirectory.value || undefined;
  const data = await opencodeApi.createPty({
    directory,
    command: 'env',
    args: [
      'bash',
      '--noprofile',
      '--norc',
      '-c',
      `stty -echo 2>/dev/null; read -r -t 1 _ || true; "$@"; code=$?; printf '\n${PTY_ONESHOT_EXIT_PREFIX}%s\n' "$code"; exit "$code"`,
      '_',
      command,
      ...args,
    ],
    cwd: directory,
    title: 'One-shot PTY',
  });
  const pty = parsePtyInfo(data);
  if (!pty) {
    throw new Error('failed to create PTY command session');
  }

  return new Promise<string>((resolve, reject) => {
    const url = opencodeApi.createWsUrl(`/pty/${pty.id}/connect`, { directory });
    const socket = new WebSocket(url);
    const decoder = new TextDecoder();
    let captured = '';
    let settled = false;

    const settle = (handler: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      handler();
    };

    const timeoutId = setTimeout(() => {
      console.error('[pty-oneshot] command timed out:', command, args);
      settle(() => reject(new Error('PTY command timed out')));
      socket.close();
    }, PTY_ONESHOT_TIMEOUT_MS);

    socket.binaryType = 'arraybuffer';
    socket.addEventListener('open', () => {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send('\n');
    });
    socket.addEventListener('message', (event) => {
      if (event.data instanceof ArrayBuffer) {
        const bytes = new Uint8Array(event.data);
        if (isCursorMetaBytes(bytes)) return;
        captured += decoder.decode(bytes, { stream: true });
        return;
      }
      if (typeof event.data !== 'string') return;
      if (isCursorMetaString(event.data)) return;
      captured += event.data;
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
        resolve(parsed.output);
      });
    });
    socket.addEventListener('error', () => {
      console.error('[pty-oneshot] command socket error:', command, args);
      settle(() => reject(new Error('PTY command socket failed')));
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
