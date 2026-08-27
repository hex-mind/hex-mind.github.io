<script setup lang="ts">
import CodeContent from '../CodeContent.vue';

defineProps<{
  html: string;
  status?: string;
  tool?: string;
  url?: string;
  query?: string;
}>();
</script>

<template>
  <div v-if="status === 'running'" class="tool-placeholder">
    <div v-if="url">URL: {{ url }}</div>
    <div v-if="query">Query: {{ query }}</div>
    <div v-if="!url && !query">{{ tool === 'webfetch' ? 'Fetching...' : 'Searching...' }}</div>
  </div>
  <CodeContent v-else :html="html" variant="plain" />
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
