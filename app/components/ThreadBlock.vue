<template>
  <div
    class="thread-block"
    :class="{ 'is-reverted-preview': isRevertedPreview }"
    :data-thread-id="root.id"
  >
    <button
      v-if="isRevertedPreview"
      type="button"
      class="ib-action ib-action-undo ib-top-right"
      @click="confirmUndoRevert()"
    >
      UNDO
    </button>

    <div class="thread-user" :class="{ 'is-editing': isEditing }">
      <div v-if="root.role === 'user' && isEditing" class="ib-user-editor">
        <textarea
          ref="editTextareaRef"
          v-model="editText"
          class="ib-user-editor-input"
          rows="1"
          aria-label="Edit prompt"
          @input="syncEditTextareaHeight"
          @keydown="handleEditKeydown(root, $event)"
          @paste="handleEditPaste"
          @drop="handleEditDrop"
          @dragover.prevent
          @dragenter.prevent
        ></textarea>
        <input
          ref="editFileInputRef"
          class="ib-user-editor-file"
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          @change="handleEditFileChange"
        />
        <div v-if="editAttachments.length > 0" class="attachment-list">
          <div v-for="item in editAttachments" :key="item.id" class="attachment-item">
            <img
              v-if="item.mime.startsWith('image/')"
              class="attachment-thumb clickable"
              :src="item.dataUrl"
              :alt="item.filename"
              @click="emit('open-image', { url: item.dataUrl, filename: item.filename })"
            />
            <div class="attachment-meta">
              <div class="attachment-name">{{ item.filename }}</div>
              <div class="attachment-type">{{ item.mime }}</div>
            </div>
            <button type="button" class="attachment-remove" @click="removeEditAttachment(item.id)">
              <Icon icon="lucide:x" :width="12" :height="12" />
            </button>
          </div>
        </div>
        <div class="ib-user-editor-footer">
          <div class="ib-user-editor-selects">
            <AgentPicker
              v-model="editMode"
              class="ib-user-editor-agent"
              :options="agentOptions"
              placement="top"
              title="Agent (Tab)"
              :resolve-agent-color="resolveAgentColor"
            />
            <ModelPicker
              v-model="editModel"
              class="ib-user-editor-picker"
              :options="modelOptions"
              placement="top"
              title="Model"
            />
            <Dropdown
              v-model="editThinkingKey"
              class="ib-user-editor-variant"
              button-class="chrome-select-button ib-user-editor-variant-button"
              popup-class="ib-user-editor-variant-popup"
              placement="top"
              menu-icon="lucide:chevron-up"
              auto-close
              title="Variant"
            >
              <template #value="{ value: key }">
                <span :style="editThinkingValueStyle(key)">{{
                  findEditThinkingChoice(key)?.label
                }}</span>
              </template>
              <template #default>
                <div class="ib-user-editor-variant-list">
                  <DropdownItem
                    v-for="option in editThinkingChoices"
                    :key="option.key"
                    :value="option.key"
                  >
                    {{ option.label }}
                  </DropdownItem>
                </div>
              </template>
            </Dropdown>
          </div>
          <div class="ib-user-editor-actions">
            <button
              type="button"
              class="ib-user-editor-button"
              :disabled="!editCanAttach"
              title="Attach"
              @click="triggerEditFileInput"
            >
              <Icon icon="lucide:paperclip" :width="16" :height="16" />
            </button>
            <button
              type="button"
              class="ib-user-editor-button"
              title="Cancel"
              aria-label="Cancel"
              @click="cancelEdit"
            >
              <Icon icon="lucide:x" :width="16" :height="16" />
            </button>
            <button
              type="button"
              class="ib-user-editor-button send"
              :disabled="!canSubmitEdit"
              :title="enterToSend ? 'Enter to send' : 'Ctrl+Enter to send'"
              @click="submitEdit(root)"
            >
              <Icon icon="lucide:send" :width="16" :height="16" />
            </button>
          </div>
        </div>
      </div>
      <template v-else-if="root.role === 'user'">
        <div
          class="ib-msg-block ib-msg-user"
          :class="{ 'ib-msg-user-reverted': isRevertedPreview }"
        >
          <div class="ib-msg-row">
            <MessageViewer
              class="message-viewer-context-user"
              :key="`user-${root.id}`"
              :code="getMessageContent(root)"
              :lang="'markdown'"
              :theme="theme"
              :files="userFileBasenames"
              @rendered="emit('message-rendered', getThreadUserRenderKey(root))"
            />
            <div v-if="getMessageAttachments(root).length > 0" class="output-entry-attachments">
              <img
                v-for="item in getMessageAttachments(root)"
                :key="item.id"
                class="output-entry-attachment clickable"
                :src="item.url"
                :alt="item.filename"
                loading="lazy"
                @click="emit('open-image', { url: item.url, filename: item.filename })"
              />
            </div>
          </div>
        </div>
        <div v-if="root.sessionID" class="ib-user-actions">
          <button
            type="button"
            class="ib-user-action"
            :title="questionCopied ? 'Question copied' : 'Copy question'"
            :aria-label="questionCopied ? 'Question copied' : 'Copy question'"
            @click="copyQuestion(root)"
          >
            <Icon
              :icon="questionCopied ? 'lucide:check' : 'lucide:copy'"
              :width="13"
              :height="13"
            />
          </button>
          <button
            type="button"
            class="ib-user-action"
            title="Edit prompt"
            aria-label="Edit prompt"
            @click="startEdit(root)"
          >
            <Icon icon="lucide:pencil" :width="13" :height="13" />
          </button>
        </div>
      </template>
    </div>

    <ThreadTarget
      v-if="!isRevertedPreview"
      :target="threadTarget"
      :agent-style="threadTargetAgentStyle"
    />

    <div v-if="!isRevertedPreview && hasAssistantMessages(root)" class="thread-assistant">
      <Transition name="ib-fade" mode="out-in">
        <div class="ib-msg-block ib-msg-assistant" :key="deferredTransitionKey">
          <div class="ib-msg-body">
            <MessageViewer class="message-viewer-context-assistant" :html="assistantHtml" />
          </div>
          <div
            v-if="getMessageAttachments(getFinalAnswer(root)).length > 0"
            class="output-entry-attachments"
          >
            <img
              v-for="item in getMessageAttachments(getFinalAnswer(root))"
              :key="item.id"
              class="output-entry-attachment clickable"
              :src="item.url"
              :alt="item.filename"
              loading="lazy"
              @click="emit('open-image', { url: item.url, filename: item.filename })"
            />
          </div>
        </div>
      </Transition>
    </div>

    <div v-if="!isRevertedPreview && getThreadError(root)" class="ib-error-bar">
      <span class="ib-error-icon">⊘</span>
      <span class="ib-error-text">{{ formatMessageError(getThreadError(root)!) }}</span>
    </div>

    <ThreadFooter
      v-if="!isRevertedPreview"
      :timestamp="formatThreadTimestamp(root)"
      :elapsed="formatThreadElapsed(root)"
      :context-percent="showThreadDetails ? getThreadContextPercent(root) : null"
      :tokens="showThreadDetails ? getThreadTokensLabel(root) : ''"
      :has-diffs="hasThreadDiffs(root)"
      :can-copy-answer="canCopyAnswer(root)"
      :copied="copied"
      :history-count="showHistoryButton(root) ? getHistoryEntries(root).length : 0"
      :can-revert="canRevertThread(root)"
      @show-diff="showThreadDiff(root)"
      @copy-answer="copyAnswer(root)"
      @show-history="showThreadHistory(root)"
      @revert="confirmRevert(root)"
    />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, nextTick, onBeforeUnmount, ref, watch, Transition } from 'vue';
