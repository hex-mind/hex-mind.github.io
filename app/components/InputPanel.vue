<template>
  <div class="input-panel">
    <div class="history-dropdown-wrapper">
      <Dropdown
        ref="historyDropdownRef"
        v-model:open="historyOpen"
        auto-close
        placement="top"
        popup-class="history-popup"
        @select="handleHistorySelect"
      >
        <template #trigger><span /></template>
        <template #default>
          <div class="dropdown-list">
            <DropdownItem v-for="(entry, i) in userHistory" :key="i" :value="entry">
              <div class="history-item" :style="historyEntryStyle(entry)" :title="entry.text">
                <div class="history-item-text">{{ entry.text }}</div>
                <div v-if="hasHistoryEntryTarget(entry)" class="history-item-target">
                  <span
                    v-if="entry.agent"
                    class="history-target-agent"
                    :style="historyEntryAgentStyle(entry)"
                  >
                    {{ entry.agent }}
                  </span>
                  <span v-if="historyEntryModelDisplayName(entry)" class="history-target-model">
                    {{ historyEntryModelDisplayName(entry) }}
                  </span>
                  <span v-if="historyEntryProviderLabel(entry)" class="history-target-provider">
                    {{ historyEntryProviderLabel(entry) }}
                  </span>
                  <span v-if="entry.variant" class="history-target-separator">&middot;</span>
                  <span v-if="entry.variant" class="history-target-variant">{{
                    entry.variant
                  }}</span>
                </div>
              </div>
            </DropdownItem>
          </div>
        </template>
      </Dropdown>
    </div>
    <div class="input-message">
      <textarea
        ref="textareaRef"
        v-model="messageValue"
        class="input-textarea"
        :disabled="false"
        placeholder="Send a message..."
        @keydown="handleKeydown"
        @paste="handlePaste"
        @drop="handleDrop"
        @dragover.prevent
        @dragenter.prevent
      ></textarea>
      <input
        ref="fileInputRef"
        class="file-input"
        type="file"
        :accept="acceptMime"
        multiple
        @change="handleFileChange"
      />
      <div v-if="attachments.length > 0" class="attachment-list">
        <div v-for="item in attachments" :key="item.id" class="attachment-item">
          <img
            v-if="item.mime.startsWith('image/')"
            class="attachment-thumb clickable"
            :src="item.dataUrl"
            :alt="item.filename"
            @click="$emit('open-image', { url: item.dataUrl, filename: item.filename })"
          />
          <div class="attachment-meta">
            <div class="attachment-name">{{ item.filename }}</div>
            <div class="attachment-type">{{ item.mime }}</div>
          </div>
          <button
            type="button"
            class="attachment-remove"
            @click="$emit('remove-attachment', item.id)"
          >
            <Icon icon="lucide:x" :width="12" :height="12" />
          </button>
        </div>
      </div>
      <div class="command-dropdown-wrapper">
        <Dropdown
          ref="commandDropdownRef"
          :open="commandPopupOpen"
          :auto-close="false"
          :auto-focus="false"
          :auto-highlight="true"
          placement="top"
          popup-class="input-dropdown-popup command-popup"
          @select="handleCommandSelect"
        >
          <template #trigger><span /></template>
          <template #default>
            <div class="dropdown-list">
              <DropdownItem
                v-for="command in commandMatches"
                :key="command.name"
                :value="command.name"
              >
                <div class="command-dropdown-item">
                  <div class="command-name">/{{ command.name }}</div>
                  <div v-if="command.description" class="command-desc">
                    {{ command.description }}
                  </div>
                </div>
              </DropdownItem>
            </div>
          </template>
        </Dropdown>
      </div>
      <div class="input-toolbar">
        <div class="input-selects">
          <div class="input-field compact">
            <AgentPicker
              v-model="modeValue"
              :options="agentOptions"
              :disabled="props.disabled || !hasAgentOptions"
              placement="top"
              title="Agent (Tab)"
              :resolve-agent-color="props.resolveAgentColor"
              @update:open="handleModelDropdownOpenChange"
            />
          </div>
        </div>
        <div class="input-field compact">
          <div ref="modelDropdownRef" class="input-dropdown-root">
            <ModelPicker
              v-model="modelValue"
              :options="modelOptions"
              :disabled="props.disabled || !hasModelOptions"
              placement="top"
              title="Model (Ctrl-M)"
              @update:open="handleModelDropdownOpenChange"
            />
          </div>
        </div>
        <div class="input-field compact">
          <Dropdown
            v-model="thinkingKeyValue"
            :placeholder="hasThinkingOptions ? 'Select variant' : 'Loading...'"
            :disabled="props.disabled || !hasThinkingOptions"
            button-class="chrome-select-button input-dropdown-button"
            popup-class="input-dropdown-popup"
            placement="top"
            menu-icon="lucide:chevron-up"
            auto-close
            title="Variant (Ctrl-, / Ctrl-.)"
            @update:open="handleModelDropdownOpenChange"
          >
            <template #value="{ value: key }">
              <span :style="thinkingValueStyle(key)">{{ findThinkingChoice(key)?.label }}</span>
            </template>
            <template #default>
              <div class="dropdown-list">
                <div v-if="!hasThinkingOptions" class="dropdown-empty">Loading...</div>
                <DropdownItem
                  v-for="option in thinkingChoices"
                  :key="option.key"
                  :value="option.key"
                >
                  <span class="dropdown-item-label">{{ option.label }}</span>
                </DropdownItem>
              </div>
            </template>
          </Dropdown>
        </div>
        <div class="input-actions">
          <button
            type="button"
            class="input-button suppress-button"
            :class="{ active: suppressAutoWindows }"
            :title="suppressAutoWindows ? 'Unhide reasoning' : 'Hide reasoning'"
            @click="suppressAutoWindows = !suppressAutoWindows"
          >
            <Icon
              :icon="suppressAutoWindows ? 'lucide:eye-off' : 'lucide:eye'"
              :width="16"
              :height="16"
            />
          </button>
          <button
            type="button"
            class="input-button bookmark-button"
            :class="{ active: props.isSessionSaved }"
            title="Save session"
            :disabled="props.disabled"
            @click="$emit('toggle-save-session')"
          >
            <Icon icon="lucide:bookmark" :width="16" :height="16" />
          </button>
          <button
            type="button"
            class="input-button attach-button"
            :disabled="props.disabled || props.canAttach === false"
            title="Attach"
            @click="triggerFileInput"
          >
            <Icon icon="lucide:paperclip" :width="16" :height="16" />
          </button>
          <button
            v-if="isThinking"
            type="button"
            class="input-button stop send-button"
            :disabled="props.disabled || !canAbort"
            title="Stop (ESC x2)"
            @click="$emit('abort')"
          >
            <Icon icon="ph:stop-fill" :width="16" :height="16" />
          </button>
          <button
            v-else
            type="button"
            class="input-button primary send-button"
            :disabled="props.disabled || !canSend"
            :title="sendTooltip"
            @click="$emit('send')"
          >
            <Icon icon="lucide:send" :width="16" :height="16" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import Dropdown from './Dropdown.vue';
