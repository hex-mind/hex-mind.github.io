<template>
  <div class="output-panel-root">
    <div class="output-panel-shell">
      <div v-if="projectName" class="project-name-bar">
        {{ projectName }}
      </div>
      <div class="output-panel-main">
        <div
          ref="panelEl"
          class="output-panel-scroll"
          @scroll="handleScroll"
          @wheel="$emit('wheel', $event)"
          @touchmove="$emit('touchmove')"
        >
          <div ref="contentEl" class="output-panel-content" @click="handleContentClick">
            <div
              v-if="initialRenderTrackingActive"
              class="absolute w-full h-full m-auto flex justify-center items-center"
            >
              <div class="app-loading-spinner" aria-hidden="true"></div>
            </div>

            <template v-for="root in renderedRoots" :key="root.id">
              <ThreadBlock
                v-show="!initialRenderTrackingActive"
                :root="root"
                :theme="theme"
                :files-with-basenames="filesWithBasenames"
                :is-reverted-preview="isRevertedPreview(root)"
                :resolve-agent-color="resolveAgentColor"
                :resolve-model-meta="resolveModelMeta"
                :model-options="modelOptions"
                :selected-model="selectedModel"
                :agent-options="agentOptions"
                :selected-mode="selectedMode"
                :compute-context-percent="computeContextPercent"
                :session-revert="sessionRevert"
                :assistant-html="getAssistantHtml(root.id)"
                :deferred-transition-key="getDeferredTransitionKey(root)"
                @edit-message="emit('edit-message', $event)"
                @revert-message="emit('revert-message', $event)"
                @undo-revert="emit('undo-revert')"
                @show-message-diff="emit('show-message-diff', $event)"
                @open-image="emit('open-image', $event)"
                @show-thread-history="emit('show-thread-history', $event)"
                @message-rendered="handleMessageRendered"
              />
            </template>

            <div v-if="sessionRevert" class="session-revert-banner">
              <span>Later messages are hidden.</span>
              <button type="button" @click="emit('undo-revert')">Undo</button>
            </div>

            <FileRefPopup ref="fileRefPopupRef" :files="files" @open-file="handlePopupOpenFile" />
          </div>
        </div>

        <button
          v-show="!isFollowing"
          type="button"
          class="follow-button"
          aria-label="Scroll to latest"
          @click="$emit('resume-follow')"
        >
          <Icon icon="lucide:arrow-down" :width="14" :height="14" />
        </button>
      </div>

      <StatusBar
        :thinking-display-text="thinkingDisplayText"
        :status-text="statusText"
        :is-status-error="isStatusError"
        :is-retry-status="!!isRetryStatus"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import FileRefPopup from './FileRefPopup.vue';
import StatusBar from './StatusBar.vue';
import ThreadBlock from './ThreadBlock.vue';
import { useFileTree } from '../composables/useFileTree';
import { useInitialRenderTracking } from '../composables/useInitialRenderTracking';
import { useMessages } from '../composables/useMessages';
import { useAssistantPreRenderer } from '../composables/useAssistantPreRenderer';
import { useThinkingAnimation } from '../composables/useThinkingAnimation';
import type {
  HistoryWindowEntry,
  MessageDiffEntry,
  MessageTokens,
  ModelMeta,
} from '../types/message';
import type { MessageInfo } from '../types/sse';

const msg = useMessages();

const props = defineProps<{
  isFollowing: boolean;
  statusText: string;
  isStatusError: boolean;
  isThinking: boolean;
  isRetryStatus?: boolean;
  busyDescendantCount?: number;
  theme: string;
  resolveAgentColor?: (agent?: string) => string;
  resolveModelMeta?: (modelPath?: string) => ModelMeta | undefined;
  modelOptions: Array<{
    id: string;
    modelID: string;
    displayName: string;
    providerID?: string;
    providerLabel?: string;
  }>;
  selectedModel: string;
  agentOptions: Array<{ id: string; label: string; description?: string; color?: string }>;
  selectedMode: string;
  computeContextPercent?: (
    tokens: MessageTokens,
    providerId?: string,
    modelId?: string,
  ) => number | null;
  projectName?: string;
  sessionRevert?: {
    messageID: string;
    partID?: string;
    snapshot?: string;
    diff?: string;
  } | null;
}>();

const emit = defineEmits<{
  (event: 'scroll'): void;
  (event: 'wheel', eventArg: WheelEvent): void;
  (event: 'touchmove'): void;
  (event: 'resume-follow'): void;
  (
    event: 'edit-message',
    payload: {
      sessionId: string;
      messageId: string;
      text: string;
      model: string;
      agent: string;
    },
  ): void;
  (event: 'revert-message', payload: { sessionId: string; messageId: string }): void;
  (event: 'undo-revert'): void;
  (event: 'show-message-diff', payload: { messageKey: string; diffs: MessageDiffEntry[] }): void;
  (event: 'open-image', payload: { url: string; filename: string }): void;
  (event: 'show-thread-history', payload: { entries: HistoryWindowEntry[] }): void;
  (event: 'open-file', path: string, lines?: string): void;
  (event: 'show-commit', hash: string): void;
  (event: 'message-rendered'): void;
  (event: 'content-resized'): void;
  (event: 'initial-render-complete'): void;
}>();

