import { ref, watch } from 'vue';
import { StorageKeys, storageGetJSON, storageKey, storageSetJSON } from '../utils/storageKeys';

const pinnedSessionIds = ref<string[]>(
  (storageGetJSON<string[]>(StorageKeys.state.pinnedSessions) ?? []).filter(
    (id): id is string => typeof id === 'string' && Boolean(id.trim()),
  ),
);

watch(
  pinnedSessionIds,
  (value) => {
    storageSetJSON(StorageKeys.state.pinnedSessions, value);
  },
  { deep: true },
);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey(StorageKeys.state.pinnedSessions)) return;
    pinnedSessionIds.value = (
      storageGetJSON<string[]>(StorageKeys.state.pinnedSessions) ?? []
    ).filter((id): id is string => typeof id === 'string' && Boolean(id.trim()));
  });
}

export function usePinnedSessions() {
  function isPinned(sessionId: string) {
    const id = sessionId.trim();
    if (!id) return false;
    return pinnedSessionIds.value.includes(id);
  }

  function pinSession(sessionId: string) {
    const id = sessionId.trim();
    if (!id || isPinned(id)) return;
    pinnedSessionIds.value = [id, ...pinnedSessionIds.value];
  }

  function unpinSession(sessionId: string) {
    const id = sessionId.trim();
    if (!id) return;
    pinnedSessionIds.value = pinnedSessionIds.value.filter((entry) => entry !== id);
  }

  function togglePinned(sessionId: string) {
    if (isPinned(sessionId)) {
      unpinSession(sessionId);
      return;
    }
    pinSession(sessionId);
  }

  return {
    pinnedSessionIds,
    isPinned,
    pinSession,
    unpinSession,
    togglePinned,
  };
}
