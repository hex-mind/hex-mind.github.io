<template>
  <div class="bookmarks-body">
    <div v-if="sessions.length === 0" class="bookmarks-empty">{{ emptyText }}</div>
    <div v-else class="bookmarks-scroll">
      <section v-for="group in sessionGroups" :key="group.id" class="bookmarks-group">
        <div v-if="group.label" class="bookmarks-group-label">{{ group.label }}</div>
        <ul class="bookmarks-list">
          <li
            v-for="session in group.sessions"
            :key="session.sessionId"
            class="bookmark-item"
            :class="{
              'is-selected': session.isSelected,
              'is-unavailable': !session.available,
              'is-menu-open': menuOpenId === session.sessionId,
              'is-pinned': Boolean(session.pinned),
            }"
          >
            <button
              type="button"
              class="bookmark-item-main"
              :class="{ 'has-icon': !hideIcon }"
              :disabled="!session.available || renamingId === session.sessionId"
              :title="session.available ? session.title : 'Session is no longer available'"
              @click="$emit('select-session', session)"
            >
              <Icon
                v-if="!hideIcon"
                :icon="icon"
                class="bookmark-item-icon"
                :class="{ 'is-filled': icon === 'lucide:bookmark' }"
                :width="14"
                :height="14"
              />
              <span class="bookmark-item-text">
                <input
                  v-if="renamingId === session.sessionId"
                  ref="renameInput"
                  v-model="renameDraft"
                  class="bookmark-item-rename"
                  @click.stop
                  @keydown.enter.prevent="commitRename(session)"
                  @keydown.esc.prevent="cancelRename"
                  @blur="commitRename(session)"
                />
                <span v-else class="bookmark-item-title-row">
                  <span class="bookmark-item-title">{{ session.title }}</span>
                  <span
                    v-if="session.hasNotification"
                    class="bookmark-item-mark"
                    title="Pending message"
                  ></span>
                </span>
                <span v-if="sessionMeta(session)" class="bookmark-item-meta">{{
                  sessionMeta(session)
                }}</span>
              </span>
            </button>
            <div v-if="showSessionMenu && session.available" class="bookmark-item-actions">
              <button
                v-if="session.pinned"
                type="button"
                class="bookmark-item-action is-pin"
                title="Unpin chat"
                @click.stop="$emit('toggle-pin', session)"
              >
                <Icon icon="lucide:pin" :width="13" :height="13" />
              </button>
              <Dropdown
                :open="menuOpenId === session.sessionId"
                class="bookmark-item-menu"
                align="start"
                auto-close
                :auto-highlight="false"
                @update:open="(open) => setMenuOpen(session.sessionId, open)"
                @select="(value) => onMenuSelect(session, value)"
              >
                <template #trigger>
                  <button
                    type="button"
                    class="bookmark-item-action"
                    title="More"
                    @click.stop="setMenuOpen(session.sessionId, menuOpenId !== session.sessionId)"
                  >
                    <Icon icon="lucide:ellipsis" :width="14" :height="14" />
                  </button>
                </template>
                <DropdownItem value="rename">
                  <span class="session-menu-item">
                    <Icon icon="lucide:pencil" :width="14" :height="14" />
                    Rename
                  </span>
                </DropdownItem>
                <div class="session-menu-divider" />
                <DropdownItem value="pin">
                  <span class="session-menu-item">
                    <Icon icon="lucide:pin" :width="14" :height="14" />
                    {{ session.pinned ? 'Unpin chat' : 'Pin chat' }}
                  </span>
                </DropdownItem>
                <DropdownItem value="archive">
                  <span class="session-menu-item">
                    <Icon icon="lucide:archive" :width="14" :height="14" />
                    Archive
                  </span>
                </DropdownItem>
                <DropdownItem value="delete">
                  <span class="session-menu-item is-danger">
                    <Icon icon="lucide:trash-2" :width="14" :height="14" />
                    Delete
                  </span>
                </DropdownItem>
              </Dropdown>
            </div>
            <button
              v-else-if="!hideRemove"
              type="button"
              class="bookmark-item-remove"
              title="Remove saved session"
              @click="$emit('remove-bookmark', session.sessionId)"
            >
              <Icon icon="lucide:x" :width="13" :height="13" />
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { confirmAction } from '../composables/useConfirm';
import Dropdown from './Dropdown.vue';
import DropdownItem from './Dropdown/Item.vue';