import DropdownItem from './Dropdown/Item.vue';
import AgentPicker from './AgentPicker.vue';
import ModelPicker from './ModelPicker.vue';
import { useMessages } from '../composables/useMessages';
import { useSettings } from '../composables/useSettings';
type ModelOption = {
  id: string;
  modelID: string;
  label: string;
  displayName: string;
  providerID?: string;
  providerLabel?: string;
};
type CommandOption = { name: string; description?: string; hints?: string[] };
type AgentOption = { id: string; label: string; description?: string; color?: string };
type ThinkingChoice = { key: string; value: string | undefined; label: string };

const props = defineProps<{
  messageInput: string;
  canSend: boolean;
  selectedMode: string;
  agentOptions: AgentOption[];
  hasAgentOptions: boolean;
  selectedModel: string;
  selectedThinking: string | undefined;
  modelOptions: ModelOption[];
  thinkingOptions: Array<string | undefined>;
  hasModelOptions: boolean;
  hasThinkingOptions: boolean;
  canAttach?: boolean;
  isThinking: boolean;
  canAbort: boolean;
  commands: CommandOption[];
  attachments: Array<{ id: string; filename: string; mime: string; dataUrl: string }>;
  agentColor?: string;
  resolveAgentColor?: (agent?: string) => string;
  disabled?: boolean;
  isSessionSaved?: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:message-input', value: string): void;
  (event: 'update:selected-mode', value: string): void;
  (event: 'update:selected-model', value: string): void;
  (event: 'update:selected-thinking', value: string | undefined): void;
  (
    event: 'apply-history-entry',
    payload: {
      text: string;
      agent?: string;
      model?: string;
      variant?: string;
    },
  ): void;
  (event: 'send'): void;
  (event: 'toggle-save-session'): void;
  (event: 'abort'): void;
  (event: 'add-attachments', files: File[]): void;
  (event: 'remove-attachment', id: string): void;
  (event: 'open-image', payload: { url: string; filename: string }): void;
}>();

