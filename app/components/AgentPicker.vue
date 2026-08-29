<template>
  <div class="agent-picker-root">
    <Dropdown
      :model-value="modelValue"
      :placeholder="hasOptions ? 'Select agent' : 'Loading agents...'"
      :disabled="disabled || !hasOptions"
      button-class="chrome-select-button agent-picker-button"
      popup-class="agent-picker-popup"
      :placement="placement"
      :menu-icon="placement === 'top' ? 'lucide:chevron-up' : 'lucide:chevron-down'"
      auto-close
      :title="title"
      @update:model-value="onSelect"
      @update:open="(open) => emit('update:open', open)"
    >
      <template #value="{ value: id }">
        <span class="agent-value-name" :style="agentValueStyle(id)">{{
          findAgent(id)?.label
        }}</span>
      </template>
      <template #default>
        <div class="dropdown-list">
          <div v-if="!hasOptions" class="dropdown-empty">Loading agents...</div>
          <DropdownItem v-for="agent in options" :key="agent.id" :value="agent.id">
            <span
              class="agent-dropdown-name"
              :class="{
                'is-build': agent.id.toLowerCase() === 'build',
                'is-plan': agent.id.toLowerCase() === 'plan',
              }"
              :style="agentOptionNameStyle(agent)"
            >
              {{ agent.label }}
            </span>
          </DropdownItem>
        </div>
      </template>
    </Dropdown>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Dropdown from './Dropdown.vue';
import DropdownItem from './Dropdown/Item.vue';
import { useSettings } from '../composables/useSettings';

export type AgentOption = {
  id: string;
  label: string;
  description?: string;
  color?: string;
};

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    options: AgentOption[];
    disabled?: boolean;
    placement?: 'top' | 'bottom';
    title?: string;
    resolveAgentColor?: (agent?: string) => string;
  }>(),
  {
    modelValue: '',
    disabled: false,
    placement: 'top',
    title: 'Agent',
  },
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'update:open', open: boolean): void;
}>();

const { theme } = useSettings();
const hasOptions = computed(() => props.options.length > 0);

function findAgent(id: unknown): AgentOption | undefined {
  if (id == null) return undefined;
  return props.options.find((agent) => agent.id === id);
}

function resolveAgentStyle(name?: string, explicitColor?: string) {
  const normalizedName = name?.toLowerCase();
  if (normalizedName === 'build') {
    return { color: theme.value === 'light' ? '#2563eb' : '#60a5fa' };
  }
  if (normalizedName === 'plan') {
    return { color: theme.value === 'light' ? '#b45309' : '#f59e0b' };
  }
  const color = explicitColor || props.resolveAgentColor?.(name);
  return color ? { color } : undefined;
}

function agentValueStyle(id: unknown) {
  const agent = findAgent(id);
  return resolveAgentStyle(agent?.id, agent?.color);
}

function agentOptionNameStyle(agent: AgentOption) {
  return resolveAgentStyle(agent.id, agent.color);
}

function onSelect(value: unknown) {
  if (typeof value === 'string') emit('update:modelValue', value);
}
</script>

<style scoped>
.agent-picker-root {
  min-width: 0;
}

.agent-picker-root :deep(.ui-dropdown) {
  width: 100%;
}

.agent-picker-button {
  width: 100%;
  height: 28px;
  padding: 4px 8px;
  font-size: 11px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}

.agent-picker-popup {
  max-height: 280px;
  outline: none;
}

.agent-value-name {
  font-size: 12px;
  white-space: nowrap;
}

.dropdown-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dropdown-empty {
  padding: 6px 8px;
  font-size: 12px;
  color: #9d9d9d;
}

.agent-dropdown-name {
  font-size: 12px;
  color: #cccccc;
  line-height: 1.2;
}
</style>