import AgentPicker, { type AgentOption } from './AgentPicker.vue';
import Dropdown from './Dropdown.vue';
import DropdownItem from './Dropdown/Item.vue';
import MessageViewer from './MessageViewer.vue';
import ModelPicker from './ModelPicker.vue';
import ThreadFooter from './ThreadFooter.vue';
import ThreadTarget from './ThreadTarget.vue';
import { useFileTree } from '../composables/useFileTree';
import { useMessages } from '../composables/useMessages';
import type {
  HistoryEntry,
  HistoryWindowEntry,
  MessageAttachment,
  MessageDiffEntry,
  MessageTokens,
  MessageUsage,
  ModelMeta,
  ThreadTarget as ThreadTargetType,
} from '../types/message';
import type { MessageInfo, QuestionInfo, ToolPart } from '../types/sse';
import {
  formatElapsedTime,
  formatMessageError,
  formatMessageTime,
  formatTokenCount,
} from '../utils/formatters';
import { confirmAction } from '../composables/useConfirm';
import { useSettings } from '../composables/useSettings';

const HISTORY_TOOL_NAMES = new Set(['bash', 'write', 'edit', 'multiedit', 'apply_patch']);

function fileBasenamesAtSetup(paths: string[]): string[] {
  const set = new Set<string>();
  for (const path of paths) {
    const segments = path.split('/');
    for (let i = 0; i < segments.length; i++) {
      set.add(segments.slice(i).join('/'));
    }
  }
  return Array.from(set);
}

