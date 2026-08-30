<template>
  <div class="top-panel">
    <div class="top-row">
      <div class="top-left" :title="gitRevision">
        <span class="brand-mark">
          <span class="brand-hex" aria-hidden="true">
            <img src="/hex-logo.png" alt="" class="brand-logo-dark" />
            <img src="/hex-logo-light.png" alt="" class="brand-logo-light" />
          </span>
          <span class="brand-word">
            <img src="/hex-logo.png" alt="HEX" class="brand-logo-dark" />
            <img src="/hex-logo-light.png" alt="" class="brand-logo-light" />
          </span>
        </span>
        <div class="brand-tagline hidden lg:block">for opencode</div>
      </div>
      <div class="top-center">
        <Dropdown
          v-model:open="treeDropdownOpen"
          class="tree-dropdown-root"
          :label="dropdownLabel"
          placeholder="Select path"
          title="Select path"
          auto-close
          :auto-highlight="false"
          :popup-style="{ minWidth: '420px', width: 'min(680px, 90vw)', maxWidth: '90vw' }"
          popup-class="max-lg:left-0! max-lg:w-screen! max-lg:min-w-0! max-lg:max-w-none!"
          @select="onTreeSelect"
        >
          <template #label>
            <span v-if="selectedDisplay" class="selected-label">
              <span class="selected-title">{{ selectedDisplay.pathName }}</span>
              <span v-if="selectedDisplay.branch" class="selected-branch-badge">
                <Icon icon="lucide:git-branch" :width="11" :height="11" />
                {{ selectedDisplay.branch }}
              </span>
            </span>
            <span v-else class="selected-title">Select path</span>
          </template>
          <template #default="{ close }">
            <div class="tree-menu">
              <DropdownSearch
                v-model="searchQuery"
                placeholder="Search sessions, branches, directories..."
                class="tree-search"
              >
                <template #before>
                  <Icon icon="lucide:search" class="search-icon" />
                </template>
                <template #after>
                  <button
                    v-if="searchQuery"
                    type="button"
                    class="clear-search"
                    @click.stop="searchQuery = ''"
                  >
                    <Icon icon="lucide:x" />
                  </button>
                </template>
              </DropdownSearch>

              <div class="tree-content">
                <div v-if="displayedTree.length === 0" class="tree-empty">
                  {{ searchQuery ? 'No matching paths' : 'No worktrees' }}
                </div>

                <div
                  v-for="worktree in displayedTree"
                  :key="worktree.directory"
                  class="tree-worktree"
                >
                  <div class="tree-worktree-header">
                    <div class="tree-header-main">
                      <Icon
                        :icon="worktree.projectId === 'global' ? 'lucide:globe' : 'lucide:package'"
                        class="tree-header-icon"
                      />
                      <div class="tree-label">
                        <span class="tree-label-name" :title="worktree.directory">{{
                          worktreeGroupLabel(worktree)
                        }}</span>
                      </div>
                    </div>
                  </div>

                  <div
                    v-for="sandbox in worktree.sandboxes"
                    :key="sandbox.directory"
                    class="tree-sandbox"
                    :class="{
                      'is-expanded': isSandboxExpanded(worktree.directory, sandbox.directory),
                    }"
                  >
                    <div
                      class="tree-sandbox-header"
                      :class="{ 'is-current': isCurrentDirectory(sandbox.directory) }"
                    >
                      <div class="tree-header-main">
                        <button
                          type="button"
                          class="tree-expand-button"
                          :class="{
                            'is-open': isSandboxExpanded(worktree.directory, sandbox.directory),
                          }"
                          :title="
                            isSandboxExpanded(worktree.directory, sandbox.directory)
                              ? 'Collapse sessions'
                              : 'Expand sessions'
                          "
                          @mousedown.stop
                          @click.stop.prevent="toggleSandbox(worktree.directory, sandbox.directory)"
                        >
                          <Icon icon="lucide:chevron-right" :width="14" :height="14" />
                        </button>
                        <button
                          type="button"
                          class="tree-path-select"
                          :title="sandbox.directory"
                          @click="handleSelectDirectory(sandbox.directory, worktree, close)"
                        >
                          <Icon
                            :icon="sandbox.branch ? 'lucide:git-branch' : 'lucide:folder'"
                            class="tree-header-icon"
                          />
                          <div class="tree-label">
                            <span class="tree-label-name">{{
                              formatPathLabel(sandbox.directory)
                            }}</span>
                            <small v-if="sandbox.branch" class="tree-label-type">{{
                              sandbox.branch
                            }}</small>
                          </div>
                        </button>
                      </div>
                      <div v-if="isShiftPressed" class="tree-actions" @click.stop>
                        <button
                          v-if="sandboxHasArchived(worktree.directory, sandbox.directory)"
                          type="button"
                          class="tree-action-button show-archived"
                          :class="{
                            'is-on': isArchivedShown(worktree.directory, sandbox.directory),
                          }"
                          title="show archived sessions"
                          @mousedown.prevent.stop
                          @click.prevent.stop="
                            toggleShowArchived(worktree.directory, sandbox.directory)
                          "
                        >
                          <Icon icon="lucide:archive-restore" :width="16" :height="16" />
                        </button>
                        <button
                          v-if="
                            canDeleteSandbox(sandbox.directory, worktree.directory) &&
                            worktree.projectId !== 'global'
                          "
                          type="button"
                          class="tree-action-button danger"
                          title="Delete worktree"
                          @mousedown.prevent.stop
                          @click.prevent.stop="
                            handleSandboxDelete(sandbox.directory, worktree.directory, close)
                          "
                        >
                          <Icon icon="lucide:trash-2" :width="16" :height="16" />
                        </button>
                      </div>
                    </div>

                    <template v-if="isSandboxExpanded(worktree.directory, sandbox.directory)">
                      <div
                        v-for="session in sandbox.sessions"
                        :key="session.id"
                        class="tree-session-row"
                      >
                        <DropdownItem
                          :href="sessionShareHref(worktree.projectId, session.id)"
                          :value="{
                            projectId: worktree.projectId,
                            worktree: worktree.directory,
                            directory: sandbox.directory,
                            sessionId: session.id,
                          }"
                          :active="session.id === selectedSessionId"
                        >
                          <div class="tree-session-main">
                            <StatusDot class="session-status-icon" :status="session.status" />
                            <div class="session-info">
                              <div class="session-info-top">
                                <span class="session-title">{{
                                  formatSessionTitle(session.title, session.slug, session.id)
                                }}</span>
                              </div>
                              <span
                                v-if="session.timeCreated || session.timeUpdated"
                                class="session-time"
                              >
                                {{ formatSessionMetaTime(session) }}
                              </span>
                            </div>
                          </div>
                          <button
                            v-if="isShiftPressed"
                            type="button"
                            class="tree-action-button session-del danger"
                            title="Delete session permanently"
                            @mousedown.prevent.stop
                            @click.prevent.stop="
                              handleSessionDelete(
                                session.id,
                                sandbox.directory,
                                worktree.projectId,
                                close,
                              )
                            "
                          >
                            <Icon icon="lucide:trash-2" :width="16" :height="16" />
                          </button>
                          <button
                            v-else-if="session.archivedAt"
                            type="button"
                            class="tree-action-button session-del archive is-filled"
                            title="Unarchive"
                            @mousedown.prevent.stop
                            @click.prevent.stop="
                              handleSessionUnarchive(
                                session.id,
                                sandbox.directory,
                                worktree.projectId,
                              )
                            "
                          >
                            <Icon icon="lucide:archive" :width="16" :height="16" />
                          </button>
                          <button
                            v-else
                            type="button"
                            class="tree-action-button session-del archive"
                            title="Archive"
                            @mousedown.prevent.stop
                            @click.prevent.stop="
                              handleSessionArchive(
                                session.id,
                                sandbox.directory,
                                worktree.projectId,
                                close,
                              )
                            "
                          >
                            <Icon icon="lucide:archive" :width="16" :height="16" />
                          </button>
                        </DropdownItem>
                      </div>
                    </template>
                  </div>
                </div>
              </div>

              <div class="tree-footer">
                <button
                  type="button"
                  class="tree-footer-button"
                  @click="handleOpenDirectory(close)"
                >
                  <Icon icon="lucide:folder-open" :width="14" :height="14" />
                  Open project…
                </button>
              </div>
            </div>
          </template>
        </Dropdown>

        <div class="top-session-actions">
          <button
            type="button"
            class="top-icon-button new-session-button"
            :disabled="!canCreateSession"
            @click="$emit('new-session')"
            title="New session"
          >
            <Icon icon="lucide:notebook-pen" :width="16" :height="16" />
          </button>
          <button
            type="button"
            class="top-icon-button open-shell-button"
            :disabled="!canCreateSession"
            @click="$emit('open-shell')"
            title="Open shell"
          >
            <Icon icon="lucide:terminal" :width="16" :height="16" />
          </button>
        </div>
      </div>
      <div class="top-right">
        <button
          type="button"
          class="top-icon-button layout-button"
          :class="{ 'is-active': !sidePanelCollapsed }"
          :title="sidePanelCollapsed ? 'Show primary side bar' : 'Hide primary side bar'"
          @click="$emit('toggle-side-panel')"
        >
          <span class="layout-glyph layout-glyph-left" aria-hidden="true"></span>
        </button>
        <button
          type="button"
          class="top-icon-button layout-button"
          :class="{ 'is-active': !inputPanelCollapsed }"
          :title="inputPanelCollapsed ? 'Show input panel' : 'Hide input panel'"
          @click="$emit('toggle-input-panel')"
        >
          <span class="layout-glyph layout-glyph-bottom" aria-hidden="true"></span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import StatusDot from './StatusDot.vue';
