<template>
  <dialog
    ref="dialogRef"
    class="confirm-dialog"
    @cancel.prevent="resolve(false)"
    @click.self="resolve(false)"
  >
    <div v-if="request" class="confirm-card" @click.stop>
      <div class="confirm-title">{{ request.title }}</div>
      <p v-if="request.message" class="confirm-message">{{ request.message }}</p>
      <div class="confirm-actions">
        <button ref="cancelRef" type="button" class="confirm-btn is-cancel" @click="resolve(false)">
          {{ request.cancelLabel || 'Cancel' }}
        </button>
        <button
          ref="confirmRef"
          type="button"
          class="confirm-btn is-confirm"
          :class="{ 'is-danger': request.danger }"
          @click="resolve(true)"
        >
          {{ request.confirmLabel || 'Confirm' }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { registerConfirmDialog, type ConfirmRequest } from '../composables/useConfirm';

const dialogRef = ref<HTMLDialogElement | null>(null);
const cancelRef = ref<HTMLButtonElement | null>(null);
const confirmRef = ref<HTMLButtonElement | null>(null);
const request = ref<ConfirmRequest | null>(null);

let pending: ((value: boolean) => void) | null = null;

function resolve(value: boolean) {
  const finish = pending;
  pending = null;
  request.value = null;
  dialogRef.value?.close();
  finish?.(value);
}

async function prompt(next: ConfirmRequest): Promise<boolean> {
  if (pending) resolve(false);
  request.value = next;
  await nextTick();
  const el = dialogRef.value;
  if (!el) return false;
  if (!el.open) el.showModal();
  await nextTick();
  (next.danger ? cancelRef.value : confirmRef.value)?.focus();
  return new Promise((done) => {
    pending = done;
  });
}

onMounted(() => {
  registerConfirmDialog(prompt);
});

onBeforeUnmount(() => {
  registerConfirmDialog(null);
  if (pending) resolve(false);
});
</script>

<style scoped>
.confirm-dialog {
  margin: auto;
  border: 0;
  padding: 0;
  background: transparent;
  max-width: calc(100vw - 32px);
}

.confirm-dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
}

.confirm-card {
  width: min(400px, calc(100vw - 32px));
  padding: 20px 20px 16px;
  border-radius: 12px;
  background: #1f1f1f;
  border: 1px solid #2b2b2b;
  color: #e8e8e8;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
}

.confirm-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.35;
}

.confirm-message {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: #9d9d9d;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}

.confirm-btn {
  border: 0;
  border-radius: 8px;
  padding: 7px 13px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.confirm-btn.is-cancel {
  background: transparent;
  color: #9d9d9d;
}

.confirm-btn.is-cancel:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #e8e8e8;
}

.confirm-btn.is-confirm {
  background: #ececec;
  color: #111111;
}

.confirm-btn.is-confirm:hover {
  background: #ffffff;
}

.confirm-btn.is-danger {
  background: #dc2626;
  color: #ffffff;
}

.confirm-btn.is-danger:hover {
  background: #ef4444;
}

html[data-theme='light'] .confirm-dialog::backdrop {
  background: rgba(15, 15, 15, 0.28);
}

html[data-theme='light'] .confirm-card {
  background: #ffffff;
  border-color: #e5e7eb;
  color: #111827;
  box-shadow: 0 16px 40px rgba(15, 15, 15, 0.1);
}

html[data-theme='light'] .confirm-message {
  color: #6b7280;
}

html[data-theme='light'] .confirm-btn.is-cancel {
  color: #6b7280;
}

html[data-theme='light'] .confirm-btn.is-cancel:hover {
  background: #f3f4f6;
  color: #111827;
}

html[data-theme='light'] .confirm-btn.is-confirm {
  background: #111827;
  color: #ffffff;
}

html[data-theme='light'] .confirm-btn.is-confirm:hover {
  background: #1f2937;
}

html[data-theme='light'] .confirm-btn.is-danger {
  background: #dc2626;
  color: #ffffff;
}

html[data-theme='light'] .confirm-btn.is-danger:hover {
  background: #ef4444;
}
</style>
