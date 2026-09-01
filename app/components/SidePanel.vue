<template>
  <aside class="side-panel" :class="{ 'is-collapsed': collapsed }">
    <nav class="activity-bar" aria-label="Primary side bar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="activity-button"
        :class="{ 'is-active': activeTab === tab.id && !collapsed }"
        :aria-label="tabTitle(tab)"
        :title="tabTitle(tab)"
        @click="emit('select-tab', tab.id)"
        @pointerup="blurMouseTarget"

      >
        <Icon :icon="tab.icon" :width="21" :height="21" />
        <span
          v-if="tab.id === 'recent' && notificationCount > 0"
          class="activity-notification-mark"
          aria-hidden="true"
        ></span>
      </button>
      <div class="activity-spacer"></div>
      <button
        type="button"
        class="activity-button activity-utility-button"
        aria-label="Open shell"
        title="Open shell"
        @click="emit('open-shell')"
        @pointerup="blurMouseTarget"

      >
        <Icon icon="lucide:terminal" :width="21" :height="21" />
      </button>
      <Dropdown
        v-model:open="tipsMenuOpen"
        placement="top"
        :popup-style="{ width: '300px', marginLeft: '44px' }"
      >
        <template #trigger>
          <button
            type="button"
            class="activity-button activity-utility-button"
            :class="{ 'is-open': tipsMenuOpen }"
            aria-label="Tips"
            title="Tips"
            @click.stop="tipsMenuOpen = !tipsMenuOpen"
            @pointerup="blurMouseTarget"
          >
            <Icon icon="lucide:lightbulb" :width="21" :height="21" />
          </button>
        </template>
        <div class="activity-tips" @click.stop>
          <p class="activity-tips-note">
            Hold <kbd>Shift</kbd> on a worktree or path, then click archive to show archived
            sessions. Shift also reveals delete.
          </p>
          <p class="activity-tips-note">
            Todo only appears on complex tasks, when the agent breaks work into steps.
          </p>
          <div class="activity-tips-section">
            <div class="activity-tips-title">Shortcuts</div>
            <dl class="activity-tips-shortcuts">
              <div>
                <dt>
                  <kbd>{{ modKey }}</kbd>
                  <kbd>J</kbd>
                </dt>
                <dd>New session</dd>
              </div>
              <div>
                <dt>
                  <kbd>{{ altKey }}</kbd>
                  <kbd>↑</kbd>
                  <kbd>↓</kbd>
                </dt>
                <dd>Switch session</dd>
              </div>
              <div>
                <dt>
                  <kbd>Esc</kbd>
                  <kbd>Esc</kbd>
                </dt>
                <dd>Stop</dd>
              </div>
            </dl>
          </div>
        </div>
      </Dropdown>
      <button
        type="button"
        class="activity-button activity-utility-button"
        aria-label="Settings"
        title="Settings"
        @click="emit('open-settings')"
        @pointerup="blurMouseTarget"

      >
        <Icon icon="lucide:settings" :width="21" :height="21" />
      </button>
    </nav>
    <div v-if="!collapsed" class="side-body">
      <header class="side-header">
        <span>{{ activeTabLabel }}</span>
        <button
          type="button"
          class="side-close"
          aria-label="Collapse side panel"
          @click="emit('toggle-collapse')"
        >
          <Icon icon="lucide:x" width="16" height="16" />
        </button>
      </header>
      <TodoList v-if="activeTab === 'todo'" :sessions="todoSessions" />
      <BookmarksList
        v-else-if="activeTab === 'bookmarks'"
        :sessions="bookmarkedSessions"
        @select-session="(session) => emit('select-bookmark', session)"
        @remove-bookmark="(sessionId) => emit('remove-bookmark', sessionId)"
      />
      <BookmarksList
        v-else-if="activeTab === 'recent'"
        :sessions="recentSessions"
        empty-text="No recent sessions."
        hide-remove
        hide-icon
        group-by-time
        show-session-menu
        @select-session="(session) => emit('select-bookmark', session)"
        @rename-session="(payload) => emit('rename-session', payload)"
        @toggle-pin="(session) => emit('toggle-pin', session)"
        @archive-session="(session) => emit('archive-session', session)"
        @delete-session="(session) => emit('delete-session', session)"
      />
      <SessionSearch
        v-else-if="activeTab === 'search'"
        @select-hit="(hit) => emit('select-search-hit', hit)"
      />
      <TreeView
        v-else
        :panel-mode="activeTab === 'git' ? 'git' : 'files'"
        :root-nodes="treeNodes"
        :expanded-paths="expandedTreePaths"
        :selected-path="selectedTreePath"
        :is-loading="treeLoading"
        :error="treeError"
        :git-status-by-path="treeStatusByPath"
        :git-status-loaded="treeGitStatusLoaded"
        :branch-info="treeBranchInfo"
        :diff-stats="treeDiffStats"
        :directory-name="treeDirectoryName"
        :branch-entries="treeBranchEntries"
        :branch-list-loading="treeBranchListLoading"
        :run-shell-command="runShellCommand"
        @toggle-dir="(path) => emit('toggle-dir', path)"
        @select-file="(path) => emit('select-file', path)"
        @open-diff="(payload) => emit('open-diff', payload)"
        @open-diff-all="(payload) => emit('open-diff-all', payload)"
        @open-file="(path) => emit('open-file', path)"
        @reload="emit('reload')"
        @load-branches="emit('load-branches')"
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, toRefs } from 'vue';
import { Icon } from '@iconify/vue';
import Dropdown from './Dropdown.vue';
import TodoList from './TodoList.vue';
import BookmarksList, { type BookmarkedSessionView } from './BookmarksList.vue';
import type {
  BranchEntry,
  GitBranchInfo,
  GitDiffStats,
  GitFileStatus,
  TreeNode,
} from '../composables/useFileTree';
import SessionSearch from './SessionSearch.vue';
import type { SessionSearchHit } from '../utils/sessionSearch';
import TreeView from './TreeView.vue';
import type { TodoSession } from '../composables/useTodos';

