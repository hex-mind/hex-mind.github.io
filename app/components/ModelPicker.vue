<template>
  <div class="model-picker-root">
    <Dropdown
      :model-value="modelValue"
      :placeholder="hasOptions ? 'Select model' : 'Loading models...'"
      :disabled="disabled || !hasOptions"
      button-class="chrome-select-button model-picker-button"
      popup-class="model-picker-popup"
      :placement="placement"
      :menu-icon="placement === 'top' ? 'lucide:chevron-up' : 'lucide:chevron-down'"
      auto-close
      :title="title"
      @update:model-value="onSelect"
      @update:open="onOpenChange"
    >
      <template #value="{ value: id }">
        <div class="model-button-label">
          <span
            v-if="findModelOption(id)?.providerLabel ?? findModelOption(id)?.providerID"
            class="model-button-provider"
            >{{ findModelOption(id)?.providerLabel ?? findModelOption(id)?.providerID }}</span
          >
          <span class="model-button-name">{{ findModelOption(id)?.displayName }}</span>
        </div>
      </template>
      <template #default>
        <div class="model-picker">
          <DropdownSearch v-model="searchQuery" placeholder="Search..." class="model-search" />
          <div class="model-picker-list">
            <div class="dropdown-list">
              <div v-if="!hasOptions" class="dropdown-empty">Loading models...</div>
              <div v-else-if="filteredGroups.length === 0" class="dropdown-empty">
                No matching models
              </div>
              <template v-for="group in filteredGroups" :key="group.providerID">
                <DropdownLabel>{{ group.label }}</DropdownLabel>
                <DropdownItem v-for="model in group.models" :key="model.id" :value="model.id">
                  <div class="model-dropdown-item">
                    <span class="model-dropdown-name">{{ model.displayName }}</span>
                    <span class="model-dropdown-path"
                      >{{ model.providerID }}/{{ model.modelID }}</span
                    >
                  </div>
                </DropdownItem>
              </template>
            </div>
          </div>
        </div>
      </template>
    </Dropdown>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Dropdown from './Dropdown.vue';
import DropdownItem from './Dropdown/Item.vue';
import DropdownLabel from './Dropdown/Label.vue';
import DropdownSearch from './Dropdown/Search.vue';

export type ModelOption = {
  id: string;
  modelID: string;
  displayName: string;
  label?: string;
  providerID?: string;
  providerLabel?: string;
};

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    options: ModelOption[];
    disabled?: boolean;
    placement?: 'top' | 'bottom';
    title?: string;
  }>(),
  {
    modelValue: '',
    disabled: false,
    placement: 'top',
    title: 'Model',
  },
);

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void;
  (event: 'update:open', open: boolean): void;
}>();

const searchQuery = ref('');

const hasOptions = computed(() => props.options.length > 0);

function findModelOption(id: unknown): ModelOption | undefined {
  if (id == null) return undefined;
  return props.options.find((model) => model.id === id);
}

const groupedOptions = computed(() => {
  const grouped = new Map<string, { providerID: string; label: string; models: ModelOption[] }>();
  props.options.forEach((model) => {
    const providerID = model.providerID?.trim() || 'unknown';
    const providerLabel = model.providerLabel?.trim() || providerID;
    const next = {
      ...model,
      displayName: model.displayName || model.label || model.modelID,
    };
    const existing = grouped.get(providerID);
    if (existing) {
      existing.models.push(next);
      return;
    }
    grouped.set(providerID, {
      providerID,
      label: providerLabel,
      models: [next],
    });
  });
  return Array.from(grouped.values());
});

function matchesQuery(query: string, ...fields: (string | undefined)[]) {
  const terms = query.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return false;
  return terms.every((term) => fields.some((field) => field?.toLowerCase().includes(term)));
}

const filteredGroups = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return groupedOptions.value;
  return groupedOptions.value
    .map((group) => {
      const models = group.models.filter((model) =>
        matchesQuery(query, model.displayName, model.modelID, model.providerID, group.label),
      );
      if (models.length === 0) return null;
      return { ...group, models };
    })
    .filter((group): group is NonNullable<typeof group> => group !== null);
});

function onSelect(value: unknown) {
  if (typeof value === 'string') emit('update:modelValue', value);
}

function onOpenChange(open: boolean) {
  if (open) searchQuery.value = '';
  emit('update:open', open);
}
</script>

<style scoped>
.model-picker-root {
  min-width: 0;
}

.model-picker-root :deep(.ui-dropdown) {
  width: 100%;
}

.model-picker-button {
  width: 100%;
  height: 28px;
  padding: 4px 8px;
  font-size: 11px;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
}

.model-picker-popup {
  max-height: 280px;
  outline: none;
  overflow: hidden;
}

.model-button-label {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  line-height: 1.15;
  text-align: left;
  align-self: flex-start;
}

.model-button-provider {
  position: fixed;
  font-size: 9px;
  color: #9d9d9d;
  white-space: nowrap;
  text-overflow: ellipsis;
  transform: translate(-3px, -11px);
}

.model-button-name {
  font-size: 12px;
  color: #cccccc;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-picker {
  display: flex;
  flex-direction: column;
  max-height: calc(280px - 12px);
  overflow: hidden;
  margin: -6px;
  padding: 6px;
}

.model-picker-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.model-search {
  flex: 0 0 auto;
  padding: 0 0 4px;
}

.model-search :deep(.ui-dropdown-search-input) {
  border-radius: 6px;
  font-size: 11px;
  font-family: inherit;
  padding: 4px 6px;
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

.model-dropdown-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  min-width: 0;
}

.model-dropdown-name {
  font-size: 12px;
  color: #cccccc;
  line-height: 1.2;
}

.model-dropdown-path {
  font-size: 10px;
  color: #9d9d9d;
  line-height: 1.2;
}
</style>
