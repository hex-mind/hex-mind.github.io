<template>
  <div class="bookmarks-body">
    <div v-if="sessions.length === 0" class="bookmarks-empty">{{ emptyText }}</div>
    <ul v-else class="bookmarks-list">
      <li
        v-for="session in sessions"
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
          :disabled="!session.available || renamingId === session.sessionId"
          :title="session.available ? session.title : 'Session is no longer available'"
          @click="$emit('select-session', session)"
        >
          <Icon
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
            <span v-else class="bookmark-item-title">{{ session.title }}</span>
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
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { Icon } from '@iconify/vue';
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
};

withDefaults(
  defineProps<{
    sessions: BookmarkedSessionView[];
    icon?: string;
    emptyText?: string;
    hideRemove?: boolean;
    showSessionMenu?: boolean;
  }>(),
  {
    icon: 'lucide:bookmark',
    emptyText: 'No saved sessions.',
    hideRemove: false,
    showSessionMenu: false,
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
    if (typeof window !== 'undefined' && !window.confirm('Delete session?')) return;
    emit('delete-session', session);
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

.bookmarks-list {
  list-style: none;
  margin: 0;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow: auto;
  min-height: 0;
}

.bookmark-item {
  display: flex;
  align-items: stretch;
  gap: 2px;
  border: 1px solid #2b2b2b;
  border-radius: 8px;
  background: #1f1f1f;
}

.bookmark-item.is-selected {
  border-color: #3c3c3c;
  background: #2b2b2b;
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

.bookmark-item-title {
  font-size: 12px;
  font-weight: 600;
  color: #cccccc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