const props = defineProps<{
  collapsed: boolean;
  activeTab: SidePanelTab;
  todoSessions: TodoSession[];
  bookmarkedSessions: BookmarkedSessionView[];
  recentSessions: BookmarkedSessionView[];
  notificationCount?: number;
  treeNodes: TreeNode[];
  expandedTreePaths: string[];
  selectedTreePath?: string;
  treeLoading: boolean;
  treeError?: string;
  treeStatusByPath: Record<string, GitFileStatus>;
  treeGitStatusLoaded?: boolean;
  treeBranchInfo?: GitBranchInfo | null;
  treeDiffStats?: GitDiffStats | null;
  treeDirectoryName?: string;
  treeBranchEntries?: BranchEntry[];
  treeBranchListLoading?: boolean;
  runShellCommand?: (command: string) => Promise<void>;
}>();

const emit = defineEmits<{
  (event: 'toggle-collapse'): void;
  (event: 'select-tab', value: SidePanelTab): void;
  (event: 'select-bookmark', session: BookmarkedSessionView): void;
  (event: 'remove-bookmark', sessionId: string): void;
  (event: 'rename-session', payload: { session: BookmarkedSessionView; title: string }): void;
  (event: 'toggle-pin', session: BookmarkedSessionView): void;
  (event: 'archive-session', session: BookmarkedSessionView): void;
  (event: 'delete-session', session: BookmarkedSessionView): void;
  (event: 'toggle-dir', path: string): void;
  (event: 'select-file', path: string): void;
  (event: 'open-diff', payload: { path: string; staged: boolean }): void;
  (event: 'open-diff-all', payload: { mode: 'staged' | 'changes' | 'all' }): void;
  (event: 'open-file', path: string): void;
  (event: 'reload'): void;
  (event: 'load-branches'): void;
  (event: 'open-shell'): void;
  (event: 'open-settings'): void;
  (event: 'select-search-hit', hit: SessionSearchHit): void;
}>();

export type SidePanelTab = 'recent' | 'files' | 'git' | 'search' | 'todo' | 'bookmarks';

const tabs: { id: SidePanelTab; label: string; icon: string }[] = [
  { id: 'recent', label: 'Recent', icon: 'lucide:history' },
  { id: 'files', label: 'Files', icon: 'lucide:files' },
  { id: 'git', label: 'Git', icon: 'lucide:git-branch' },
  { id: 'search', label: 'Search', icon: 'lucide:search' },
  { id: 'todo', label: 'Todo', icon: 'lucide:list-todo' },
  { id: 'bookmarks', label: 'Bookmarks', icon: 'lucide:bookmark' },
];

const notificationCount = computed(() => props.notificationCount ?? 0);

const activeTabLabel = computed(
  () => tabs.find((tab) => tab.id === props.activeTab)?.label.toUpperCase() ?? '',
);