const props = defineProps<{
  root: MessageInfo;
  theme: string;
  isRevertedPreview: boolean;
  modelOptions: Array<{
    id: string;
    modelID: string;
    displayName: string;
    providerID?: string;
    providerLabel?: string;
    variants?: Record<string, unknown>;
    attachmentCapable?: boolean;
  }>;
  selectedModel: string;
  selectedThinking?: string;
  agentOptions: AgentOption[];
  selectedMode: string;
  resolveAgentColor?: (agent?: string) => string;
  resolveModelMeta?: (modelPath?: string) => ModelMeta | undefined;
  computeContextPercent?: (
    tokens: MessageTokens,
    providerId?: string,
    modelId?: string,
  ) => number | null;
  sessionRevert?: {
    messageID: string;
    partID?: string;
    snapshot?: string;
    diff?: string;
  } | null;
  assistantHtml?: string;
  deferredTransitionKey: string;
}>();

const emit = defineEmits<{
  (
    event: 'edit-message',
    payload: {
      sessionId: string;
      messageId: string;
      text: string;
      model: string;
      agent: string;
      variant?: string;
      attachments?: Array<{ filename: string; mime: string; dataUrl: string }>;
    },
  ): void;
  (event: 'revert-message', payload: { sessionId: string; messageId: string }): void;
  (event: 'undo-revert'): void;
  (event: 'show-message-diff', payload: { messageKey: string; diffs: MessageDiffEntry[] }): void;
  (event: 'open-image', payload: { url: string; filename: string }): void;
  (event: 'show-thread-history', payload: { entries: HistoryWindowEntry[] }): void;
  (event: 'message-rendered', renderKey: string): void;
}>();

const msg = useMessages();
const { files } = useFileTree();
const userFileBasenames = fileBasenamesAtSetup(files.value);
const { enterToSend, showThreadDetails } = useSettings();
const copied = ref(false);
const questionCopied = ref(false);
const isEditing = ref(false);
const editText = ref('');
const editModel = ref('');
const editMode = ref('');
const editThinking = ref<string | undefined>(undefined);
type EditThinkingChoice = { key: string; value: string | undefined; label: string };
const editAttachments = ref<Array<{ id: string; filename: string; mime: string; dataUrl: string }>>(
  [],
);
const editTextareaRef = ref<HTMLTextAreaElement | null>(null);
const editFileInputRef = ref<HTMLInputElement | null>(null);
const EDIT_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
let copiedResetTimer: number | undefined;
let questionCopiedResetTimer: number | undefined;

onBeforeUnmount(() => {
  if (copiedResetTimer !== undefined) window.clearTimeout(copiedResetTimer);
  if (questionCopiedResetTimer !== undefined) window.clearTimeout(questionCopiedResetTimer);
});

const threadTarget = computed<ThreadTargetType>(() => buildThreadTarget(props.root));
const threadTargetAgentStyle = computed(() => {
  const color = props.resolveAgentColor
    ? props.resolveAgentColor(threadTarget.value.agent)
    : '#4ade80';
  return { color };
});

function getThread(rootId: string): MessageInfo[] {
  return msg.getThread(rootId);
}

function getFinalAnswer(root: MessageInfo): MessageInfo | undefined {
  return msg.getFinalAnswer(root.id);
}

function hasTextContent(message?: MessageInfo): boolean {
  if (!message) return false;
  return msg.hasTextContent(message.id);
}

function getMessageContent(message?: MessageInfo): string {
  if (!message) return '';
  return msg.getTextContent(message.id);
}

function getMessageAttachments(message?: MessageInfo): MessageAttachment[] {
  if (!message) return [];
  return msg.getImageAttachments(message.id) ?? [];
}

function getMessageError(message?: MessageInfo): { name: string; message: string } | null {
  if (!message) return null;
  return msg.getError(message.id);
}

function getMessageUsage(message?: MessageInfo): MessageUsage | undefined {
  if (!message) return undefined;
  return msg.getUsage(message.id);
}

function getMessageDiffEntries(message?: MessageInfo): MessageDiffEntry[] {
  if (!message) return [];
  return msg.getDiffs(message.id) ?? [];
}

function getMessageModelPath(message?: MessageInfo): string {
  if (!message) return '';
  return msg.getModelPath(message.id) ?? '';
}

