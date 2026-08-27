<template>
  <div class="shell-content">
    <div class="xterm-host" :data-shell-id="shellId"></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  shellId: string;
}>();
</script>

<style scoped>
.shell-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.xterm-host {
  flex: 1;
  min-height: 0;
}

.xterm-host :deep(.xterm) {
  height: 100%;
}

.xterm-host :deep(.xterm-viewport) {
  overflow: auto;
}
</style>
