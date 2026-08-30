<template>
  <div class="question-window">
    <div class="question-header">
      <div class="question-title">Question request</div>
      <div class="question-type">{{ request.questions.length }} item(s)</div>
    </div>

    <div class="question-summary">
      <div class="question-row">
        <div class="question-label">Session</div>
        <div class="question-value">{{ request.sessionID }}</div>
      </div>
      <div v-if="request.tool" class="question-row">
        <div class="question-label">Tool</div>
        <div class="question-value">
          message {{ request.tool.messageID }}
          <span class="divider">/</span>
          call {{ request.tool.callID }}
        </div>
      </div>
    </div>

    <div class="question-body">
      <div v-if="contextText" class="context-text-area">
        <MessageViewer :code="contextText" lang="markdown" theme="github-dark" />
      </div>

      <div
        v-for="(item, index) in request.questions"
        :key="`${request.id}-${index}-${item.header}`"
        class="question-section"
      >
        <div class="section-head">
          <div class="section-title">{{ item.header }}</div>
          <div class="section-mode">{{ item.multiple ? 'Multiple' : 'Single' }}</div>
        </div>
        <div class="section-question">{{ item.question }}</div>

        <div class="option-list">
          <button
            v-for="option in item.options"
            :key="option.label"
            type="button"
            class="option-item"
            :class="{ selected: isSelected(index, option.label) }"
            :disabled="isSubmitting"
            @click="toggleOption(index, option.label, !!item.multiple)"
          >
            <span class="option-label">{{ option.label }}</span>
            <span class="option-description">{{ option.description }}</span>
          </button>
        </div>

        <div v-if="item.custom !== false" class="custom-answer">
          <textarea
            class="custom-input"
            rows="3"
            :value="customAnswers[index] ?? ''"
            :disabled="isSubmitting"
            placeholder="Type your own answer"
            @input="updateCustom(index, $event)"
          ></textarea>
        </div>
      </div>

      <div v-if="error" class="question-error">{{ error }}</div>
    </div>

    <div class="question-actions">
      <button
        type="button"
        class="question-button is-reject"
        :disabled="isSubmitting"
        @click="emitReject"
      >
        Reject
      </button>
      <button
        type="button"
        class="question-button is-reply"
        :disabled="isSubmitting || !canReply"
        @click="emitReply"
      >
        Reply
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import MessageViewer from '../MessageViewer.vue';
import { StorageKeys, storageGetJSON, storageSetJSON } from '../../utils/storageKeys';

type QuestionOption = {
  label: string;
  description: string;
};

type QuestionInfo = {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
};

type QuestionRequest = {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
  tool?: {
    messageID: string;
    callID: string;
  };
};

type QuestionDraft = {
  selectedAnswers: string[][];
  customAnswers: string[];
};

const props = defineProps<{
  request: QuestionRequest;
  contextText?: string;
  isSubmitting?: boolean;
  error?: string;
}>();

const emit = defineEmits<{
  (event: 'reply', payload: { requestId: string; answers: string[][] }): void;
  (event: 'reject', requestId: string): void;
}>();

const selectedAnswers = ref<string[][]>([]);
const customAnswers = ref<string[]>([]);

// --- Draft save / restore ---

function draftStorageKey(): string {
  return StorageKeys.drafts.question;
}

function loadAllDrafts(): Record<string, QuestionDraft> {
  return storageGetJSON<Record<string, QuestionDraft>>(draftStorageKey()) ?? {};
}

function saveDraft() {
  const all = loadAllDrafts();
  all[props.request.id] = {
    selectedAnswers: selectedAnswers.value,
    customAnswers: customAnswers.value,
  };
  storageSetJSON(draftStorageKey(), all);
}

function clearDraft() {
  const all = loadAllDrafts();
  delete all[props.request.id];
  storageSetJSON(draftStorageKey(), all);
}

function restoreDraft(): boolean {
  const all = loadAllDrafts();
  const draft = all[props.request.id];
  if (!draft) return false;
  if (
    Array.isArray(draft.selectedAnswers) &&
    draft.selectedAnswers.length === props.request.questions.length
  ) {
    selectedAnswers.value = draft.selectedAnswers;
  }
  if (
    Array.isArray(draft.customAnswers) &&
    draft.customAnswers.length === props.request.questions.length
  ) {
    customAnswers.value = draft.customAnswers;
  }
  return true;
}

let draftTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleDraftSave() {
  if (draftTimer !== null) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    draftTimer = null;
    saveDraft();
  }, 400);
}

onBeforeUnmount(() => {
  if (draftTimer !== null) {
    clearTimeout(draftTimer);
    saveDraft();
  }
});

// --- Answers ---

function resetAnswers() {
  selectedAnswers.value = props.request.questions.map(() => []);
  customAnswers.value = props.request.questions.map(() => '');
  if (!restoreDraft()) return;
}

watch(
  () => props.request.id,
  () => {
    resetAnswers();
  },
  { immediate: true },
);

function isSelected(index: number, label: string) {
  return selectedAnswers.value[index]?.includes(label) ?? false;
}

function toggleOption(index: number, label: string, multiple: boolean) {
  const current = selectedAnswers.value[index] ?? [];
  if (multiple) {
    if (current.includes(label)) {
      selectedAnswers.value[index] = current.filter((value) => value !== label);
      scheduleDraftSave();
      return;
    }
    selectedAnswers.value[index] = [...current, label];
    scheduleDraftSave();
    return;
  }
  if (current.includes(label)) {
    selectedAnswers.value[index] = [];
    scheduleDraftSave();
    return;
  }
  selectedAnswers.value[index] = [label];
  scheduleDraftSave();
}

function updateCustom(index: number, event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLTextAreaElement)) return;
  customAnswers.value[index] = target.value;
  scheduleDraftSave();
}

function buildAnswers() {
  return props.request.questions.map((item, index) => {
    const selected = selectedAnswers.value[index] ?? [];
    const custom = item.custom === false ? '' : (customAnswers.value[index] ?? '').trim();
    const values = custom ? [...selected, custom] : [...selected];
    return Array.from(new Set(values));
  });
}

const canReply = computed(() => buildAnswers().every((answer) => answer.length > 0));

function emitReply() {
  if (!canReply.value) return;
  clearDraft();
  emit('reply', {
    requestId: props.request.id,
    answers: buildAnswers(),
  });
}

function emitReject() {
  clearDraft();
  emit('reject', props.request.id);
}
</script>

<style scoped>
.question-window {
  --q-accent: var(--window-color, #4b7cec);
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 8px;
  height: 100%;
  min-height: 0;
  padding: 8px;
  box-sizing: border-box;
  color: #e2e8f0;
  font-size: 12px;
}

.question-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.question-title {
  font-size: 13px;
  font-weight: 700;
}

.question-type {
  font-size: 11px;
  color: color-mix(in srgb, var(--q-accent) 70%, #e2e8f0);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.question-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
  border: 1px solid color-mix(in srgb, var(--q-accent) 32%, transparent);
  border-radius: 8px;
  padding: 6px 8px;
  background: color-mix(in srgb, var(--q-accent) 10%, rgba(20, 22, 28, 0.55));
}

.question-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}

.question-label {
  color: color-mix(in srgb, var(--q-accent) 55%, #cccccc);
  font-size: 11px;
}

.question-value {
  color: #e2e8f0;
  font-size: 11px;
  word-break: break-all;
}

.divider {
  margin: 0 4px;
  color: color-mix(in srgb, var(--q-accent) 70%, #94a3b8);
}

.question-body {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.context-text-area {
  border: 1px solid color-mix(in srgb, var(--q-accent) 24%, transparent);
  border-radius: 8px;
  padding: 8px;
  background: color-mix(in srgb, var(--q-accent) 8%, rgba(20, 22, 28, 0.45));
  font-size: 12px;
  line-height: 1.4;
}

.question-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--q-accent) 28%, transparent);
  border-radius: 8px;
  padding: 8px;
  background: color-mix(in srgb, var(--q-accent) 8%, rgba(20, 22, 28, 0.55));
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.section-title {
  color: color-mix(in srgb, var(--q-accent) 35%, #e2e8f0);
  font-size: 12px;
  font-weight: 700;
}

.section-mode {
  color: color-mix(in srgb, var(--q-accent) 60%, #cccccc);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.section-question {
  color: #d4d4d8;
  font-size: 11px;
  line-height: 1.35;
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.option-item {
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--q-accent) 30%, transparent);
  background: color-mix(in srgb, var(--q-accent) 8%, rgba(20, 22, 28, 0.4));
  color: #e2e8f0;
  padding: 6px 8px;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
}

.option-item.selected {
  border-color: color-mix(in srgb, var(--q-accent) 80%, transparent);
  background: color-mix(in srgb, var(--q-accent) 22%, rgba(20, 22, 28, 0.55));
}

.option-item:disabled {
  opacity: 0.65;
  cursor: wait;
}

.option-label {
  font-size: 11px;
  font-weight: 600;
}

.option-description {
  font-size: 10px;
  color: #94a3b8;
}

.custom-answer {
  display: flex;
}

.custom-input {
  width: 100%;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--q-accent) 35%, transparent);
  background: color-mix(in srgb, var(--q-accent) 10%, rgba(20, 22, 28, 0.6));
  color: #e2e8f0;
  font-size: 11px;
  padding: 6px 8px;
  min-height: 3em;
  resize: vertical;
  font-family: inherit;
  line-height: 1.4;
  box-sizing: border-box;
  outline: none;
}

.custom-input:focus {
  border-color: color-mix(in srgb, var(--q-accent) 70%, transparent);
}

.question-error {
  color: #fecaca;
  font-size: 11px;
}

.question-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  border-top: 1px solid color-mix(in srgb, var(--q-accent) 28%, transparent);
  padding-top: 8px;
}

