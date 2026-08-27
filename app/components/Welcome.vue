<template>
  <div class="welcome-content">
    <MessageViewer :code="markdown" lang="markdown" :theme="theme" />
  </div>
</template>

<script setup lang="ts">
import MessageViewer from './MessageViewer.vue';

defineProps<{
  theme: string;
}>();

const origin = window.location.origin;

const markdown = `\
# How To Use \`HEX for opencode\`

Start the OpenCode server with CORS enabled:

\`\`\`bash
opencode serve --cors ${origin}
\`\`\`

or add this to your \`.config/opencode/opencode.json\`:

\`\`\`json
{
  "$schema": "https://opencode.ai/config.json",
  "server": {
    "cors": ["${origin}"]
  }
}
\`\`\`
and then:
\`\`\`bash
opencode serve
\`\`\`
`;
</script>

<style scoped>
.welcome-content {
  text-align: left;
  font-size: 12px;
  line-height: 1.5;
  color: #94a3b8;
}
</style>
