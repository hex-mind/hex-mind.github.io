<template>
  <aside class="side-panel" :class="{ 'is-collapsed': collapsed }">
    <nav class="activity-bar" aria-label="Primary side bar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="activity-button"
        :class="{ 'is-active': activeTab === tab.id && !collapsed }"
        :aria-label="tab.label"
        :title="tab.label"
        @click="emit('select-tab', tab.id)"
      >
        <Icon :icon="tab.icon" :width="21" :height="21" />
      </button>
      <div class="activity-spacer"></div>
      <a
        href="https://github.com/hex-mind/hex-mind.github.io"
        target="_blank"
        rel="noopener noreferrer"
        class="activity-button activity-utility-button"
        aria-label="GitHub"
        title="GitHub"
      >
        <Icon icon="lucide:github" :width="21" :height="21" />
      </a>
      <Dropdown
        v-model:open="settingsMenuOpen"
        placement="top"
        :popup-style="{ width: '160px', marginLeft: '44px' }"
        auto-close
        @select="onSettingsMenuSelect"
      >
        <template #trigger>
          <button
            type="button"
            class="activity-button activity-utility-button"
            aria-label="Settings"
            title="Settings"
            @click.stop="settingsMenuOpen = !settingsMenuOpen"
          >
            <Icon icon="lucide:settings" :width="21" :height="21" />
          </button>
        </template>
        <DropdownItem value="settings">
          <span class="activity-menu-item">
            <Icon icon="lucide:settings" :width="14" :height="14" />
            Settings
          </span>
        </DropdownItem>
        <DropdownItem value="logout">
          <span class="activity-menu-item">
            <Icon icon="lucide:log-out" :width="14" :height="14" />
            Logout
          </span>
        </DropdownItem>
      </Dropdown>
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
      <div v-else-if="activeTab === 'search'" class="search-panel">
        <label class="search-field">
          <span class="sr-only">Search</span>
          <input type="search" placeholder="Search" aria-label="Search" />
          <Icon icon="lucide:search" :width="15" :height="15" />
        </label>
      </div>
      <TreeView
        v-else
        :panel-mode="activeTab"
        :root-nodes="treeNodes"
        :expanded-paths="expandedTreePaths"
        :selected-path="selectedTreePath"
        :is-loading="treeLoading"
        :error="treeError"
        :git-status-by-path="treeStatusByPath"
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
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref, toRefs } from 'vue';
import { Icon } from '@iconify/vue';
import Dropdown from './Dropdown.vue';
import DropdownItem from './Dropdown/Item.vue';
import TodoList from './TodoList.vue';
import BookmarksList, { type BookmarkedSessionView } from './BookmarksList.vue';
import type { BranchEntry } from '../composables/useFileTree';
import TreeView, {
  type GitBranchInfo,
  type GitDiffStats,
  type GitFileStatus,
  type TreeNode,
} from './TreeView.vue';

type TodoItem = {
  content: string;
  status: string;
  priority: string;
};

type TodoPanelSession = {
  sessionId: string;
  title: string;
  isSubagent: boolean;
  todos: TodoItem[];
  loading: boolean;
  error: string | undefined;
};

const props = defineProps<{
  collapsed: boolean;
  activeTab: SidePanelTab;
  todoSessions: TodoPanelSession[];
  bookmarkedSessions: BookmarkedSessionView[];
  treeNodes: TreeNode[];
  expandedTreePaths: string[];
  selectedTreePath?: string;
  treeLoading: boolean;
  treeError?: string;
  treeStatusByPath: Record<string, GitFileStatus>;
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
  (event: 'toggle-dir', path: string): void;
  (event: 'select-file', path: string): void;
  (event: 'open-diff', payload: { path: string; staged: boolean }): void;
  (event: 'open-diff-all', payload: { mode: 'staged' | 'changes' | 'all' }): void;
  (event: 'open-file', path: string): void;
  (event: 'reload'): void;
  (event: 'open-settings'): void;
  (event: 'logout'): void;
}>();

export type SidePanelTab = 'files' | 'git' | 'search' | 'todo' | 'bookmarks';

const tabs: { id: SidePanelTab; label: string; icon: string }[] = [
  { id: 'files', label: 'Files', icon: 'lucide:files' },
  { id: 'git', label: 'Git', icon: 'lucide:git-branch' },
  { id: 'search', label: 'Search', icon: 'lucide:search' },
  { id: 'todo', label: 'Todo', icon: 'lucide:list-todo' },
  { id: 'bookmarks', label: 'Bookmarks', icon: 'lucide:bookmark' },
];

const activeTabLabel = computed(
  () => tabs.find((tab) => tab.id === props.activeTab)?.label.toUpperCase() ?? '',
);
const settingsMenuOpen = ref(false);

function onSettingsMenuSelect(value: unknown) {
  if (value === 'settings') emit('open-settings');
  if (value === 'logout') emit('logout');
}

const {
  collapsed,
  activeTab,
  todoSessions,
  bookmarkedSessions,
  treeNodes,
  expandedTreePaths,
  selectedTreePath,
  treeLoading,
  treeError,
  treeStatusByPath,
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
  border: 1px solid #334155;
  border-radius: 10px;
  background-clip: padding-box;
  background: rgba(15, 23, 42, 0.92);
  overflow: hidden;
}

.activity-bar {
  flex: 0 0 45px;
  width: 45px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  background: #0b1320;
  border-right: 1px solid #334155;
}

.activity-button {
  position: relative;
  width: 37px;
  height: 37px;
  flex: 0 0 37px;
  margin: 4px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
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
  color: #94a3b8;
}

.activity-bar :deep(.ui-dropdown) {
  flex: 0 0 auto;
}

.activity-menu-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #e2e8f0;
}

.activity-button:hover {
  background: rgba(51, 65, 85, 0.45);
  color: #cbd5e1;
}

.activity-button.is-active {
  background: rgba(51, 65, 85, 0.6);
  color: #f1f5f9;
}

.activity-button.is-active::before {
  content: '';
  position: absolute;
  inset: 7px auto 7px -4px;
  width: 2px;
  border-radius: 999px;
  background: #60a5fa;
}

.side-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: rgba(15, 23, 42, 0.92);
}

.side-header {
  height: 35px;
  flex: 0 0 35px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 18px;
  color: #cbd5e1;
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
  background: #1e293b;
}

.side-panel.is-collapsed {
  border-color: #334155;
}

.side-panel.is-collapsed .activity-bar {
  border-right: 0;
}

.search-panel {
  min-height: 0;
  padding: 6px 12px;
}

.search-field {
  height: 27px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 7px;
  border: 1px solid #334155;
  border-radius: 8px;
  background: #0b1320;
  color: #94a3b8;
}

.search-field:focus-within {
  border-color: #60a5fa;
}

.search-field input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #e2e8f0;
  font: inherit;
  font-size: 13px;
}

.search-field input::placeholder {
  color: #64748b;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 768px) {
  .activity-bar {
    flex-basis: 41px;
    width: 41px;
  }

  .activity-button {
    width: 33px;
    height: 35px;
    flex-basis: 35px;
  }
}
</style>