function getMessageTime(message?: MessageInfo): number | undefined {
  if (!message) return undefined;
  return msg.getTime(message.id);
}

function getAssistantMessages(root: MessageInfo): MessageInfo[] {
  return getThread(root.id).filter((item) => item.role === 'assistant' && hasTextContent(item));
}

function hasAssistantMessages(root: MessageInfo): boolean {
  return getAssistantMessages(root).length > 0;
}

function getToolPartTime(part: ToolPart): number {
  const state = part.state;
  if (state.status === 'running' || state.status === 'completed' || state.status === 'error') {
    return state.time.start;
  }
  return 0;
}

function extractQuestionInfos(part: ToolPart): QuestionInfo[] {
  const raw = part.state.input?.questions;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (q): q is QuestionInfo =>
      q &&
      typeof q === 'object' &&
      typeof q.question === 'string' &&
      typeof q.header === 'string' &&
      Array.isArray(q.options),
  );
}

function resolveQuestionStatus(part: ToolPart): 'pending' | 'replied' | 'rejected' {
  if (part.state.status === 'completed') return 'replied';
  if (part.state.status === 'error') return 'rejected';
  return 'pending';
}

function extractQuestionAnswers(part: ToolPart): string[][] | undefined {
  if (part.state.status !== 'completed') return undefined;
  const answers = part.state.metadata?.answers;
  if (!Array.isArray(answers)) return undefined;
  return answers as string[][];
}

function getHistoryEntries(root: MessageInfo): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  const thread = getThread(root.id);
  for (const msgInfo of thread) {
    if (msgInfo.role !== 'assistant') continue;
    if (hasTextContent(msgInfo)) {
      entries.push({ kind: 'message', message: msgInfo, time: msgInfo.time.created });
    }
    const parts = msg.getParts(msgInfo.id);
    for (const part of parts) {
      if (part.type === 'reasoning') {
        if (part.text) {
          entries.push({ kind: 'reasoning', part, time: part.time.start });
        }
        continue;
      }
      if (part.type !== 'tool') continue;
      if (part.state.status === 'pending') continue;
      if (part.tool === 'question') {
        entries.push({ kind: 'question', part, time: getToolPartTime(part) });
        continue;
      }
      if (!HISTORY_TOOL_NAMES.has(part.tool)) continue;
      entries.push({ kind: 'tool', part, time: getToolPartTime(part) });
    }
  }
  return entries.sort((a, b) => a.time - b.time);
}

function getHistoryEntryKey(entry: HistoryEntry): string {
  if (entry.kind === 'message') return `msg:${entry.message.id}`;
  if (entry.kind === 'reasoning') return `reasoning:${entry.part.id}`;
  if (entry.kind === 'question') return `question:${entry.part.callID}`;
  return `tool:${entry.part.callID}`;
}

function showHistoryButton(root: MessageInfo): boolean {
  return getHistoryEntries(root).length > 0;
}

function showThreadHistory(root: MessageInfo) {
  const entries = getHistoryEntries(root).map((entry) => {
    if (entry.kind === 'message') {
      return {
        key: getHistoryEntryKey(entry),
        kind: 'message',
        content: getMessageContent(entry.message),
        time: entry.time,
        agent:
          entry.message.role === 'assistant' && 'agent' in entry.message && entry.message.agent
            ? entry.message.agent
            : undefined,
      } satisfies HistoryWindowEntry;
    }
    if (entry.kind === 'reasoning') {
      return {
        key: getHistoryEntryKey(entry),
        kind: 'reasoning',
        part: entry.part,
        time: entry.time,
      } satisfies HistoryWindowEntry;
    }
    if (entry.kind === 'question') {
      return {
        key: getHistoryEntryKey(entry),
        kind: 'question',
        questions: extractQuestionInfos(entry.part),
        status: resolveQuestionStatus(entry.part),
        answers: extractQuestionAnswers(entry.part),
        time: entry.time,
      } satisfies HistoryWindowEntry;
    }
    return {
      key: getHistoryEntryKey(entry),
      kind: 'tool',
      part: entry.part,
      time: entry.time,
    } satisfies HistoryWindowEntry;
  });
  emit('show-thread-history', { entries });
}

function getThreadError(root: MessageInfo): { name: string; message: string } | null {
  const final = getFinalAnswer(root);
  const finalError = getMessageError(final);
  if (finalError) return finalError;
  const thread = getThread(root.id);
  for (let index = thread.length - 1; index >= 0; index--) {
    const error = getMessageError(thread[index]);
    if (error) return error;
  }
  return null;
}