import Dropdown from './Dropdown.vue';
import DropdownItem from './Dropdown/Item.vue';
import DropdownSearch from './Dropdown/Search.vue';
import { formatSessionTitle } from '../utils/formatters';
import { confirmAction } from '../composables/useConfirm';
import { MAX_VISIBLE_SESSIONS } from '../utils/sessionTree';
import { normalizeDirectory } from '../utils/path';
import type { SessionTarget } from '../types/session';

declare const __GIT_REVISION__: string;
const gitRevision = typeof __GIT_REVISION__ !== 'undefined' ? __GIT_REVISION__ : 'dev';

export type TopPanelSession = {
  id: string;
  title?: string;
  slug?: string;
  status: 'busy' | 'idle' | 'retry' | 'unknown';
  timeCreated?: number;
  timeUpdated?: number;
  archivedAt?: number;
};

export type TopPanelSandbox = {
  directory: string;
  branch?: string;
  sessions: TopPanelSession[];
};

export type TopPanelWorktree = {
  directory: string;
  label: string;
  name?: string;
  projectId?: string;
  sandboxes: TopPanelSandbox[];
};

export type TopPanelNotificationSession = {
  projectId: string;
  sessionId: string;
  count: number;
};

type SessionSelectPayload = {
  projectId?: string;
  worktree: string;
  directory: string;
  sessionId: string;
};