const visibleRoots = computed(() => msg.roots.value);
const revertedRootIndex = computed(() => {
  const messageId = props.sessionRevert?.messageID;
  if (!messageId) return -1;
  return visibleRoots.value.findIndex((root) => root.id === messageId);
});
const renderedRoots = computed(() => {
  if (revertedRootIndex.value < 0) return visibleRoots.value;
  return visibleRoots.value.slice(0, revertedRootIndex.value);
});

const { files, fileCacheVersion } = useFileTree();

const filesWithBasenames = computed(() => {
  const set = new Set<string>();
  for (const path of files.value) {
    const segments = path.split('/');
    for (let i = 0; i < segments.length; i++) {
      set.add(segments.slice(i).join('/'));
    }
  }
  return Array.from(set);
});

function getFinalAnswer(root: MessageInfo): MessageInfo | undefined {
  return msg.getFinalAnswer(root.id);
}

function hasAssistantMessages(root: MessageInfo): boolean {
  const thread = msg.getThread(root.id);
  return thread.some((item) => item.role === 'assistant' && msg.hasTextContent(item.id));
}

function getFinalAnswerContent(root: MessageInfo): string {
  const final = getFinalAnswer(root);
  if (!final) return '';
  return msg.getTextContent(final.id);
}

function getThreadUserRenderKey(root: MessageInfo): string {
  return `thread-user:${root.id}`;
}

function getThreadAssistantRenderKey(root: MessageInfo): string {
  const final = getFinalAnswer(root);
  return getThreadAssistantRenderKeyById(root.id, final?.id);
}

function getThreadAssistantRenderKeyById(rootId: string, answerId?: string): string {
  return `thread-assistant:${rootId}:${answerId ?? 'none'}`;
}

function getThreadTransitionKey(root: MessageInfo): string {
  return getFinalAnswer(root)?.id ?? root.id;
}

const { initialRenderTrackingActive, beginInitialRenderTracking, handleMessageRendered } =
  useInitialRenderTracking({
    visibleRoots: renderedRoots,
    hasAssistantMessages,
    getThreadUserRenderKey,
    getThreadAssistantRenderKey,
    onInitialRenderComplete: () => emit('initial-render-complete'),
    onMessageRendered: () => emit('message-rendered'),
  });

const { getAssistantHtml, getDeferredTransitionKey } = useAssistantPreRenderer({
  visibleRoots: renderedRoots,
  theme: computed(() => props.theme),
  fileCacheVersion,
  filesWithBasenames,
  getFinalAnswer,
  hasAssistantMessages,
  getFinalAnswerContent,
  getThreadTransitionKey,
  getThreadAssistantRenderKeyById,
  onRendered: handleMessageRendered,
});

const { thinkingDisplayText } = useThinkingAnimation(
  computed(() => props.isThinking),
  computed(() => props.busyDescendantCount ?? 0),
);

function isRevertedPreview(_root: MessageInfo): boolean {
  return false;
}

const panelEl = ref<HTMLDivElement | null>(null);
const contentEl = ref<HTMLDivElement | null>(null);
const fileRefPopupRef = ref<{
  handleContentClick: (event: MouseEvent) => void;
  closeFilePopup: () => void;
} | null>(null);
let contentResizeObserver: ResizeObserver | undefined;

function handleScroll() {
  emit('scroll');
}

function handleContentClick(event: MouseEvent) {
  fileRefPopupRef.value?.handleContentClick(event);
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  const commitRefEl = target.closest('[data-commit-ref]');
  if (!(commitRefEl instanceof HTMLElement)) return;
  const hash = commitRefEl.dataset.commitRef?.trim();
  if (!hash) return;
  emit('show-commit', hash);
}

function handlePopupOpenFile(path: string, lines?: string) {
  emit('open-file', path, lines);
}

let searchTargetTimer: ReturnType<typeof setTimeout> | null = null;

function scrollToThread(threadId: string) {
  const id = threadId.trim();
  if (!id) return;
  const selector = `[data-thread-id="${CSS.escape(id)}"]`;
  const target = contentEl.value?.querySelector(selector);
  if (!(target instanceof HTMLElement)) return;
  contentEl.value?.querySelectorAll('.is-search-target').forEach((el) => {
    el.classList.remove('is-search-target');
  });
  target.classList.add('is-search-target');
  target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  if (searchTargetTimer) clearTimeout(searchTargetTimer);
  searchTargetTimer = setTimeout(() => {
    target.classList.remove('is-search-target');
    searchTargetTimer = null;
  }, 1600);
}

