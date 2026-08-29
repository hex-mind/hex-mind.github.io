<template>
  <div class="ib-footer">
    <span class="ib-footer-meta">
      <span v-if="timestamp" class="ib-meta-item">
        <Icon icon="lucide:clock" :width="10" :height="10" />
        {{ timestamp }}
      </span>
      <span v-if="elapsed" class="ib-meta-item">
        <Icon icon="lucide:timer" :width="10" :height="10" />
        {{ elapsed }}
      </span>
      <span
        v-if="contextPercent != null"
        class="ib-meta-item"
        :class="contextSeverityClass(contextPercent)"
      >
        <Icon icon="lucide:gauge" :width="10" :height="10" />
        {{ contextPercent }}%
      </span>
      <span v-if="tokens" class="ib-meta-item ib-meta-tokens">
        <span class="ib-token-in" title="Input tokens"
          ><Icon icon="lucide:arrow-up" :width="9" :height="9" />{{
            formatTokenCount(tokens.input)
          }}</span
        >
        <span class="ib-token-out" title="Output tokens"
          ><Icon icon="lucide:arrow-down" :width="9" :height="9" />{{
            formatTokenCount(tokens.output)
          }}</span
        >
        <span class="ib-token-reason" title="Reasoning tokens"
          ><Icon icon="lucide:brain" :width="9" :height="9" />{{
            formatTokenCount(tokens.reasoning)
          }}</span
        >
      </span>
    </span>
    <span class="ib-footer-actions">
      <button
        v-if="hasDiffs"
        type="button"
        class="ib-action"
        title="View changes"
        aria-label="View changes"
        @click="$emit('show-diff')"
      >
        <Icon icon="lucide:file-diff" :width="14" :height="14" />
      </button>
      <button
        v-if="canCopyAnswer"
        type="button"
        class="ib-action"
        :title="copied ? 'Answer copied' : 'Copy answer'"
        :aria-label="copied ? 'Answer copied' : 'Copy answer'"
        @click="$emit('copy-answer')"
      >
        <Icon :icon="copied ? 'lucide:check' : 'lucide:copy'" :width="14" :height="14" />
      </button>
      <button
        v-if="historyCount > 0"
        type="button"
        class="ib-action"
        :title="`View history (${historyCount})`"
        aria-label="View history"
        @click="$emit('show-history')"
      >
        <Icon icon="lucide:history" :width="14" :height="14" />
        <span class="ib-action-count">{{ historyCount }}</span>
      </button>
      <button
        v-if="canRevert"
        type="button"
        class="ib-action"
        title="Restore checkpont"
        aria-label="Restore checkpont"
        @click="$emit('revert')"
      >
        <Icon icon="lucide:undo-2" :width="14" :height="14" />
      </button>
    </span>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
import type { MessageTokens } from '../types/message';
import { contextSeverityClass, formatTokenCount } from '../utils/formatters';

defineProps<{
  timestamp: string;
  elapsed: string;
  contextPercent: number | null;
  tokens: MessageTokens | null;
  hasDiffs: boolean;
  canCopyAnswer: boolean;
  copied: boolean;
  historyCount: number;
  canRevert: boolean;
}>();

defineEmits<{
  (event: 'show-diff'): void;
  (event: 'copy-answer'): void;
  (event: 'show-history'): void;
  (event: 'revert'): void;
}>();
</script>

<style scoped>
.ib-footer {
  display: flex;
  flex-direction: row-reverse;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.ib-footer-meta {
  font-size: 10px;
  color: rgba(148, 163, 184, 0.7);
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  display: inline-flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

.ib-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.ib-meta-tokens {
  gap: 6px;
}

.ib-token-in,
.ib-token-out,
.ib-token-reason {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}

.ib-ctx-low {
  color: rgba(96, 165, 250, 0.7);
}

.ib-ctx-moderate {
  color: rgba(251, 191, 36, 0.8);
}

.ib-ctx-high {
  color: rgba(249, 115, 22, 0.85);
}

.ib-ctx-critical {
  color: rgba(248, 113, 113, 0.9);
}

.ib-footer-actions {
  display: flex;
  gap: 4px;
  flex: 0 0 auto;
}

.ib-action {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #94a3b8;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.ib-action:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
}

.ib-action-danger {
  color: #f87171;
}

.ib-action-danger:hover {
  background: rgba(127, 29, 29, 0.35);
  color: #fca5a5;
}

.ib-action-count {
  font-size: 9px;
  line-height: 1;
}
</style>
