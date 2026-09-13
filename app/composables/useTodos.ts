import { ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import * as opencodeApi from '../utils/opencode';
import { addedKeys } from '../utils/requestGuards';

export type TodoItem = {
  content: string;
  status: string;
  priority: string;
};

export type TodoSession = {
  sessionId: string;
  title: string;
  isSubagent: boolean;
  todos: TodoItem[];
  loading: boolean;
  error: string | undefined;
};

export function useTodos(options: {
  selectedSessionId: Ref<string>;
  allowedSessionIds: ComputedRef<Set<string>>;
  activeDirectory: Ref<string>;
}) {
  const todosBySessionId = ref<Record<string, TodoItem[]>>({});
  const todoLoadingBySessionId = ref<Record<string, boolean>>({});
  const todoErrorBySessionId = ref<Record<string, string>>({});
  let todoReloadRequestId = 0;

  function normalizeTodoItem(value: unknown): TodoItem | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const content = typeof record.content === 'string' ? record.content.trim() : '';
    const status = typeof record.status === 'string' ? record.status.trim() : '';
    const priority = typeof record.priority === 'string' ? record.priority.trim() : '';
    if (!content) return null;
    return { content, status: status || 'pending', priority: priority || 'medium' };
  }

  function normalizeTodoItems(value: unknown) {
    if (!Array.isArray(value)) return [] as TodoItem[];
    return value
      .map((item) => normalizeTodoItem(item))
      .filter((item): item is TodoItem => Boolean(item));
  }

  async function reloadTodosForAllowedSessions() {
    const requestId = ++todoReloadRequestId;
    const sessionId = options.selectedSessionId.value;
    const sessionIds = sessionId ? Array.from(options.allowedSessionIds.value) : [];
    if (sessionIds.length === 0) {
      todosBySessionId.value = {};
      todoLoadingBySessionId.value = {};
      todoErrorBySessionId.value = {};
      return;
    }
    const directory = options.activeDirectory.value.trim() || undefined;
    const previous = todosBySessionId.value;
    const nextTodos: Record<string, TodoItem[]> = {};
    const nextErrors: Record<string, string> = {};
    for (const id of sessionIds) {
      if (id in previous) nextTodos[id] = previous[id] ?? [];
      const error = todoErrorBySessionId.value[id];
      if (error) nextErrors[id] = error;
    }
    const added = addedKeys(Object.keys(previous), sessionIds);
    if (added.length === 0) {
      todosBySessionId.value = nextTodos;
      todoErrorBySessionId.value = nextErrors;
      todoLoadingBySessionId.value = {};
      return;
    }
    const loading: Record<string, boolean> = {};
    added.forEach((id) => {
      loading[id] = true;
    });
    todoLoadingBySessionId.value = loading;
    await Promise.all(
      added.map(async (id) => {
        try {
          const data = await opencodeApi.getSessionTodos(id, directory);
          nextTodos[id] = normalizeTodoItems(data);
        } catch (error) {
          nextTodos[id] = [];
          nextErrors[id] = error instanceof Error ? error.message : String(error);
        }
      }),
    );
    if (requestId !== todoReloadRequestId) return;
    todoLoadingBySessionId.value = {};
    todoErrorBySessionId.value = nextErrors;
    todosBySessionId.value = nextTodos;
  }

  return {
    todosBySessionId,
    todoLoadingBySessionId,
    todoErrorBySessionId,
    normalizeTodoItems,
    reloadTodosForAllowedSessions,
  };
}
