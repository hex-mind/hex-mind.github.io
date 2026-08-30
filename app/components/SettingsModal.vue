<template>
  <dialog
    ref="dialogRef"
    class="modal-backdrop"
    @close="$emit('close')"
    @cancel.prevent
    @click.self="dialogRef?.close()"
  >
    <div class="modal">
      <header class="modal-header">
        <div class="modal-title">Settings</div>
        <button type="button" class="modal-close-button" @click="dialogRef?.close()">
          <Icon icon="lucide:x" :width="14" :height="14" />
        </button>
      </header>
      <div class="modal-body">
        <div class="setting-row">
          <div class="setting-label">Theme</div>
          <div class="theme-options" role="radiogroup" aria-label="Theme">
            <button
              type="button"
              class="theme-option"
              :class="{ 'is-active': theme === 'dark' }"
              role="radio"
              :aria-checked="theme === 'dark'"
              @click="theme = 'dark'"
            >
              <Icon icon="lucide:moon" :width="14" :height="14" />
              Dark
            </button>
            <button
              type="button"
              class="theme-option"
              :class="{ 'is-active': theme === 'light' }"
              role="radio"
              :aria-checked="theme === 'light'"
              @click="theme = 'light'"
            >
              <Icon icon="lucide:sun" :width="14" :height="14" />
              Light
            </button>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-label">Ctrl + Enter to send</div>
          <label class="toggle-switch">
            <input v-model="ctrlEnterToSend" type="checkbox" class="toggle-input" />
            <span class="toggle-track" />
          </label>
        </div>
        <div class="setting-row">
          <div class="setting-label">GitHub</div>
          <a
            class="setting-link"
            href="https://github.com/hex-mind/hex-mind.github.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon icon="lucide:github" :width="14" :height="14" />
            hex-mind
          </a>
        </div>
        <div class="setting-row setting-row-stack">
          <div class="setting-label">Feedback</div>
          <div class="setting-feedback">
            <span>
              Discord
              <span class="setting-handle">dreamingasfish</span>
            </span>
            <span>
              Email
              <a class="setting-handle" href="mailto:rve@foxmail.com">rve@foxmail.com</a>
            </span>
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-label">Account</div>
          <button type="button" class="setting-link setting-logout" @click="$emit('logout')">
            <Icon icon="lucide:log-out" :width="14" :height="14" />
            Logout
          </button>
        </div>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useSettings } from '../composables/useSettings';

const props = defineProps<{
  open: boolean;
}>();

defineEmits<{
  (event: 'close'): void;
  (event: 'logout'): void;
}>();

const dialogRef = ref<HTMLDialogElement | null>(null);
const { enterToSend, theme } = useSettings();
const ctrlEnterToSend = computed({
  get: () => !enterToSend.value,
  set: (value: boolean) => {
    enterToSend.value = !value;
  },
});

watch(
  () => props.open,
  (open) => {
    const el = dialogRef.value;
    if (!el) return;
    if (open) {
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  },
);
</script>

<style scoped>
.modal-backdrop {
  border: none;
  padding: 0;
  margin: 0;
  background: transparent;
  color: inherit;
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-backdrop:not([open]) {
  display: none;
}

.modal-backdrop::backdrop {
  background: rgba(0, 0, 0, 0.55);
}

.modal {
  width: min(480px, 95vw);
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: #1f1f1f;
  border: 1px solid #2b2b2b;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  color: #cccccc;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.modal-title {
  font-size: 14px;
  font-weight: 600;
}

.modal-close-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid #2b2b2b;
  border-radius: 6px;
  background: transparent;
  color: #9d9d9d;
  cursor: pointer;
}

.modal-close-button:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #cccccc;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
}

.setting-label {
  font-size: 13px;
  font-weight: 500;
  color: #cccccc;
}

.setting-row-stack {
  align-items: flex-start;
}

.setting-link,
.setting-logout {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: #5ba3f5;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}

.setting-link:hover,
.setting-logout:hover {
  color: #7eb6f7;
}

.setting-feedback {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  font-size: 12px;
  color: #9d9d9d;
}

.setting-handle {
  color: #5ba3f5;
  font-weight: 600;
  user-select: all;
  text-decoration: none;
}

.theme-options {
  flex: 0 0 auto;
  display: inline-flex;
  gap: 3px;
  padding: 3px;
  border: 1px solid #2b2b2b;
  border-radius: 8px;
  background: #1f1f1f;
}

.theme-option {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #9d9d9d;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}

.theme-option:hover {
  color: #cccccc;
}

.theme-option.is-active {
  background: rgba(255, 255, 255, 0.12);
  color: #f3f3f3;
}

.toggle-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  cursor: pointer;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-track {
  width: 36px;
  height: 20px;
  background: #3c3c3c;
  border-radius: 10px;
  position: relative;
  transition: background 0.2s;
}

.toggle-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: #94a3b8;
  border-radius: 50%;
  transition:
    transform 0.2s,
    background 0.2s;
}

.toggle-input:checked + .toggle-track {
  background: #0078d4;
}

.toggle-input:checked + .toggle-track::after {
  transform: translateX(16px);
  background: #fff;
}

@media (max-width: 480px) {
  .setting-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .setting-feedback {
    align-items: flex-start;
  }
}
</style>