export type BookmarkedSessionView = {
  sessionId: string;
  projectId: string;
  worktree: string;
  directory: string;
  title: string;
  branch?: string;
  projectName?: string;
  available: boolean;
  isSelected: boolean;
  pinned?: boolean;
  timeUpdated?: number;
  hasNotification?: boolean;
};

const MS_DAY = 24 * 60 * 60 * 1000;

const props = withDefaults(
  defineProps<{
    sessions: BookmarkedSessionView[];
    icon?: string;
    emptyText?: string;
    hideRemove?: boolean;
    hideIcon?: boolean;
    showSessionMenu?: boolean;
    groupByTime?: boolean;
  }>(),
  {
    icon: 'lucide:bookmark',
    emptyText: 'No saved sessions.',
    hideRemove: false,
    hideIcon: false,
    showSessionMenu: false,
    groupByTime: false,
  },
);

const emit = defineEmits<{
  (event: 'select-session', session: BookmarkedSessionView): void;
  (event: 'remove-bookmark', sessionId: string): void;
  (event: 'rename-session', payload: { session: BookmarkedSessionView; title: string }): void;
  (event: 'toggle-pin', session: BookmarkedSessionView): void;
  (event: 'archive-session', session: BookmarkedSessionView): void;
  (event: 'delete-session', session: BookmarkedSessionView): void;
}>();

const menuOpenId = ref('');
const renamingId = ref('');
const renameDraft = ref('');
const renameInput = ref<HTMLInputElement | HTMLInputElement[] | null>(null);

type SessionGroup = {
  id: string;
  label: string;
  sessions: BookmarkedSessionView[];
};

