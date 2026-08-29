import { ref, watch } from 'vue';
import { StorageKeys, storageGetJSON, storageKey, storageSetJSON } from '../utils/storageKeys';

export type BookmarkedSession = {
  sessionId: string;
  projectId: string;
  worktree: string;
  directory: string;
  title: string;
  branch?: string;
  projectName?: string;
  savedAt: number;
};

const bookmarks = ref<BookmarkedSession[]>(
  storageGetJSON<BookmarkedSession[]>(StorageKeys.bookmarks.sessions) ?? [],
);

watch(
  bookmarks,
  (value) => {
    storageSetJSON(StorageKeys.bookmarks.sessions, value);
  },
  { deep: true },
);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== storageKey(StorageKeys.bookmarks.sessions)) return;
    bookmarks.value = storageGetJSON<BookmarkedSession[]>(StorageKeys.bookmarks.sessions) ?? [];
  });
}

export function useBookmarkedSessions() {
  function isBookmarked(sessionId: string) {
    const id = sessionId.trim();
    if (!id) return false;
    return bookmarks.value.some((entry) => entry.sessionId === id);
  }

  function addBookmark(entry: BookmarkedSession) {
    const sessionId = entry.sessionId.trim();
    if (!sessionId) return;
    if (isBookmarked(sessionId)) return;
    bookmarks.value = [...bookmarks.value, { ...entry, sessionId }];
  }

  function removeBookmark(sessionId: string) {
    const id = sessionId.trim();
    if (!id) return;
    bookmarks.value = bookmarks.value.filter((entry) => entry.sessionId !== id);
  }

  function toggleBookmark(entry: BookmarkedSession) {
    if (isBookmarked(entry.sessionId)) {
      removeBookmark(entry.sessionId);
      return;
    }
    addBookmark(entry);
  }

  return {
    bookmarks,
    isBookmarked,
    removeBookmark,
    toggleBookmark,
  };
}
