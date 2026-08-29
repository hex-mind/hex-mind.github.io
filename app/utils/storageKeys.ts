const STORAGE_PREFIX = 'opencode.';

export const StorageKeys = {
  settings: {
    enterToSend: 'settings.enterToSend.v2',
    suppressAutoWindows: 'settings.suppressAutoWindows.v1',
    theme: 'settings.theme.v1',
  },
  state: {
    sidePanelCollapsed: 'state.sidePanelCollapsed.v1',
    inputPanelCollapsed: 'state.inputPanelCollapsed.v1',
    sidePanelTab: 'state.sidePanelTab.v1',
    lastAuthError: 'state.lastAuthError.v1',
    instanceDirectories: 'state.instanceDirectories.v1',
    pinnedSessions: 'state.pinnedSessions.v1',
  },
  drafts: {
    composer: 'drafts.composer.v1',
    question: 'drafts.question.v1',
  },
  bookmarks: {
    sessions: 'bookmarks.sessions.v1',
  },
  auth: {
    credentials: 'auth.credentials.v1',
  },
} as const;

export function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

export function storageGet(key: string) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(storageKey(key));
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(key), value);
  } catch {
    return;
  }
}

export function storageRemove(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(storageKey(key));
  } catch {
    return;
  }
}

export function storageGetJSON<T>(key: string): T | null {
  const raw = storageGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function storageSetJSON(key: string, value: unknown) {
  storageSet(key, JSON.stringify(value));
}
