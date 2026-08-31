<template>
  <span class="status-dot" :data-status="resolved" :title="label" aria-hidden="true"></span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type StatusDotKind = 'idle' | 'busy' | 'retry' | 'standby';

const props = withDefaults(
  defineProps<{
    status?: string;
  }>(),
  { status: 'standby' },
);

const resolved = computed<StatusDotKind>(() => {
  if (props.status === 'busy') return 'busy';
  if (props.status === 'retry') return 'retry';
  if (props.status === 'idle') return 'idle';
  return 'standby';
});

const label = computed(() => {
  if (resolved.value === 'busy') return 'Thinking';
  if (resolved.value === 'retry') return 'Retrying';
  if (resolved.value === 'idle') return 'Idle';
  return 'Standby';
});
</script>

<style scoped>
.status-dot {
  width: 6px;
  height: 6px;
  min-width: 6px;
  min-height: 6px;
  aspect-ratio: 1;
  border-radius: 50%;
  flex: 0 0 6px;
  display: inline-block;
  box-sizing: border-box;
  background: #6b7280;
}

.status-dot[data-status='idle'] {
  background: #34d399;
}

.status-dot[data-status='busy'] {
  background: #60a5fa;
}

.status-dot[data-status='retry'] {
  background: #f87171;
}

.status-dot[data-status='standby'] {
  background: #6b7280;
}
</style>
