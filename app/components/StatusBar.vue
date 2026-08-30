<template>
  <div class="statusbar" role="status" aria-live="polite">
    <div class="statusbar-section statusbar-left">
      <StatusDot :status="isRetryStatus ? 'retry' : thinkingStatus" />
      <span class="statusbar-text">{{ thinkingDisplayText }}</span>
    </div>
    <div
      class="statusbar-section statusbar-right"
      :class="{ 'is-error': isStatusError, 'is-retry': isRetryStatus }"
    >
      {{ statusText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import StatusDot from './StatusDot.vue';

withDefaults(
  defineProps<{
    thinkingDisplayText: string;
    thinkingStatus?: string;
    statusText: string;
    isStatusError: boolean;
    isRetryStatus: boolean;
  }>(),
  { thinkingStatus: 'idle' },
);
</script>

<style scoped>
.statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 20px;
  margin-top: 8px;
  padding: 4px 4px 8px;
  border-top: none;
  background: transparent;
  color: #94a3b8;
  font-size: 8pt;
  line-height: 1.2;
  border-radius: 0;
  box-sizing: border-box;
}

.statusbar-section {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.statusbar-right {
  margin-left: auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.statusbar-right.is-error,
.statusbar-right.is-retry {
  color: #fecaca;
}
</style>
