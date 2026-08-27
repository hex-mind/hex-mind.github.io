<template>
  <div class="hex-renderer-root">
    <CodeContent :html="rawHtml || ''" variant="binary" />
  </div>
</template>

<script setup lang="ts">
import CodeContent from '../CodeContent.vue';

defineProps<{
  rawHtml?: string;
}>();
</script>

<style scoped>
.hex-renderer-root {
  height: 100%;
  overflow: auto;
}
</style>