const messageValue = computed({
  get: () => props.messageInput,
  set: (value) => emit('update:message-input', value),
});

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const modelDropdownRef = ref<HTMLElement | null>(null);
const acceptMime = 'image/png,image/jpeg,image/gif,image/webp';

const { enterToSend, suppressAutoWindows } = useSettings();

// --- Input history navigation ---
const { roots: messageRoots, getTextContent } = useMessages();
const historyOpen = ref(false);

type DropdownRef = {
  moveHighlight: (direction: 'up' | 'down') => void;
  selectHighlighted: () => boolean;
  clearHighlight: () => void;
};

const historyDropdownRef = ref<DropdownRef | null>(null);
const commandDropdownRef = ref<DropdownRef | null>(null);

type HistoryEntry = {
  text: string;
  agent?: string;
  agentColor?: string;
  model?: string;
  variant?: string;
};

function findAgentOption(id: string | undefined) {
  if (!id) return undefined;
  return props.agentOptions.find((option) => option.id === id);
}

function historyEntryColor(entry: HistoryEntry) {
  return (
    entry.agentColor ||
    props.resolveAgentColor?.(entry.agent) ||
    findAgentOption(entry.agent)?.color
  );
}

function historyEntryStyle(entry: HistoryEntry) {
  const color = historyEntryColor(entry);
  return { borderLeftColor: color ? `${color}99` : '#334155' };
}

function historyEntryAgentStyle(entry: HistoryEntry) {
  const color = historyEntryColor(entry);
  return color ? { color } : undefined;
}

function historyEntryModelDisplayName(entry: HistoryEntry) {
  if (!entry.model) return undefined;
  return findModelOption(entry.model)?.displayName;
}

function historyEntryProviderLabel(entry: HistoryEntry) {
  if (!entry.model) return undefined;
  return findModelOption(entry.model)?.providerLabel;
}

function hasHistoryEntryTarget(entry: HistoryEntry) {
  return Boolean(
    entry.agent ||
    historyEntryModelDisplayName(entry) ||
    historyEntryProviderLabel(entry) ||
    entry.variant,
  );
}

const userHistory = computed(() => {
  const result: HistoryEntry[] = [];
  for (const msg of messageRoots.value) {
    if (msg.role !== 'user') continue;
    const text = getTextContent(msg.id);
    if (!text) continue;
    const agent = 'agent' in msg ? (msg.agent as string | undefined) : undefined;
    const agentOption = agent ? props.agentOptions.find((a) => a.id === agent) : undefined;
    const resolvedAgentColor = props.resolveAgentColor?.(agent);
    const model = msg.model ? `${msg.model.providerID}/${msg.model.modelID}` : undefined;
    const variant = msg.variant;
    result.push({
      text,
      agent,
      agentColor: agentOption?.color || resolvedAgentColor,
      model,
      variant,
    });
  }
  return result;
});