.question-button {
  border-radius: 8px;
  padding: 6px 10px;
  border: 1px solid color-mix(in srgb, var(--q-accent) 40%, #2b2b2b);
  background: #1f1f1f;
  color: #e2e8f0;
  font-size: 11px;
  cursor: pointer;
}

.question-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.question-button.is-reject {
  border-color: rgba(248, 113, 113, 0.6);
  background: rgba(127, 29, 29, 0.35);
}

.question-button.is-reply {
  border-color: color-mix(in srgb, var(--q-accent) 70%, transparent);
  background: color-mix(in srgb, var(--q-accent) 26%, rgba(20, 22, 28, 0.8));
}

html[data-theme='light'] .question-window {
  color: #2f2f2f;
}

html[data-theme='light'] .question-type {
  color: color-mix(in srgb, var(--q-accent) 40%, #6b7280);
}

html[data-theme='light'] .question-summary,
html[data-theme='light'] .context-text-area,
html[data-theme='light'] .question-section {
  background: color-mix(in srgb, var(--q-accent) 6%, #f7f7f8);
  border-color: color-mix(in srgb, var(--q-accent) 20%, #e5e7eb);
}

html[data-theme='light'] .question-label,
html[data-theme='light'] .section-mode,
html[data-theme='light'] .divider {
  color: color-mix(in srgb, var(--q-accent) 45%, #6b7280);
}

html[data-theme='light'] .question-value,
html[data-theme='light'] .section-title,
html[data-theme='light'] .section-question {
  color: #2f2f2f;
}

html[data-theme='light'] .option-item {
  background: #ffffff;
  border-color: color-mix(in srgb, var(--q-accent) 16%, #e5e7eb);
  color: #2f2f2f;
}

html[data-theme='light'] .option-item.selected {
  background: color-mix(in srgb, var(--q-accent) 10%, #ffffff);
  border-color: color-mix(in srgb, var(--q-accent) 50%, #c7d2fe);
}

html[data-theme='light'] .option-description {
  color: #6b7280;
}

html[data-theme='light'] .custom-input {
  background: #ffffff;
  border-color: color-mix(in srgb, var(--q-accent) 18%, #d1d5db);
  color: #2f2f2f;
}

html[data-theme='light'] .custom-input:focus {
  border-color: color-mix(in srgb, var(--q-accent) 50%, #93c5fd);
}

html[data-theme='light'] .custom-input::placeholder {
  color: #9ca3af;
}

html[data-theme='light'] .question-actions {
  border-top-color: #e5e7eb;
}

html[data-theme='light'] .question-error {
  color: #b91c1c;
}
</style>