function getThreadDiffs(root: MessageInfo): MessageDiffEntry[] {
  return getMessageDiffEntries(root);
}

function hasThreadDiffs(root: MessageInfo): boolean {
  return getThreadDiffs(root).length > 0;
}

function showThreadDiff(root: MessageInfo) {
  const diffs = getThreadDiffs(root);
  if (diffs.length === 0) return;
  emit('show-message-diff', { messageKey: root.id, diffs });
}

function canRevertThread(root: MessageInfo): boolean {
  if (root.role !== 'user' || !root.sessionID) return false;
  return props.sessionRevert?.messageID !== root.id;
}

function answerTextForThread(root: MessageInfo) {
  return getMessageContent(getFinalAnswer(root));
}

function canCopyAnswer(root: MessageInfo) {
  return answerTextForThread(root).trim().length > 0;
}

async function copyAnswer(root: MessageInfo) {
  const text = answerTextForThread(root);
  if (!text) return;
  await navigator.clipboard.writeText(text);
  copied.value = true;
  if (copiedResetTimer !== undefined) window.clearTimeout(copiedResetTimer);
  copiedResetTimer = window.setTimeout(() => {
    copied.value = false;
    copiedResetTimer = undefined;
  }, 1500);
}

async function confirmRevert(root: MessageInfo) {
  if (root.role !== 'user' || !root.sessionID || !root.id) return;
  const confirmed = await confirmAction({
    title: 'Revert to this message?',
    message: 'This message and later ones in this chat will be hidden until you undo.',
    confirmLabel: 'Revert',
    danger: true,
  });
  if (!confirmed) return;
  emit('revert-message', { sessionId: root.sessionID, messageId: root.id });
}

