<template>
  <div class="bookmarks-body">
    <div v-if="sessions.length === 0" class="bookmarks-empty">{{ emptyText }}</div>
    <ul v-else class="bookmarks-list">
      <li
        v-for="session in sessions"
        :key="session.sessionId"
        class="bookmark-item"
        :class="{ 'is-selected': session.isSelected, 'is-unavailable': !session.available }"
      >
        <button
          type="button"
          class="bookmark-item-main"
          :disabled="!session.available"
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
            <span class="bookmark-item-title">{{ session.title }}</span>
            <span v-if="sessionMeta(session)" class="bookmark-item-meta">{{
              sessionMeta(session)
            }}</span>
          </span>
        </button>
        <button
          v-if="!hideRemove"
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
import { Icon } from '@iconify/vue';

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
};

withDefaults(
  defineProps<{
    sessions: BookmarkedSessionView[];
    icon?: string;
    emptyText?: string;
    hideRemove?: boolean;
  }>(),
  {
    icon: 'lucide:bookmark',
    emptyText: 'No saved sessions.',
    hideRemove: false,
  },
);

defineEmits<{
  (event: 'select-session', session: BookmarkedSessionView): void;
  (event: 'remove-bookmark', sessionId: string): void;
}>();

function sessionMeta(session: BookmarkedSessionView) {
  const parts = [session.projectName, session.branch].filter(Boolean);
  if (!session.available) parts.push('unavailable');
  return parts.join(' · ');
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
}

.bookmark-item-title {
  font-size: 12px;
  font-weight: 600;
  color: #cccccc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bookmark-item-meta {
  font-size: 10px;
  color: #9d9d9d;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
