<script setup lang="ts">
import CodeContent from '../CodeContent.vue';

defineProps<{
  html: string;
}>();
</script>

<template>
  <CodeContent :html="html" variant="code" />
</template>