function syncEditTextareaHeight() {
  const textarea = editTextareaRef.value;
  if (!textarea) return;
  textarea.style.height = '0px';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

const editCanAttach = computed(() => {
  const selected = props.modelOptions.find((model) => model.id === editModel.value);
  return selected?.attachmentCapable !== false;
});

const editThinkingOptions = computed(() => {
  const selected = props.modelOptions.find((model) => model.id === editModel.value);
  const keys = Object.keys(selected?.variants ?? {}).sort();
  return [undefined, ...keys] as Array<string | undefined>;
});

const editThinkingChoices = computed<EditThinkingChoice[]>(() =>
  editThinkingOptions.value.map((option) => ({
    key: option ?? '__default',
    value: option,
    label: option === undefined ? 'default' : option,
  })),
);

const editThinkingKey = computed({
  get: () => {
    const match = editThinkingChoices.value.find((choice) => choice.value === editThinking.value);
    return match?.key ?? '__default';
  },
  set: (key: string) => {
    const choice = editThinkingChoices.value.find((item) => item.key === key);
    editThinking.value = choice?.value;
  },
});

function findEditThinkingChoice(key: unknown): EditThinkingChoice | undefined {
  if (key == null) return undefined;
  return editThinkingChoices.value.find((choice) => choice.key === key);
}

function editThinkingValueStyle(key: unknown) {
  const choice = findEditThinkingChoice(key);
  if (!choice || choice.value === undefined) return undefined;
  return { color: '#f59e0b' };
}

function clampEditThinking() {
  if (!editThinkingOptions.value.includes(editThinking.value)) {
    editThinking.value = undefined;
  }
}

watch([editModel, editThinkingOptions], () => {
  if (!isEditing.value) return;
  clampEditThinking();
});

const canSubmitEdit = computed(
  () => editText.value.trim().length > 0 || editAttachments.value.length > 0,
);

function createEditAttachmentId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `att-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readEditFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File read failed.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('File read failed.'));
    };
    reader.readAsDataURL(file);
  });
}

async function addEditAttachments(files: File[]) {
  const accepted = files.filter((file) => {
    const mime = (file.type || '').toLowerCase();
    if (EDIT_IMAGE_MIMES.has(mime) || mime.startsWith('image/')) return true;
    return /\.(png|jpe?g|gif|webp)$/i.test(file.name || '');
  });
  if (accepted.length === 0) return;
  const next = await Promise.all(
    accepted.map(async (file) => {
      const buffer = await file.arrayBuffer();
      const copy = new File([buffer], file.name || 'image', {
        type: file.type || 'application/octet-stream',
      });
      return {
        id: createEditAttachmentId(),
        filename: copy.name,
        mime: copy.type,
        dataUrl: await readEditFileAsDataUrl(copy),
      };
    }),
  );
  editAttachments.value = [...editAttachments.value, ...next];
}

function removeEditAttachment(id: string) {
  editAttachments.value = editAttachments.value.filter((item) => item.id !== id);
}

function triggerEditFileInput() {
  if (!editCanAttach.value) return;
  editFileInputRef.value?.click();
}

async function handleEditFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const files = input?.files ? Array.from(input.files) : [];
  try {
    if (files.length > 0) await addEditAttachments(files);
  } finally {
    if (input) input.value = '';
  }
}

function handleEditPaste(event: ClipboardEvent) {
  const list = event.clipboardData?.items;
  if (!list) return;
  const files: File[] = [];
  for (const item of Array.from(list)) {
    if (item.kind !== 'file') continue;
    const file = item.getAsFile();
    if (!file) continue;
    const mime = file.type || item.type || '';
    files.push(
      mime && mime !== file.type ? new File([file], file.name || 'image', { type: mime }) : file,
    );
  }
  if (files.length === 0) return;
  event.preventDefault();
  void addEditAttachments(files);
}

function handleEditDrop(event: DragEvent) {
  const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
  if (files.length === 0) return;
  event.preventDefault();
  void addEditAttachments(files);
}

watch(editText, () => {
  if (!isEditing.value) return;
  nextTick(syncEditTextareaHeight);
});

function resolveEditMode(root: MessageInfo) {
  const fromThread = (root.agent ?? getFinalAnswer(root)?.agent)?.trim();
  if (fromThread && props.agentOptions.some((agent) => agent.id === fromThread)) {
    return fromThread;
  }
  return props.selectedMode;
}

function resolveEditModel(root: MessageInfo) {
  if (root.role === 'user') {
    const key = `${root.model.providerID}/${root.model.modelID}`;
    if (props.modelOptions.some((model) => model.id === key)) return key;
  }
  return props.selectedModel;
}

function cycleEditMode(direction: 'next' | 'prev') {
  const options = props.agentOptions.map((agent) => agent.id);
  if (options.length === 0) return false;
  const current = editMode.value || props.selectedMode;
  const index = options.indexOf(current);
  const nextIndex =
    direction === 'next'
      ? index < 0
        ? 0
        : (index + 1) % options.length
      : index < 0
        ? options.length - 1
        : (index - 1 + options.length) % options.length;
  const next = options[nextIndex];
  if (!next) return false;
  editMode.value = next;
  return true;
}

function handleEditKeydown(root: MessageInfo, event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelEdit();
    return;
  }
  if (event.key === 'Enter' && event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    submitEdit(root);
    return;
  }
  if (
    event.key === 'Enter' &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey
  ) {
    if (enterToSend.value) {
      if (!canSubmitEdit.value) return;
      event.preventDefault();
      submitEdit(root);
      return;
    }
  }
  if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    if (!cycleEditMode(event.shiftKey ? 'prev' : 'next')) return;
    event.preventDefault();
  }
}

function startEdit(root: MessageInfo) {
  editText.value = getMessageContent(root);
  editModel.value = resolveEditModel(root);
  editMode.value = resolveEditMode(root);
  editThinking.value = root.variant ?? getFinalAnswer(root)?.variant ?? props.selectedThinking;
  clampEditThinking();
  editAttachments.value = getMessageAttachments(root).map((item) => ({
    id: item.id,
    filename: item.filename,
    mime: item.mime,
    dataUrl: item.url,
  }));
  isEditing.value = true;
  nextTick(() => {
    const textarea = editTextareaRef.value;
    syncEditTextareaHeight();
    textarea?.focus();
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
  });
}

function cancelEdit() {
  isEditing.value = false;
  editText.value = '';
  editModel.value = '';
  editMode.value = '';
  editThinking.value = undefined;
  editAttachments.value = [];
}

function submitEdit(root: MessageInfo) {
  if (root.role !== 'user' || !root.sessionID || !root.id) return;
  const text = editText.value.trim();
  if (!text && editAttachments.value.length === 0) return;
  emit('edit-message', {
    sessionId: root.sessionID,
    messageId: root.id,
    text,
    model: editModel.value || props.selectedModel,
    agent: editMode.value || props.selectedMode,
    variant: editThinking.value,
    attachments: editAttachments.value.map((item) => ({
      filename: item.filename,
      mime: item.mime,
      dataUrl: item.dataUrl,
    })),
  });
  isEditing.value = false;
  editText.value = '';
  editModel.value = '';
  editMode.value = '';
  editThinking.value = undefined;
  editAttachments.value = [];
}

async function copyQuestion(root: MessageInfo) {
  const text = getMessageContent(root);
  if (!text) return;
  await navigator.clipboard.writeText(text);
  questionCopied.value = true;
  if (questionCopiedResetTimer !== undefined) window.clearTimeout(questionCopiedResetTimer);
  questionCopiedResetTimer = window.setTimeout(() => {
    questionCopied.value = false;
    questionCopiedResetTimer = undefined;
  }, 1500);
}

async function confirmUndoRevert() {
  if (!props.sessionRevert) return;
  const confirmed = await confirmAction({
    title: 'Undo revert?',
    message: 'This message and later ones will show again.',
    confirmLabel: 'Undo',
  });
  if (!confirmed) return;
  emit('undo-revert');
}

function buildThreadTarget(root: MessageInfo): ThreadTargetType {
  const final = getFinalAnswer(root);
  const agent = root.agent ?? final?.agent;
  const modelPath = getMessageModelPath(root) || getMessageModelPath(final);
  const modelMeta = props.resolveModelMeta?.(modelPath);
  const variant = root.variant ?? final?.variant;
  return {
    agent,
    modelDisplayName: modelMeta?.displayName,
    providerLabel: modelMeta?.providerLabel,
    variant,
  };
}

function formatThreadTimestamp(root: MessageInfo): string {
  return formatMessageTime(getMessageTime(getFinalAnswer(root)) ?? getMessageTime(root));
}

function getCompletedTime(message?: MessageInfo): number | undefined {
  if (!message) return undefined;
  return msg.getCompletedTime(message.id);
}

function formatThreadElapsed(root: MessageInfo): string {
  const final = getFinalAnswer(root);
  return formatElapsedTime(getMessageTime(root), getCompletedTime(final));
}

function getLastThreadUsage(root: MessageInfo): MessageUsage | undefined {
  const thread = getThread(root.id);
  let lastUsage: MessageUsage | undefined;

  for (const m of thread) {
    if (m.role !== 'assistant') continue;
    const usage = getMessageUsage(m);
    if (usage && (usage.tokens.input > 0 || usage.tokens.output > 0)) {
      lastUsage = usage;
    }
  }
  return lastUsage;
}

function getThreadContextPercent(root: MessageInfo): number | null {
  if (!props.computeContextPercent) return null;
  const lastUsage = getLastThreadUsage(root);

  if (!lastUsage) return null;
  const value = props.computeContextPercent(
    lastUsage.tokens,
    lastUsage.providerId,
    lastUsage.modelId,
  );
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

function getThreadTokensLabel(root: MessageInfo): string {
  const usage = getLastThreadUsage(root);
  if (!usage) return '';
  return `↑${formatTokenCount(usage.tokens.input)} ↓${formatTokenCount(usage.tokens.output)}`;
}

function getThreadUserRenderKey(root: MessageInfo): string {
  return `thread-user:${root.id}`;
}
</script>

<style scoped>
.thread-block {
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 16px 4px;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
}

.thread-block.is-search-target {
  background: rgba(0, 120, 212, 0.12);
  outline: 1px solid rgba(0, 120, 212, 0.35);
  outline-offset: -1px;
}

.thread-block.is-reverted-preview > .thread-user {
  opacity: 0.45;
}

.thread-block.is-reverted-preview > .ib-top-right {
  position: relative;
  z-index: 1;
}

.thread-user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  width: 100%;
  box-sizing: border-box;
}

.thread-user.is-editing {
  align-items: stretch;
}

.ib-msg-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ib-msg-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ib-msg-user {
  width: fit-content;
  max-width: min(85%, 760px);
  font-size: 16px;
  padding: 8px 10px;
  background: #252526;
  border: 1px solid #2b2b2b;
  border-radius: 12px 12px 3px 12px;
}

.ib-msg-user-reverted {
  text-decoration: line-through;
}

.ib-user-actions {
  display: flex;
  gap: 2px;
  margin-top: 3px;
}

.ib-user-action {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ib-user-action:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
}

.ib-user-editor {
  width: 100%;
  padding: 10px;
  border: 1px solid #2b2b2b;
  border-radius: 12px;
  background: #1f1f1f;
  box-sizing: border-box;
}

.ib-user-editor-input {
  width: 100%;
  min-height: 1.5em;
  max-height: min(40vh, 320px);
  padding: 2px 0;
  border: 0;
  outline: 0;
  resize: none;
  overflow-x: hidden;
  overflow-y: auto;
  background: transparent;
  color: #cccccc;
  font: inherit;
  font-size: 16px;
  line-height: 1.5;
  box-sizing: border-box;
}

.ib-user-editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
}

.ib-user-editor-selects {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1 1 auto;
}

.ib-user-editor-agent {
  flex: 0 0 auto;
}

.ib-user-editor-picker {
  min-width: 0;
  max-width: min(220px, 42%);
}

.ib-user-editor-variant {
  min-width: 0;
  flex: 0 1 auto;
}

.ib-user-editor-variant-button {
  height: 28px;
  padding: 4px 8px;
  font-size: 11px;
  font-family: inherit;
}

.ib-user-editor-variant-popup {
  max-height: 280px;
  outline: none;
}

.ib-user-editor-variant-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ib-user-editor-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  flex: 0 0 auto;
}

.ib-user-editor-button {
  background: transparent;
  color: #94a3b8;
  border: 1px solid transparent;
  border-radius: 8px;
  width: 28px;
  height: 28px;
  min-width: 28px;
  padding: 0;
  font: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition:
    background 0.15s,
    color 0.15s;
}

.ib-user-editor-button:hover:not(:disabled) {
  background: rgba(51, 65, 85, 0.35);
  color: #e2e8f0;
}

.ib-user-editor-file {
  display: none;
}

.ib-user-editor .attachment-list {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 6px;
  width: 100%;
  margin-top: 8px;
  padding: 6px 0 0;
  border-top: 1px solid #2b2b2b;
  box-sizing: border-box;
  max-height: 160px;
  overflow: auto;
}

.ib-user-editor .attachment-item {
  display: flex;
  align-items: center;
  flex: 0 1 250px;
  max-width: 250px;
  min-width: 0;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid #2b2b2b;
  background: #181818;
  box-sizing: border-box;
}

.ib-user-editor .attachment-thumb {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid #2b2b2b;
  object-fit: cover;
  background: #1f1f1f;
}

.ib-user-editor .attachment-thumb.clickable {
  cursor: pointer;
}

.ib-user-editor .attachment-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 auto;
  min-width: 0;
}

.ib-user-editor .attachment-name {
  font-size: 12px;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ib-user-editor .attachment-type {
  font-size: 10px;
  color: #94a3b8;
}

.ib-user-editor .attachment-remove {
  background: #252526;
  color: #cccccc;
  border: 1px solid #2b2b2b;
  border-radius: 6px;
  padding: 4px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ib-user-editor-button.send {
  color: #60a5fa;
}

.ib-user-editor-button.send:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.35);
  color: #93bbfd;
}

.ib-user-editor-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .ib-user-editor-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .ib-user-editor-picker,
  .ib-user-editor-agent,
  .ib-user-editor-variant {
    max-width: none;
    width: 100%;
  }
}

.ib-msg-assistant {
  margin-top: 4px;
}

.thread-assistant {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  padding: 6px 2px 0;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.ib-msg-body {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 16px;
  --message-line-height: 1.65;
  line-height: var(--message-line-height);
  padding-top: 3px;
  padding-left: 6px;
}

.ib-top-right {
  float: right;
  margin: -2px -2px 4px 8px;
}

.ib-action {
  border: 1px solid #2b2b2b;
  border-radius: 6px;
  background: #1f1f1f;
  color: #cccccc;
  font-size: 10px;
  line-height: 1;
  padding: 3px 7px;
  cursor: pointer;
  white-space: nowrap;
}

.ib-action:hover {
  background: #2b2b2b;
}

.ib-action-undo {
  border-color: #3c3c3c;
  background: #252526;
  color: #cccccc;
}

.ib-action-undo:hover {
  background: #2b2b2b;
}

.ib-error-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(127, 29, 29, 0.3);
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: #fca5a5;
  font-size: 11px;
  line-height: 1.3;
}

.ib-error-icon {
  flex-shrink: 0;
  font-size: 13px;
  color: #f87171;
}

.ib-error-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ib-fade-enter-active,
.ib-fade-leave-active {
  transition: opacity 0.3s ease;
}

.ib-fade-enter-from,
.ib-fade-leave-to {
  opacity: 0;
}

.output-entry-attachments {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 6px;
  margin-top: 6px;
}

.output-entry-attachment {
  width: 100%;
  max-height: 180px;
  border-radius: 8px;
  border: 1px solid #2b2b2b;
  object-fit: cover;
  background: #1f1f1f;
}

.output-entry-attachment.clickable {
  cursor: pointer;
}
</style>