const props = defineProps<{
  treeData: TopPanelWorktree[];
  activeDirectory: string;
  focusedDirectory: string;
  selectedSessionId: string;
  homePath?: string;
  sidePanelCollapsed: boolean;
  inputPanelCollapsed: boolean;
}>();

const emit = defineEmits<{
  (event: 'select-session', payload: SessionSelectPayload): void;
  (event: 'select-directory', payload: { projectId?: string; worktree: string; directory: string }): void;
  (event: 'new-session'): void;
  (event: 'delete-active-directory', value: string): void;
  (event: 'delete-session', payload: SessionTarget): void;
  (event: 'archive-session', payload: SessionTarget): void;
  (event: 'unarchive-session', payload: SessionTarget): void;
  (event: 'open-directory'): void;
  (event: 'open-shell'): void;
  (event: 'toggle-side-panel'): void;
  (event: 'toggle-input-panel'): void;
  (event: 'dropdown-closed'): void;
}>();

const treeDropdownOpen = ref(false);

watch(treeDropdownOpen, (open) => {
  if (open) {
    searchQuery.value = '';
  }
  if (!open) emit('dropdown-closed');
});

const searchQuery = ref('');
const isShiftPressed = ref(false);
const expandedSandboxKeys = ref(new Set<string>());
const showArchivedKeys = ref(new Set<string>());