function applyHistoryEntry(entry: HistoryEntry) {
  emit('apply-history-entry', {
    text: entry.text,
    agent: entry.agent,
    model: entry.model,
    variant: entry.variant,
  });
  nextTick(() => textareaRef.value?.focus());
}

function toHistoryEntry(value: unknown): HistoryEntry | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.text !== 'string') return null;
  const entry: HistoryEntry = { text: candidate.text };
  if (typeof candidate.agent === 'string') entry.agent = candidate.agent;
  if (typeof candidate.agentColor === 'string') entry.agentColor = candidate.agentColor;
  if (typeof candidate.model === 'string') entry.model = candidate.model;
  if (typeof candidate.variant === 'string') entry.variant = candidate.variant;
  return entry;
}

function handleHistorySelect(entry: unknown) {
  const value = toHistoryEntry(entry);
  if (!value) return;
  applyHistoryEntry(value);
}

watch(historyOpen, (open) => {
  if (open) {
    nextTick(() => historyDropdownRef.value?.moveHighlight('up'));
  } else {
    nextTick(() => textareaRef.value?.focus());
  }
});

const sendTooltip = computed(() => (enterToSend.value ? 'Enter to send' : 'Ctrl+Enter to send'));

const slashQuery = computed(() => {
  const value = messageValue.value;
  if (!value.startsWith('/')) return '';
  const trimmed = value.slice(1);
  const match = trimmed.match(/^(\S*)/);
  return match?.[1] ?? '';
});

const commandMatches = computed(() => {
  if (!messageValue.value.startsWith('/')) return [];
  if (/\s/.test(messageValue.value.slice(1))) return [];
  const query = slashQuery.value.trim().toLowerCase();
  const list = props.commands ?? [];
  const matches = list.filter((command) => command.name.toLowerCase().startsWith(query));
  const limit = 8;
  return matches.slice(0, limit);
});

const commandPopupDismissed = ref(false);

const commandPopupOpen = computed(
  () => !commandPopupDismissed.value && commandMatches.value.length > 0,
);
watch(
  () => messageValue.value,
  () => {
    commandPopupDismissed.value = false;
  },
);

function handleCommandSelect(name: unknown) {
  if (typeof name === 'string') applyCommandSelection(name);
}

function applyCommandSelection(name: string) {
  messageValue.value = `/${name} `;
  nextTick(() => textareaRef.value?.focus());
}

function extractSlashCommand(value: string) {
  if (!value.startsWith('/')) return '';
  const trimmed = value.slice(1);
  const match = trimmed.match(/^(\S+)/);
  return match?.[1] ?? '';
}

function hasMatchingCommand(name: string) {
  if (!name) return false;
  return (props.commands ?? []).some(
    (command) => command.name.toLowerCase() === name.toLowerCase(),
  );
}

function nextCyclicIndex(current: string | undefined, options: Array<string | undefined>) {
  if (options.length === 0) return -1;
  const index = options.indexOf(current);
  if (index < 0) return 0;
  return (index + 1) % options.length;
}

function prevCyclicIndex(current: string | undefined, options: Array<string | undefined>) {
  if (options.length === 0) return -1;
  const index = options.indexOf(current);
  if (index < 0) return options.length - 1;
  return (index - 1 + options.length) % options.length;
}

function cycleAgent(direction: 'next' | 'prev') {
  if (!props.hasAgentOptions) return false;
  const options = (props.agentOptions ?? []).map((option) => option.id);
  const nextIndex =
    direction === 'next'
      ? nextCyclicIndex(props.selectedMode, options)
      : prevCyclicIndex(props.selectedMode, options);
  if (nextIndex < 0) return false;
  emit('update:selected-mode', options[nextIndex]!);
  return true;
}

function cycleVariant(direction: 'next' | 'prev') {
  if (!props.hasThinkingOptions) return false;
  const options = props.thinkingOptions ?? [];
  const nextIndex =
    direction === 'next'
      ? nextCyclicIndex(props.selectedThinking, options)
      : prevCyclicIndex(props.selectedThinking, options);
  if (nextIndex < 0) return false;
  emit('update:selected-thinking', options[nextIndex]!);
  return true;
}

