import { ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import PermissionContent from '../components/ToolWindow/Permission.vue';
import * as opencodeApi from '../utils/opencode';
import type { useFloatingWindows } from './useFloatingWindows';

export type PermissionRequest = {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
  tool?: {
    messageID: string;
    callID: string;
  };
};

export type PermissionReply = 'once' | 'always' | 'reject';

const PERMISSION_WINDOW_WIDTH = 760;
const PERMISSION_WINDOW_HEIGHT = 340;

export function usePermissions(options: {
  fw: ReturnType<typeof useFloatingWindows>;
  allowedSessionIds: ComputedRef<Set<string>>;
  activeDirectory: Ref<string>;
  ensureConnectionReady: (action: string) => boolean;
}) {
  const permissionSendingById = ref<Record<string, boolean>>({});
  const permissionErrorById = ref<Record<string, string>>({});

  function parsePermissionRequest(
    value: unknown,
    fallbackSessionId?: string,
  ): PermissionRequest | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const id =
      (typeof record.id === 'string' && record.id) ||
      (typeof record.permissionID === 'string' && record.permissionID) ||
      (typeof record.requestID === 'string' && record.requestID)
        ? String(record.id ?? record.permissionID ?? record.requestID)
        : undefined;
    const sessionID =
      (typeof record.sessionID === 'string' && record.sessionID) ||
      (typeof record.sessionId === 'string' && record.sessionId) ||
      (typeof record.session_id === 'string' && record.session_id) ||
      fallbackSessionId;
    const permission =
      (typeof record.permission === 'string' && record.permission) ||
      (typeof record.type === 'string' && record.type) ||
      (typeof record.title === 'string' && record.title)
        ? String(record.permission ?? record.type ?? record.title)
        : undefined;
    const patterns: string[] = [];
    if (Array.isArray(record.patterns)) {
      patterns.push(...record.patterns.filter((entry) => typeof entry === 'string'));
    }
    const patternValue = record.pattern;
    if (typeof patternValue === 'string') {
      patterns.push(patternValue);
    } else if (Array.isArray(patternValue)) {
      patterns.push(...patternValue.filter((entry) => typeof entry === 'string'));
    }
    const always = Array.isArray(record.always)
      ? record.always.filter((entry) => typeof entry === 'string')
      : [];
    const metadata =
      record.metadata && typeof record.metadata === 'object'
        ? (record.metadata as Record<string, unknown>)
        : {};
    const toolRaw =
      record.tool && typeof record.tool === 'object'
        ? (record.tool as Record<string, unknown>)
        : null;
    const toolMessageId =
      (typeof record.messageID === 'string' && record.messageID) ||
      (toolRaw && typeof toolRaw.messageID === 'string' ? toolRaw.messageID : undefined);
    const toolCallId =
      (typeof record.callID === 'string' && record.callID) ||
      (typeof record.callId === 'string' && record.callId) ||
      (toolRaw && typeof toolRaw.callID === 'string' ? toolRaw.callID : undefined);
    if (!id || !sessionID || !permission) return null;
    const tool =
      toolMessageId && toolCallId ? { messageID: toolMessageId, callID: toolCallId } : undefined;
    return {
      id,
      sessionID,
      permission,
      patterns,
      metadata,
      always,
      tool,
    };
  }

  function setPermissionSending(requestId: string, value: boolean) {
    const next = { ...permissionSendingById.value };
    if (value) next[requestId] = true;
    else delete next[requestId];
    permissionSendingById.value = next;
  }

  function clearPermissionSending(requestId: string) {
    setPermissionSending(requestId, false);
  }

  function setPermissionError(requestId: string, message: string) {
    const next = { ...permissionErrorById.value };
    if (message) next[requestId] = message;
    else delete next[requestId];
    permissionErrorById.value = next;
  }

  function clearPermissionError(requestId: string) {
    setPermissionError(requestId, '');
  }

  function isPermissionSubmitting(requestId: string): boolean {
    return Boolean(permissionSendingById.value[requestId]);
  }

  function getPermissionError(requestId: string): string {
    return permissionErrorById.value[requestId] ?? '';
  }

  function isPermissionSessionAllowed(request: PermissionRequest): boolean {
    const allowed = options.allowedSessionIds.value;
    if (!request.sessionID) return false;
    if (allowed.size === 0) return false;
    return allowed.has(request.sessionID);
  }

  function upsertPermissionEntry(request: PermissionRequest) {
    const key = `permission:${request.id}`;
    options.fw.open(key, {
      component: PermissionContent,
      props: {
        request,
        isSubmitting: isPermissionSubmitting(request.id),
        error: getPermissionError(request.id),
        onReply: handlePermissionReply,
      },
      closable: false,
      resizable: false,
      scroll: 'manual',
      color: '#f59e0b',
      title: `Permission: ${request.permission || 'request'}`,
      width: PERMISSION_WINDOW_WIDTH,
      height: PERMISSION_WINDOW_HEIGHT,
      expiry: Infinity,
    });
  }

  function refreshPermissionWindow(requestId: string) {
    const key = `permission:${requestId}`;
    const entry = options.fw.get(key);
    if (!entry) return;
    options.fw.updateOptions(key, {
      props: {
        ...entry.props,
        isSubmitting: isPermissionSubmitting(requestId),
        error: getPermissionError(requestId),
      },
    });
  }

  function removePermissionEntry(requestId: string) {
    options.fw.close(`permission:${requestId}`);
    clearPermissionSending(requestId);
    clearPermissionError(requestId);
  }

  function prunePermissionEntries() {
    const allowed = options.allowedSessionIds.value;
    for (const entry of options.fw.entries.value) {
      if (!entry.key.startsWith('permission:')) continue;
      const request = entry.props?.request as PermissionRequest | undefined;
      if (!request) continue;
      if (!allowed.has(request.sessionID)) {
        removePermissionEntry(request.id);
      }
    }
  }

  async function sendPermissionReply(requestId: string, reply: PermissionReply) {
    if (!options.ensureConnectionReady('Permission reply')) return;
    const directory = options.activeDirectory.value.trim();
    await opencodeApi.replyPermission(requestId, {
      directory: directory || undefined,
      reply,
    });
  }

  async function handlePermissionReply(payload: { requestId: string; reply: PermissionReply }) {
    if (!options.ensureConnectionReady('Permission reply')) return;
    const { requestId, reply } = payload;
    if (isPermissionSubmitting(requestId)) return;
    clearPermissionError(requestId);
    setPermissionSending(requestId, true);
    refreshPermissionWindow(requestId);
    try {
      await sendPermissionReply(requestId, reply);
      removePermissionEntry(requestId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setPermissionError(requestId, errorMessage);
      refreshPermissionWindow(requestId);
    } finally {
      clearPermissionSending(requestId);
      refreshPermissionWindow(requestId);
    }
  }

  async function fetchPendingPermissions(directory?: string) {
    try {
      const data = await opencodeApi.listPendingPermissions(directory);
      if (!Array.isArray(data)) return;
      data
        .map((entry) => parsePermissionRequest(entry))
        .filter((entry): entry is PermissionRequest => Boolean(entry))
        .filter((entry) => isPermissionSessionAllowed(entry))
        .forEach((entry) => {
          upsertPermissionEntry(entry);
        });
    } catch {
      // Empty catch block - intentionally ignore errors
    }
  }

  return {
    parsePermissionRequest,
    upsertPermissionEntry,
    removePermissionEntry,
    prunePermissionEntries,
    handlePermissionReply,
    isPermissionSessionAllowed,
    fetchPendingPermissions,
  };
}
