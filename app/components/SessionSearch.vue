<template>
  <div class="session-search">
    <label class="search-field">
      <span class="sr-only">Search this chat</span>
      <input
        ref="inputRef"
        v-model="draft"
        type="search"
        placeholder="Search this chat"
        aria-label="Search this chat"
        autocomplete="off"
        spellcheck="false"
      />
      <Icon icon="lucide:search" :width="15" :height="15" />
    </label>
    <div v-if="query && hits.length === 0" class="search-empty">No matches</div>
    <ul v-else-if="query" class="search-list">
      <li v-for="hit in hits" :key="hit.id">
        <button type="button" class="search-hit" @click="$emit('select-hit', hit)">
          <span class="search-hit-label">{{ hit.label }}</span>
          <span class="search-hit-snippet">
            <template v-for="(part, index) in splitHighlight(hit.snippet, query)" :key="index">
              <mark v-if="part.hit">{{ part.text }}</mark>
              <template v-else>{{ part.text }}</template>
            </template>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useMessages } from '../composables/useMessages';
import {
  searchSessionSources,
  splitHighlight,
  toolSearchText,
  type SessionSearchHit,
  type SessionSearchSource,
} from '../utils/sessionSearch';

defineEmits<{
  (event: 'select-hit', hit: SessionSearchHit): void;
}>();

const msg = useMessages();
const draft = ref('');
const query = ref('');
const inputRef = ref<HTMLInputElement | null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

const sources = computed((): SessionSearchSource[] => {
  void msg.messages.value;
  const list: SessionSearchSource[] = [];
  for (const root of msg.roots.value) {
    for (const message of msg.getThread(root.id)) {
      const text = msg.getTextContent(message.id);
      if (text.trim()) {
        list.push({
          threadId: root.id,
          messageId: message.id,
          kind: message.role === 'user' ? 'user' : 'assistant',
          label: message.role === 'user' ? 'You' : 'Assistant',
          text,
          time: msg.getTime(message.id),
        });
      }
      for (const part of msg.getParts(message.id)) {
        if (part.type !== 'tool') continue;
        const toolText = toolSearchText(part.tool, part.state);
        if (!toolText.trim()) continue;
        list.push({
          threadId: root.id,
          messageId: message.id,
          kind: 'tool',
          label: part.tool,
          text: toolText,
          time: msg.getTime(message.id),
        });
      }
    }
  }
  return list;
});

const hits = computed(() => searchSessionSources(sources.value, query.value));

watch(draft, (value) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    query.value = value;
  }, 120);
});

onMounted(() => {
  void nextTick(() => inputRef.value?.focus());
});

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<style scoped>
.session-search {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 6px 12px 10px;
}

.search-field {
  height: 27px;
  flex: 0 0 27px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 7px;
  border: 1px solid #2b2b2b;
  border-radius: 8px;
  background: #181818;
  color: #9d9d9d;
}

.search-field:focus-within {
  border-color: #0078d4;
}

.search-field input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #cccccc;
  font: inherit;
  font-size: 13px;
}

.search-field input::placeholder {
  color: #64748b;
}

.search-empty {
  margin: auto;
  color: rgba(148, 163, 184, 0.9);
  font-size: 12px;
  text-align: center;
}

.search-list {
  min-height: 0;
  flex: 1;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.search-hit {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 7px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.search-hit:hover {
  background: rgba(255, 255, 255, 0.06);
}

.search-hit-label {
  color: #9d9d9d;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.search-hit-snippet {
  color: #cccccc;
  font-size: 12px;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.search-hit-snippet mark {
  padding: 0;
  background: rgba(0, 120, 212, 0.35);
  color: inherit;
  border-radius: 2px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