function tabTitle(tab: { id: SidePanelTab; label: string }) {
  if (tab.id === 'recent' && notificationCount.value > 0) {
    const count = notificationCount.value;
    return `Recents · ${count} pending message${count === 1 ? '' : 's'}`;
  }
  return tab.label;
}

function blurMouseTarget(event: PointerEvent) {
  if (event.pointerType !== 'mouse') return;
  const target = event.currentTarget;
  if (target instanceof HTMLElement) target.blur();
}

const tipsMenuOpen = ref(false);
const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const modKey = isMac ? '⌘' : 'Ctrl';
const altKey = isMac ? '⌥' : 'Alt';

const {
  collapsed,
  activeTab,
  todoSessions,
  bookmarkedSessions,
  recentSessions,
  treeNodes,
  expandedTreePaths,
  selectedTreePath,
  treeLoading,
  treeError,
  treeStatusByPath,
  treeGitStatusLoaded,
  treeBranchInfo,
  treeDiffStats,
  treeDirectoryName,
  treeBranchEntries,
  treeBranchListLoading,
  runShellCommand,
} = toRefs(props);
</script>

<style scoped>
.side-panel {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: row;
  gap: var(--workbench-inset, 4px);
  border: 0;
  border-radius: 0;
  background: transparent;
  overflow: visible;
}

.activity-bar {
  flex: 0 0 44px;
  width: 44px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 4px 0 8px 8px;
  box-sizing: border-box;
  background: transparent;
  border: 0;
}

.activity-button {
  position: relative;
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  margin: 2px 0;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #868686;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.activity-spacer {
  flex: 1 1 auto;
  min-height: 8px;
}

.activity-utility-button {
  color: #9d9d9d;
}

.activity-bar :deep(.ui-dropdown) {
  flex: 0 0 auto;
}

.activity-tips {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 10px 12px 8px;
  color: #cccccc;
  font-size: 12px;
  line-height: 1.45;
}

.activity-tips p {
  margin: 0;
}

.activity-tips-note {
  color: #b4b4b4;
  line-height: 1.5;
}

.activity-tips-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.activity-tips-title {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8a8a8a;
}

.activity-tips-shortcuts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
}

.activity-tips-shortcuts > div {
  display: grid;
  grid-template-columns: 7.5rem 1fr;
  align-items: center;
  gap: 10px;
}

.activity-tips-shortcuts dt {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
}

.activity-tips-shortcuts dd {
  margin: 0;
  color: #d0d0d0;
}

.activity-tips kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4em;
  height: 20px;
  padding: 0 5px;
  border: 1px solid #3c3c3c;
  border-radius: 4px;
  background: #2b2b2b;
  font-size: 11px;
  font-family: inherit;
  font-weight: 500;
  line-height: 1;
  color: #e6e6e6;
}

.activity-button:hover,
.activity-button.is-open,
.activity-bar :deep(.ui-dropdown.is-open) .activity-button {
  background: rgba(255, 255, 255, 0.08);
  color: #d7d7d7;
}

.activity-button:focus {
  outline: none;
}

.activity-button:focus-visible {
  outline: none;
  background: rgba(255, 255, 255, 0.08);
  color: #d7d7d7;
}

.activity-button.is-active {
  background: rgba(255, 255, 255, 0.13);
  color: #d7d7d7;
}

.activity-notification-mark {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c084fc;
}

.side-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin: var(--workbench-inset, 4px) 0;
  background: #1f1f1f;
  border: 1px solid #2b2b2b;
  border-radius: var(--card-radius, 6px);
  overflow: hidden;
}

.side-header {
  height: 35px;
  flex: 0 0 35px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 18px;
  color: #cccccc;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.04em;
}

.side-close {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.side-close:hover {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.08);
}

.side-panel.is-collapsed {
  gap: 0;
}

.side-panel.is-collapsed .activity-bar {
  border: 0;
}

@media (max-width: 768px) {
  .activity-bar {
    flex-basis: 40px;
    width: 40px;
    padding: 4px 0 8px 6px;
  }

  .activity-button {
    width: 34px;
    height: 34px;
    flex-basis: 34px;
  }
}

html[data-theme='light'] .activity-button:hover,
html[data-theme='light'] .activity-button:focus-visible,
html[data-theme='light'] .activity-button.is-open,
html[data-theme='light'] .activity-bar :deep(.ui-dropdown.is-open) .activity-button {
  background: #ececec;
  color: #2f2f2f;
}

</style>
