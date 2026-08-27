import { ref, watch } from 'vue';
import { StorageKeys, storageGet, storageKey, storageSet } from '../utils/storageKeys';

export type UiTheme = 'dark' | 'light';

const enterToSend = ref(storageGet(StorageKeys.settings.enterToSend) === 'true');
const suppressAutoWindows = ref(storageGet(StorageKeys.settings.suppressAutoWindows) === 'true');
const theme = ref<UiTheme>(storageGet(StorageKeys.settings.theme) === 'light' ? 'light' : 'dark');

watch(enterToSend, (value) => {
  storageSet(StorageKeys.settings.enterToSend, String(value));
});

watch(suppressAutoWindows, (value) => {
  storageSet(StorageKeys.settings.suppressAutoWindows, String(value));
});

watch(
  theme,
  (value) => {
    storageSet(StorageKeys.settings.theme, value);
    if (typeof document !== 'undefined') document.documentElement.dataset.theme = value;
  },
  { immediate: true },
);

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey(StorageKeys.settings.enterToSend)) {
      enterToSend.value = event.newValue === 'true';
    }
    if (event.key === storageKey(StorageKeys.settings.suppressAutoWindows)) {
      suppressAutoWindows.value = event.newValue === 'true';
    }
    if (event.key === storageKey(StorageKeys.settings.theme)) {
      theme.value = event.newValue === 'light' ? 'light' : 'dark';
    }
  });
}

export function useSettings() {
  return { enterToSend, suppressAutoWindows, theme };
}
