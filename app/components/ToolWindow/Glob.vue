<script setup lang="ts">
import CodeContent from '../CodeContent.vue';

defineProps<{
  html: string;
  status?: string;
  pattern?: string;
  path?: string;
  include?: string;
}>();
</script>

<template>
  <div v-if="status === 'running'" class="tool-placeholder">
    <div v-if="pattern">Pattern: {{ pattern }}</div>
    <div v-if="path">Directory: {{ path }}</div>
    <div v-if="include">Include: {{ include }}</div>
    <div v-if="!pattern && !path && !include">Running...</div>
  </div>
  <CodeContent v-else :html="html" variant="term" />
</template>

<style scoped>
.tool-placeholder {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #94a3b8;
  padding: 4px;
  white-space: pre-wrap;
}
</style>