const currentDirectory = computed(
  () => props.focusedDirectory.trim() || props.activeDirectory.trim(),
);

const canCreateSession = computed(() => Boolean(currentDirectory.value));

const selectedDisplay = computed(() => {
  const directory = currentDirectory.value;
  if (!directory) return null;
  const match = findDirectoryMatch(directory);
  const pathName = formatPathLabel(
    match?.kind === 'sandbox'
      ? match.sandbox.directory
      : match?.kind === 'worktree'
        ? match.worktree.directory
        : directory,
  );
  const branch =
    match?.kind === 'sandbox'
      ? match.sandbox.branch?.trim() || ''
      : match?.kind === 'worktree'
        ? match.worktree.sandboxes.find(
            (item) =>
              normalizeDirectory(item.directory) === normalizeDirectory(match.worktree.directory),
          )?.branch?.trim() || ''
        : '';
  return { pathName, branch };
});

const dropdownLabel = computed(() => selectedDisplay.value?.pathName || 'Select path');

const displayedTree = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  let worktrees = props.treeData;

  if (query) {
    worktrees = worktrees
      .map((worktree) => {
        const worktreeMatches = matchesQuery(
          query,
          worktree.directory,
          worktree.label,
          worktree.name,
        );
        const sandboxes = worktree.sandboxes
          .map((sandbox) => {
            const sandboxMatches = matchesQuery(query, sandbox.directory, sandbox.branch);
            const sessions = sandbox.sessions.filter(
              (session) =>
                worktreeMatches ||
                sandboxMatches ||
                matchesQuery(
                  query,
                  session.title,
                  session.slug,
                  session.id,
                  session.archivedAt ? 'archived' : undefined,
                  session.timeCreated ? formatSessionTime(session.timeCreated) : undefined,
                  session.timeUpdated ? formatSessionTime(session.timeUpdated) : undefined,
                ),
            );
            if (!worktreeMatches && !sandboxMatches && sessions.length === 0) return null;
            return {
              ...sandbox,
              sessions: worktreeMatches || sandboxMatches ? sandbox.sessions : sessions,
            };
          })
          .filter((sandbox): sandbox is TopPanelSandbox => sandbox !== null);

        if (!worktreeMatches && sandboxes.length === 0) return null;
        return { ...worktree, sandboxes };
      })
      .filter((worktree): worktree is TopPanelWorktree => worktree !== null);
  }

  return worktrees.map((worktree) => ({
    ...worktree,
    sandboxes: worktree.sandboxes
      .filter((sandbox) => worktree.projectId !== 'global' || sandbox.sessions.length > 0)
      .map((sandbox) => {
        const active = sandbox.sessions.filter((session) => !session.archivedAt);
        const archived = sandbox.sessions.filter((session) => session.archivedAt);
        const showArchived =
          Boolean(query) || isArchivedShown(worktree.directory, sandbox.directory);
        return {
          ...sandbox,
          sessions: showArchived
            ? [...active.slice(0, MAX_VISIBLE_SESSIONS), ...archived.slice(0, MAX_VISIBLE_SESSIONS)]
            : active.slice(0, MAX_VISIBLE_SESSIONS),
        };
      }),
  }));
});

function sandboxKey(worktreeDirectory: string, sandboxDirectory: string) {
  return `${worktreeDirectory}\0${sandboxDirectory}`;
}

function isSandboxExpanded(worktreeDirectory: string, sandboxDirectory: string) {
  if (searchQuery.value.trim()) return true;
  return expandedSandboxKeys.value.has(sandboxKey(worktreeDirectory, sandboxDirectory));
}