function openModelPicker() {
  if (!props.hasModelOptions) return false;
  const root = modelDropdownRef.value;
  if (!root) return false;
  const button = root.querySelector('button');
  if (!(button instanceof HTMLButtonElement)) return false;
  button.focus({ preventScroll: true });
  button.click();
  return true;
}

function handleModelDropdownOpenChange(open: boolean) {
  if (!open) {
    nextTick(() => {
      textareaRef.value?.focus({ preventScroll: true });
    });
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (commandPopupOpen.value) {
    if (event.key === 'Escape') {
      event.preventDefault();
      commandPopupDismissed.value = true;
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      commandDropdownRef.value?.moveHighlight('down');
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      commandDropdownRef.value?.moveHighlight('up');
      return;
    }
    if (
      event.key === 'Tab' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      commandDropdownRef.value?.selectHighlighted();
      return;
    }
    if (
      event.key === 'Enter' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      commandDropdownRef.value?.selectHighlighted();
    }
    return;
  }
  // --- Input history: open dropdown when ArrowUp on empty input ---
  if (
    event.key === 'ArrowUp' &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.shiftKey &&
    messageValue.value === '' &&
    userHistory.value.length > 0
  ) {
    event.preventDefault();
    historyOpen.value = true;
    return;
  }
  if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const direction: 'next' | 'prev' = event.shiftKey ? 'prev' : 'next';
    if (!cycleAgent(direction)) return;
    event.preventDefault();
    return;
  }
  if (event.ctrlKey && !event.metaKey && !event.altKey && event.key === '.') {
    if (!cycleVariant('next')) return;
    event.preventDefault();
    return;
  }
  if (event.ctrlKey && !event.metaKey && !event.altKey && event.key === ',') {
    if (!cycleVariant('prev')) return;
    event.preventDefault();
    return;
  }
  if (event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'm') {
    if (!openModelPicker()) return;
    event.preventDefault();
    return;
  }
  // Ctrl+Enter: always send
  if (event.key === 'Enter' && event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    emit('send');
    return;
  }
  // Enter (no modifiers): send or newline depending on setting
  if (
    event.key === 'Enter' &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    !event.altKey
  ) {
    if (enterToSend.value) {
      event.preventDefault();
      emit('send');
      return;
    }
    // Default: send only for recognized slash commands
    if (messageValue.value.startsWith('/')) {
      const commandName = extractSlashCommand(messageValue.value);
      if (hasMatchingCommand(commandName)) {
        event.preventDefault();
        emit('send');
      }
    }
  }
}

function triggerFileInput() {
  fileInputRef.value?.click();
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement | null;
  const files = input?.files ? Array.from(input.files) : [];
  if (files.length > 0) emit('add-attachments', files);
  if (input) input.value = '';
  nextTick(() => {
    textareaRef.value?.focus();
  });
}

function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items ? Array.from(event.clipboardData.items) : [];
  if (items.length === 0) return;
  const files = items
    .filter((item) => item.kind === 'file')
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
  if (files.length === 0) return;
  event.preventDefault();
  emit('add-attachments', files);
}

function handleDrop(event: DragEvent) {
  const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
  if (files.length === 0) return;
  event.preventDefault();
  emit('add-attachments', files);
}

const modeValue = computed({
  get: () => props.selectedMode,
  set: (value) => emit('update:selected-mode', value),
});

const modelValue = computed({
  get: () => props.selectedModel,
  set: (value) => emit('update:selected-model', value),
});

function findModelOption(id: unknown): ModelOption | undefined {
  if (id == null) return undefined;
  return (props.modelOptions ?? []).find((m) => m.id === id);
}

const thinkingChoices = computed<ThinkingChoice[]>(() =>
  (props.thinkingOptions ?? []).map((option) => ({
    key: option ?? '__default',
    value: option,
    label: option === undefined ? 'default' : option,
  })),
);

const selectedThinkingChoice = computed<ThinkingChoice | undefined>(() =>
  thinkingChoices.value.find((option) => option.value === props.selectedThinking),
);