function startOfLocalDay(ms: number) {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function recencyBucket(
  timeUpdated: number | undefined,
  now: number,
): 'today' | 'week' | 'month' | 'older' {
  const today = startOfLocalDay(now);
  const weekAgo = today - 7 * MS_DAY;
  const monthAgo = today - 30 * MS_DAY;
  const time = typeof timeUpdated === 'number' && timeUpdated > 0 ? timeUpdated : 0;
  if (time >= today) return 'today';
  if (time >= weekAgo) return 'week';
  if (time >= monthAgo) return 'month';
  return 'older';
}

const sessionGroups = computed((): SessionGroup[] => {
  if (!props.groupByTime) {
    return [{ id: 'all', label: '', sessions: props.sessions }];
  }
  const now = Date.now();
  const groups: SessionGroup[] = [
    { id: 'pinned', label: 'Pinned', sessions: [] },
    { id: 'today', label: 'Today', sessions: [] },
    { id: 'week', label: '7 days', sessions: [] },
    { id: 'month', label: '30 days', sessions: [] },
    { id: 'older', label: 'Older', sessions: [] },
  ];
  for (const session of props.sessions) {
    if (session.pinned) {
      groups[0].sessions.push(session);
      continue;
    }
    const bucket = recencyBucket(session.timeUpdated, now);
    if (bucket === 'today') groups[1].sessions.push(session);
    else if (bucket === 'week') groups[2].sessions.push(session);
    else if (bucket === 'month') groups[3].sessions.push(session);
    else groups[4].sessions.push(session);
  }
  return groups.filter((group) => group.sessions.length > 0);
});

function sessionMeta(session: BookmarkedSessionView) {
  const parts = [session.projectName, session.branch].filter(Boolean);
  if (!session.available) parts.push('unavailable');
  return parts.join(' · ');
}

function setMenuOpen(sessionId: string, open: boolean) {
  menuOpenId.value = open ? sessionId : menuOpenId.value === sessionId ? '' : menuOpenId.value;
}

function startRename(session: BookmarkedSessionView) {
  renamingId.value = session.sessionId;
  renameDraft.value = session.title;
  void nextTick(() => {
    focusRenameInput();
  });
}

function cancelRename() {
  renamingId.value = '';
  renameDraft.value = '';
}

function commitRename(session: BookmarkedSessionView) {
  if (renamingId.value !== session.sessionId) return;
  const title = renameDraft.value.trim();
  cancelRename();
  if (!title || title === session.title) return;
  emit('rename-session', { session, title });
}

function onMenuSelect(session: BookmarkedSessionView, value: unknown) {
  if (value === 'rename') {
    startRename(session);
    return;
  }
  if (value === 'pin') {
    emit('toggle-pin', session);
    return;
  }
  if (value === 'archive') {
    emit('archive-session', session);
    return;
  }
  if (value === 'delete') {
    void confirmAction({
      title: 'Delete session?',
      message: 'This chat will be removed. Files on disk are not deleted.',
      confirmLabel: 'Delete',
      danger: true,
    }).then((confirmed) => {
      if (confirmed) emit('delete-session', session);
    });
  }
}

function focusRenameInput() {
  const el = Array.isArray(renameInput.value) ? renameInput.value[0] : renameInput.value;
  el?.focus();
  el?.select();
}
</script>

<style scoped>
.bookmarks-body {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.bookmarks-empty {
  margin: auto;
  color: rgba(148, 163, 184, 0.9);
  font-size: 12px;
}

.bookmarks-scroll {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bookmarks-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.bookmarks-group-label {
  padding: 2px 4px 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #9d9d9d;
}

.bookmarks-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
}

.bookmark-item {
  display: flex;
  align-items: stretch;
  gap: 2px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
}

.bookmark-item:hover,
.bookmark-item.is-menu-open {
  background: rgba(255, 255, 255, 0.08);
}

.bookmark-item.is-selected,
.bookmark-item.is-selected:hover,
.bookmark-item.is-selected.is-menu-open {
  background: rgba(255, 255, 255, 0.12);
}

.bookmark-item.is-unavailable {
  opacity: 0.7;
}

.bookmark-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.bookmark-item-main:not(.has-icon) {
  padding-left: 10px;
}

.bookmark-item-main:disabled {
  cursor: default;
}

.bookmark-item-icon {
  flex: 0 0 auto;
  margin-top: 1px;
  color: #9d9d9d;
}

.bookmark-item-icon.is-filled {
  color: #fbbf24;
}

.bookmark-item-icon.is-filled :deep(svg),
.bookmark-item-icon.is-filled :deep(path) {
  fill: currentColor;
}

.bookmark-item-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.bookmark-item-title-row {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.bookmark-item-title {
  min-width: 0;
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  color: #cccccc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bookmark-item-mark {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c084fc;
}

.bookmark-item-rename {
  width: 100%;
  min-width: 0;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  background: #181818;
  color: #cccccc;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  padding: 1px 6px;
  outline: none;
}

.bookmark-item-meta {
  font-size: 10px;
  color: #9d9d9d;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bookmark-item-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  gap: 0;
  padding: 4px 4px 0 0;
}

.bookmark-item-action {
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #9d9d9d;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
}

.bookmark-item-action.is-pin,
.bookmark-item:hover .bookmark-item-action,
.bookmark-item.is-selected .bookmark-item-action,
.bookmark-item.is-menu-open .bookmark-item-action {
  opacity: 1;
}

.bookmark-item-action:hover,
.bookmark-item-menu :deep(.ui-dropdown.is-open) .bookmark-item-action {
  background: rgba(255, 255, 255, 0.08);
  color: #cccccc;
}

.bookmark-item-action.is-pin :deep(svg),
.bookmark-item-action.is-pin :deep(path) {
  fill: currentColor;
}

.bookmark-item-menu {
  flex: 0 0 auto;
  min-width: 0;
}

.bookmark-item-menu :deep(.ui-dropdown) {
  flex: 0 0 auto;
  min-width: 0;
}

.bookmark-item-menu :deep(.ui-dropdown-menu) {
  width: max-content;
  min-width: 132px;
}

.session-menu-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #cccccc;
  font-size: 13px;
  white-space: nowrap;
}

.session-menu-item.is-danger {
  color: #f87171;
}

.session-menu-divider {
  height: 1px;
  margin: 4px 6px;
  background: #2b2b2b;
}

.bookmark-item-remove {
  flex: 0 0 auto;
  width: 28px;
  margin: 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.bookmark-item-remove:hover {
  background: rgba(248, 113, 113, 0.16);
  color: #fca5a5;
}
</style>