function toggleSandbox(worktreeDirectory: string, sandboxDirectory: string) {
  const key = sandboxKey(worktreeDirectory, sandboxDirectory);
  const next = new Set(expandedSandboxKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedSandboxKeys.value = next;
}

function sandboxHasArchived(worktreeDirectory: string, sandboxDirectory: string) {
  const worktree = props.treeData.find((item) => item.directory === worktreeDirectory);
  const sandbox = worktree?.sandboxes.find((item) => item.directory === sandboxDirectory);
  return Boolean(sandbox?.sessions.some((session) => session.archivedAt));
}

function isArchivedShown(worktreeDirectory: string, sandboxDirectory: string) {
  return showArchivedKeys.value.has(sandboxKey(worktreeDirectory, sandboxDirectory));
}

function toggleShowArchived(worktreeDirectory: string, sandboxDirectory: string) {
  const key = sandboxKey(worktreeDirectory, sandboxDirectory);
  const next = new Set(showArchivedKeys.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
    const expanded = new Set(expandedSandboxKeys.value);
    expanded.add(key);
    expandedSandboxKeys.value = expanded;
  }
  showArchivedKeys.value = next;
}

function matchesQuery(query: string, ...fields: (string | undefined)[]) {
  const terms = query.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return false;
  return terms.every((term) => fields.some((field) => field?.toLowerCase().includes(term)));
}

function sessionShareHref(projectId: string | undefined, sessionId: string) {
  const params = new URLSearchParams();
  const normalizedProjectId = projectId?.trim() ?? '';
  const normalizedSessionId = sessionId.trim();
  if (normalizedProjectId) params.set('project', normalizedProjectId);
  if (normalizedSessionId) params.set('session', normalizedSessionId);
  return `?${params.toString()}`;
}

function shortenPath(path: string) {
  const homePath = props.homePath || '';
  if (homePath && path.startsWith(homePath)) {
    const replaced = path.replace(homePath, '~');
    return replaced || '~';
  }
  return path;
}

function formatPathLabel(path: string) {
  const shortened = shortenPath(path);
  if (!shortened || shortened === '/') return '/';
  return shortened.endsWith('/') ? shortened : `${shortened}/`;
}

function worktreeGroupLabel(worktree: TopPanelWorktree) {
  if (worktree.projectId === 'global' || worktree.directory === '/') return 'Global';
  return worktree.name || directoryBasename(worktree.directory);
}

function directoryBasename(path: string) {
  return path.replace(/\/+$/, '').split('/').pop() ?? '';
}

function isCurrentDirectory(directory: string) {
  const current = normalizeDirectory(currentDirectory.value);
  return Boolean(current) && normalizeDirectory(directory) === current;
}

function findDirectoryMatch(directory: string) {
  const normalized = normalizeDirectory(directory);
  if (!normalized) return null;
  for (const worktree of props.treeData) {
    for (const sandbox of worktree.sandboxes) {
      if (normalizeDirectory(sandbox.directory) === normalized) {
        return { kind: 'sandbox' as const, worktree, sandbox };
      }
    }
    if (normalizeDirectory(worktree.directory) === normalized) {
      return { kind: 'worktree' as const, worktree };
    }
  }
  return null;
}

function formatSessionTime(timestamp: number) {
  const d = new Date(timestamp);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${Y}-${M}-${D} ${h}:${m}`;
}

function formatSessionMetaTime(session: TopPanelSession) {
  const created = session.timeCreated ? formatSessionTime(session.timeCreated) : undefined;
  const updated = session.timeUpdated ? formatSessionTime(session.timeUpdated) : undefined;
  if (created && updated) {
    return `Created: ${created} / Updated: ${updated}`;
  }
  if (created) return `Created: ${created}`;
  if (updated) return `Updated: ${updated}`;
  return '';
}

function canDeleteSandbox(directory: string, worktreeDirectory: string) {
  const normalizedDirectory = directory.replace(/\/+$/, '');
  const normalizedWorktree = worktreeDirectory.replace(/\/+$/, '');
  return normalizedDirectory !== normalizedWorktree;
}

function handleSelectDirectory(
  directory: string,
  worktree: TopPanelWorktree,
  close: () => void,
) {
  emit('select-directory', {
    projectId: worktree.projectId,
    worktree: worktree.directory,
    directory,
  });
  close();
}

function onTreeSelect(payload: unknown) {
  if (!payload || typeof payload !== 'object') return;
  const value = payload as Partial<SessionSelectPayload>;
  if (!value.worktree || !value.directory || !value.sessionId) return;
  emit('select-session', {
    projectId: value.projectId,
    worktree: value.worktree,
    directory: value.directory,
    sessionId: value.sessionId,
  });
}

async function handleSandboxDelete(directory: string, _worktree: string, close?: () => void) {
  const confirmed = await confirmAction({
    title: 'Delete this path?',
    message: 'Removes it from HEX. Files on disk and existing chats stay as they are.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  emit('delete-active-directory', directory);
  close?.();
}

async function handleSessionDelete(
  sessionId: string,
  directory: string,
  projectId: string | undefined,
  close?: () => void,
) {
  const confirmed = await confirmAction({
    title: 'Delete session?',
    message: 'This chat will be removed. Files on disk are not deleted.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!confirmed) return;
  emit('delete-session', { sessionId, directory, projectId });
  close?.();
}

function handleSessionArchive(
  sessionId: string,
  directory: string,
  projectId: string | undefined,
  close?: () => void,
) {
  emit('archive-session', { sessionId, directory, projectId });
  close?.();
}

function handleSessionUnarchive(
  sessionId: string,
  directory: string,
  projectId: string | undefined,
) {
  emit('unarchive-session', { sessionId, directory, projectId });
}

function handleGlobalKeydown(event: KeyboardEvent) {
  isShiftPressed.value = event.shiftKey;
}

function handleGlobalKeyup(event: KeyboardEvent) {
  isShiftPressed.value = event.shiftKey;
}

function resetShiftState() {
  isShiftPressed.value = false;
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
  window.addEventListener('keyup', handleGlobalKeyup);
  window.addEventListener('blur', resetShiftState);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  window.removeEventListener('keyup', handleGlobalKeyup);
  window.removeEventListener('blur', resetShiftState);
});

function handleOpenDirectory(close: () => void) {
  emit('open-directory');
  close();
}
</script>

<style scoped>
.top-panel {
  position: relative;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 8px 12px 6px;
  box-sizing: border-box;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.top-left {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #f1f5f9;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 32px;
}

.brand-hex,
.brand-word {
  display: block;
  height: 32px;
  overflow: hidden;
  flex-shrink: 0;
}

.brand-hex {
  width: 30px;
}

.brand-word {
  width: 40px;
}

.brand-hex img,
.brand-word img {
  height: 32px;
  width: 72px;
  max-width: none;
  object-fit: fill;
}

.brand-word img {
  margin-left: -32.5px;
}

.brand-logo-dark {
  display: block;
}

.brand-logo-light {
  display: none;
}

:global(html[data-theme='light']) .brand-logo-dark {
  display: none;
}

:global(html[data-theme='light']) .brand-logo-light {
  display: block;
}

.brand-tagline {
  position: relative;
  top: 1px;
  font-weight: 400;
  white-space: nowrap;
}

.top-center {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.top-session-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.top-right {
  flex: 0 0 auto;
  display: flex;
  justify-content: flex-end;
  gap: 2px;
}

.tree-dropdown-root {
  flex: 0 1 680px;
  width: min(680px, 70vw);
  min-width: 260px;
}

.tree-menu {
  display: flex;
  flex-direction: column;
  background: transparent;
  flex: 1 1 auto;
  min-height: 0;
}

.tree-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-bottom: 1px solid #2b2b2b;
  background: #1f1f1f;
}

.search-icon {
  width: 14px;
  height: 14px;
  color: #9d9d9d;
}

.tree-search :deep(.ui-dropdown-search-input) {
  border-radius: 8px;
  font-size: 12px;
  padding: 6px 8px;
}

.tree-search :deep(.ui-dropdown-search-input):focus {
  background: #252526;
  border-color: #0078d4;
}

.clear-search {
  border: none;
  background: transparent;
  color: #9d9d9d;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}

.tree-content {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
  padding: 6px 0;
}

.tree-worktree + .tree-worktree {
  border-top: 1px solid #2b2b2b;
}

.tree-empty {
  padding: 14px;
  text-align: center;
  color: #9d9d9d;
  font-size: 12px;
}

.tree-worktree-header,
.tree-sandbox-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.tree-header-main {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  column-gap: 4px;
  min-width: 0;
  flex: 1 1 auto;
}

.tree-header-icon {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  color: #9d9d9d;
}

.tree-worktree-header {
  padding: 6px 8px 2px;
  cursor: default;
  border-radius: 6px;
}

.tree-sandbox-header:hover {
  background: rgba(255, 255, 255, 0.04);
}

.tree-sandbox-header.is-current {
  background: rgba(255, 255, 255, 0.08);
}

.tree-sandbox-header {
  padding: 5px 8px 5px 16px;
  border-radius: 6px;
}

.tree-expand-button {
  flex: 0 0 auto;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #9d9d9d;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.12s ease;
}

.tree-expand-button:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #cccccc;
}

.tree-expand-button.is-open {
  transform: rotate(90deg);
}

.tree-path-select {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex: 1 1 auto;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.tree-path-select:hover .tree-label-name {
  color: #e6e6e6;
}

.tree-label {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 auto;
  gap: 1px;
}

.tree-label-name {
  font-size: 12px;
  color: #cccccc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-label-type {
  font-size: 10px;
  color: #9d9d9d;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  min-width: 24px;
}

.tree-action-button {
  border: 0;
  border-radius: 6px;
  background: transparent;
  box-shadow: none;
  color: #cccccc;
  font-size: 10px;
  line-height: 1;
  width: 24px;
  height: 24px;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.tree-action-button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.tree-action-button.danger {
  color: #fca5a5;
}

.tree-action-button.show-archived {
  color: #4ade80;
}

.tree-action-button.show-archived.is-on {
  background: rgba(74, 222, 128, 0.16);
}

.tree-action-button.archive {
  color: #c4b5fd;
}

.tree-action-button.archive.is-filled :deep(svg),
.tree-action-button.archive.is-filled :deep(path) {
  fill: currentColor;
}

/* Session rows: wrapper provides indentation via :deep() */
.tree-session-row :deep(.ui-dropdown-item) {
  padding-left: 40px;
  border-radius: 7px;
  color: #cccccc;
}

.tree-session-row :deep(.ui-dropdown-item:hover) {
  background: rgba(255, 255, 255, 0.08);
}

.tree-session-row :deep(.ui-dropdown-item.is-active) {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid transparent;
}

/* ===== Tree branch connectors ===== */

/* --- Worktree → Sandbox branches --- */
.tree-sandbox {
  position: relative;
}

/* Non-last sandbox: ├── (vertical line continues to next sibling) */
.tree-sandbox:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 0;
  bottom: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  pointer-events: none;
}

.tree-sandbox:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 15px;
  top: 13px;
  width: 7px;
  height: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  pointer-events: none;
}

/* Last sandbox: └── (L-shape, no line below) */
.tree-sandbox:last-child::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 0;
  width: 7px;
  height: 13px;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  border-bottom-left-radius: 4px;
  pointer-events: none;
}

/* --- Sandbox → Session branches --- */
.tree-session-row {
  position: relative;
}

/* Non-last session: ├── */
.tree-session-row:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 31px;
  top: 0;
  bottom: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: none;
}

.tree-session-row:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 31px;
  top: 14px;
  width: 7px;
  height: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: none;
}

/* Last session: └── */
.tree-session-row:last-child::before {
  content: '';
  position: absolute;
  left: 31px;
  top: 0;
  width: 7px;
  height: 14px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  border-bottom-left-radius: 4px;
  pointer-events: none;
}

.tree-session-main {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  column-gap: 8px;
  row-gap: 1px;
  flex: 1 1 auto;
}

.session-status-icon {
  flex: 0 0 6px;
  width: 6px;
  height: 6px;
  min-width: 6px;
  min-height: 6px;
}

.session-title {
  color: #cccccc;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.session-info {
  display: contents;
}

.session-info-top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1 1 auto;
}

.session-time {
  font-size: 10px;
  color: #9d9d9d;
  white-space: nowrap;
  flex-basis: 100%;
}

.session-del {
  flex: 0 0 auto;
  margin-left: auto;
}

.tree-footer {
  flex: 0 0 auto;
  border-top: 1px solid #2b2b2b;
  padding: 8px;
  background: #1f1f1f;
}

.tree-footer-button {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid #2b2b2b;
  border-radius: 8px;
  background: #252526;
  color: #cccccc;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}

.tree-footer-button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.control-button {
  border: 1px solid #2b2b2b;
  border-radius: 8px;
  background: #1f1f1f;
  color: #cccccc;
  padding: 6px 12px;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.new-session-button {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  padding: 0;
  justify-content: center;
  color: #5ba3f5;
}

.new-session-button:hover,
.open-shell-button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.open-shell-button {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  padding: 0;
  justify-content: center;
  color: #c4b5fd;
}

.top-icon-button:disabled {
  opacity: 0.6;
  cursor: default;
}

.tree-dropdown-root :deep(.ui-dropdown-button) {
  background: transparent;
  border-color: transparent;
  color: #cccccc;
  box-shadow: none;
}

.tree-dropdown-root :deep(.ui-dropdown-button:hover) {
  background: rgba(255, 255, 255, 0.08);
}

.tree-dropdown-root :deep(.ui-dropdown-menu) {
  background: #1f1f1f;
  border: 1px solid #2b2b2b;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
}

.selected-label {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.selected-status-icon {
  flex: 0 0 auto;
  width: 14px;
  text-align: center;
  font-size: 12px;
  line-height: 1;
}

.selected-title {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.selected-branch-badge {
  flex: 0 0 auto;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  border-radius: 999px;
  padding: 2px 6px;
  color: #9d9d9d;
  background: transparent;
  font-size: 11px;
  line-height: 1;
}

.control-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.top-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  box-shadow: none;
  cursor: pointer;
}

.layout-button {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border-radius: 6px;
  color: #9d9d9d;
}

.layout-button:hover {
  background: rgba(255, 255, 255, 0.08);
}

.layout-glyph {
  --layout-glyph: #9d9d9d;
  position: relative;
  width: 14px;
  height: 14px;
  box-sizing: border-box;
  border: 1px solid var(--layout-glyph);
  border-radius: 3px;
  overflow: hidden;
}

.layout-glyph::before,
.layout-glyph::after {
  content: '';
  position: absolute;
  background: var(--layout-glyph);
}

.layout-glyph::before {
  opacity: 0;
}

.layout-button.is-active .layout-glyph::before {
  opacity: 1;
}

.layout-glyph-left::before {
  top: 0;
  bottom: 0;
  left: 0;
  width: 50%;
}

.layout-glyph-left::after {
  top: 0;
  bottom: 0;
  left: calc(50% - 1px);
  width: 1px;
}

.layout-glyph-bottom::before {
  left: 0;
  right: 0;
  bottom: 0;
  height: 50%;
}

.layout-glyph-bottom::after {
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
}

@media (max-width: 768px) {
  .top-panel {
    padding: 6px 8px;
  }

  .top-row,
  .top-center {
    gap: 4px;
  }

  .brand-mark {
    height: 28px;
    gap: 8px;
  }

  .brand-hex,
  .brand-word {
    height: 28px;
  }

  .brand-hex {
    width: 26px;
  }

  .brand-word {
    width: 35px;
  }

  .brand-hex img,
  .brand-word img {
    height: 28px;
    width: 63px;
  }

  .brand-word img {
    margin-left: -29px;
  }

  .tree-dropdown-root {
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
  }
}

@media (max-width: 560px) {
  .open-shell-button {
    display: none;
  }
}
</style>