const thinkingKeyValue = computed({
  get: () => selectedThinkingChoice.value?.key,
  set: (key: string) => {
    const choice = thinkingChoices.value.find((c) => c.key === key);
    emit('update:selected-thinking', choice?.value);
  },
});

function findThinkingChoice(key: unknown): ThinkingChoice | undefined {
  if (key == null) return undefined;
  return thinkingChoices.value.find((c) => c.key === key);
}

function thinkingValueStyle(key: unknown) {
  const choice = findThinkingChoice(key);
  if (!choice || choice.value === undefined) return undefined;
  return { color: '#f59e0b' };
}

function focus() {
  textareaRef.value?.focus();
}

function reset() {
  historyOpen.value = false;
}

defineExpose({ focus, reset });
</script>

<style scoped>
.input-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  color: #e2e8f0;
  font-family: var(--font-sans);
}

.input-message {
  width: 100%;
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  overflow: visible;
  background: #222226;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--composer-radius, 16px);
  box-sizing: border-box;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.32);
}

.input-message:has(.input-textarea:disabled) {
  opacity: 0.6;
}

.input-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 0 8px 8px;
  border-top: 0;
  flex: 0 0 auto;
}

.input-selects {
  display: flex;
  flex: 0 1 auto;
  min-width: 0;
  gap: 4px;
  flex-wrap: wrap;
  align-items: center;
}

.input-selects .input-control {
  height: 28px;
}

.input-dropdown-root {
  width: 100%;
}

.input-field {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.input-field.compact {
  flex: 0 0 auto;
  min-width: 0;
}

:deep(.input-control) {
  width: 100%;
  background: transparent;
  color: #94a3b8;
  border: 0;
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 11px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition:
    background 0.15s,
    color 0.15s;
}

:deep(.input-control):hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
}

:deep(.input-control):focus-visible {
  outline: none;
}

:deep(.input-dropdown-button) {
  height: 28px;
}

:deep(.input-dropdown-popup) {
  max-height: 280px;
  outline: none;
}

.dropdown-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dropdown-empty {
  padding: 6px 8px;
  font-size: 12px;
  color: #94a3b8;
}

.dropdown-item-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.input-textarea:disabled {
  opacity: 0.6;
}

.input-textarea {
  resize: none;
  min-height: 1em;
  font-size: 16px;
  line-height: 1.5;
  display: block;
  width: 100%;
  flex: 1 1 auto;
  height: auto;
  position: relative;
  z-index: 1;
  border: none;
  border-radius: inherit;
  background: transparent;
  color: #e2e8f0;
  outline: none;
  padding: 12px 16px 6px;
  box-sizing: border-box;
  font-family: inherit;
}

.file-input {
  display: none;
}

.attachment-list {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 6px;
  width: 100%;
  padding: 6px 8px 8px;
  border-top: 1px solid #2b2b2b;
  box-sizing: border-box;
  max-height: 45%;
  overflow: auto;
  flex: 0 0 auto;
}

.attachment-item {
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

.attachment-thumb {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid #2b2b2b;
  object-fit: cover;
  background: #1f1f1f;
}

.attachment-thumb.clickable {
  cursor: pointer;
}

.attachment-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 auto;
  min-width: 0;
}

.attachment-name {
  font-size: 12px;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.attachment-type {
  font-size: 10px;
  color: #94a3b8;
}

.attachment-remove {
  background: #252526;
  color: #cccccc;
  border: 1px solid #2b2b2b;
  border-radius: 6px;
  padding: 4px;
  font-size: 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.command-dropdown-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 0;
  overflow: visible;
  pointer-events: none;
}
.command-dropdown-wrapper :deep(.ui-dropdown-menu) {
  pointer-events: auto;
}

:deep(.command-popup) {
  max-height: 220px;
}

:deep(.command-popup) .ui-dropdown-item[aria-selected='true'] {
  background: #2b2b2b;
  border: 1px solid #3c3c3c;
}

.command-dropdown-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  min-width: 0;
}
.command-name {
  font-size: 12px;
  color: #e2e8f0;
  line-height: 1.2;
}
.command-desc {
  font-size: 10px;
  color: #94a3b8;
  line-height: 1.2;
}