function setupContentResizeObserver() {
  contentResizeObserver?.disconnect();
  contentResizeObserver = undefined;
  if (typeof ResizeObserver === 'undefined') return;
  const target = contentEl.value;
  if (!target) return;
  contentResizeObserver = new ResizeObserver(() => {
    emit('content-resized');
  });
  contentResizeObserver.observe(target);
}

watch(contentEl, () => {
  setupContentResizeObserver();
});

onMounted(() => {
  setupContentResizeObserver();
  nextTick(() => {
    beginInitialRenderTracking();
    emit('content-resized');
  });
});

onBeforeUnmount(() => {
  contentResizeObserver?.disconnect();
  contentResizeObserver = undefined;
  fileRefPopupRef.value?.closeFilePopup();
  if (searchTargetTimer) clearTimeout(searchTargetTimer);
});

const theme = computed(() => props.theme);
const resolveAgentColor = computed(() => props.resolveAgentColor);
const resolveModelMeta = computed(() => props.resolveModelMeta);
const computeContextPercent = computed(() => props.computeContextPercent);
const sessionRevert = computed(() => props.sessionRevert);
const statusText = computed(() => props.statusText);
const isStatusError = computed(() => props.isStatusError);
const isRetryStatus = computed(() => props.isRetryStatus);
const isFollowing = computed(() => props.isFollowing);

defineExpose({ panelEl, scrollToThread });
</script>

<style scoped>
.output-panel-root {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.output-panel-shell {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
  background-color: #1f1f1f;
  background-image: linear-gradient(
    color-mix(in srgb, var(--project-tint, transparent) 9%, transparent),
    color-mix(in srgb, var(--project-tint, transparent) 9%, transparent)
  );
  color: #cccccc;
  border: 1px solid #2b2b2b;
  border-radius: var(--card-radius, 6px);
  background-clip: padding-box;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 13px;
}

.output-panel-scroll {
  display: flex;
  flex-direction: column;
  padding: 0;
  min-height: 0;
  flex: 1 1 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  mask-image: linear-gradient(
    to bottom,
    transparent,
    black 12px,
    black calc(100% - 12px),
    transparent
  );
}

.output-panel-main {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1 1 auto;
}

.output-panel-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px 12px;
}

.output-panel-content :deep(.markdown-host code.file-ref) {
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: rgba(125, 211, 252, 0.4);
  text-underline-offset: 2px;
}

.output-panel-content :deep(.markdown-host code.file-ref:hover) {
  text-decoration-color: #7dd3fc;
  color: #7dd3fc;
}

.output-panel-content :deep(.markdown-host code.commit-ref) {
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: rgba(125, 211, 252, 0.4);
  text-decoration-style: dotted;
  text-underline-offset: 2px;
}

.output-panel-content :deep(.markdown-host code.commit-ref:hover) {
  text-decoration-color: #7dd3fc;
  text-decoration-style: dotted;
  color: #7dd3fc;
}

.output-panel-content :deep(.markdown-host code.color-ref::before) {
  content: '';
  display: inline-block;
  width: 0.85em;
  height: 0.85em;
  margin-right: 0.35em;
  vertical-align: middle;
  background-color: var(--preview-color);
  border: 1px solid rgba(255, 255, 255, 0.35);
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.5);
}

.project-name-bar {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: color-mix(in srgb, var(--project-tint, #94a3b8) 60%, #94a3b8);
  padding: 12px 12px 0;
  user-select: none;
}

.follow-button {
  position: absolute;
  left: 50%;
  bottom: 10px;
  transform: translateX(-50%);
  width: 36px;
  height: 36px;
  aspect-ratio: 1 / 1;
  box-sizing: border-box;
  border-radius: 999px;
  border: 1px solid #2b2b2b;
  background: #1f1f1f;
  color: #cccccc;
  font-size: 18px;
  line-height: 1;
  display: grid;
  place-items: center;
  box-shadow: 0 10px 24px rgba(2, 6, 23, 0.45);
  cursor: pointer;
  z-index: 3;
}

.follow-button:hover {
  background: #2b2b2b;
}

.session-revert-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 8px 10px;
  padding: 8px 10px;
  border: 1px solid rgba(96, 165, 250, 0.28);
  border-radius: 8px;
  background: rgba(30, 58, 138, 0.16);
  color: #94a3b8;
  font-size: 11px;
}

.session-revert-banner button {
  padding: 3px 8px;
  border: 0;
  border-radius: 5px;
  background: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
  font: inherit;
  cursor: pointer;
}

.session-revert-banner button:hover {
  background: rgba(59, 130, 246, 0.34);
  color: #dbeafe;
}

.app-loading-spinner {
  width: 26px;
  height: 26px;
  margin: 0 auto 12px;
  border-radius: 50%;
  border: 3px solid rgba(148, 163, 184, 0.4);
  border-top-color: #e2e8f0;
  animation: app-loading-spin 0.85s linear infinite;
}

@keyframes app-loading-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