.history-dropdown-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 0;
  overflow: visible;
  pointer-events: none;
}

.history-dropdown-wrapper :deep(.ui-dropdown-menu) {
  pointer-events: auto;
}

:deep(.history-popup) {
  max-height: 50vh;
  overflow: auto;
  /* Match input panel background */
  background: #1f1f1f;
  border: 1px solid #2b2b2b;
  outline: none;
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.45);
  box-sizing: border-box;
}

:deep(.history-popup) .ui-dropdown-item {
  /* Match thread-block style */
  background: #181818;
  border: 1px solid #2b2b2b;
  border-radius: 10px;
  padding: 8px;
}

:deep(.history-popup) .ui-dropdown-item + .ui-dropdown-item {
  margin-top: 4px;
}

:deep(.history-popup) .ui-dropdown-item[aria-selected='true'],
:deep(.history-popup) .ui-dropdown-item:hover {
  background: #2b2b2b;
  border-color: #3c3c3c;
}

.history-item {
  border-left: 3px solid #2b2b2b;
  padding-left: 8px;
  flex: 1 1 auto;
  min-width: 0;
}

.history-item-text {
  font-size: 12px;
  color: #e2e8f0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
  white-space: pre-wrap;
}

.history-item-target {
  font-size: 10px;
  font-weight: 600;
  margin-top: 4px;
  opacity: 0.92;
  display: flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-target-agent,
.history-target-model,
.history-target-provider,
.history-target-separator,
.history-target-variant {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-target-model {
  color: #f8fafc;
}

.history-target-provider {
  color: #94a3b8;
}

.history-target-separator {
  color: #94a3b8;
}

.history-target-variant {
  color: #f59e0b;
}

.input-button {
  background: transparent;
  color: #94a3b8;
  border: 1px solid transparent;
  border-radius: 8px;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition:
    background 0.15s,
    color 0.15s;
}

.input-button:hover:not(:disabled) {
  background: rgba(51, 65, 85, 0.35);
  color: #e2e8f0;
}

.input-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.input-button.primary {
  background: rgba(37, 99, 235, 0.2);
  border-color: transparent;
  border-radius: 8px;
  width: 28px;
  height: 28px;
  color: #60a5fa;
}

.input-button.primary:hover:not(:disabled) {
  background: rgba(37, 99, 235, 0.35);
  color: #93bbfd;
}

.input-button.stop {
  background: rgba(220, 38, 38, 0.2);
  border-color: transparent;
  border-radius: 8px;
  width: 28px;
  height: 28px;
  color: #f87171;
}

.input-button.stop:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.35);
  color: #fca5a5;
}

.input-button.send-button {
  background: transparent;
  border: 0;
  border-radius: 8px;
  box-shadow: none;
}

.input-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  flex: 0 0 auto;
}

.suppress-button {
}

.suppress-button.active {
  background: transparent;
  color: #f87171;
}

.suppress-button.active:hover {
  background: rgba(239, 68, 68, 0.35);
  color: #fca5a5;
}

.bookmark-button {
  position: relative;
}

.bookmark-button:hover:not(:disabled) {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.bookmark-button.active {
  background: transparent;
  color: #fbbf24;
}

.bookmark-button.active:hover:not(:disabled) {
  background: rgba(251, 191, 36, 0.32);
  color: #fcd34d;
}

.bookmark-button.active :deep(svg),
.bookmark-button.active :deep(path) {
  fill: currentColor;
}

@media (max-width: 640px) {
  .input-toolbar {
    align-items: stretch;
  }

  .input-selects,
  .input-toolbar > .input-field {
    flex: 1 1 140px;
  }

  .input-selects > .input-field {
    width: 100%;
  }

  .input-actions {
    flex: 1 1 100%;
    justify-content: flex-end;
  }
}
</style>
