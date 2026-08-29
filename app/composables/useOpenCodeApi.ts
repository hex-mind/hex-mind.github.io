import { computed, isRef, ref, type Ref } from 'vue';
import * as opencodeApi from '../utils/opencode';
import { waitForState } from '../utils/waitForState';
import type { ProjectState, SessionState } from '../types/worker-state';

type ProjectsMap = Record<string, ProjectState>;

type SessionInfo = {
  id: string;
  projectID: string;
  parentID?: string;
  title?: string;
  slug?: string;
  status?: 'busy' | 'idle' | 'retry';
  directory?: string;
  time?: {
    created?: number;
    updated?: number;
    archived?: number;
  };
};

function normalizeId(value: string | undefined): string {
  return value?.trim() ?? '';
}

function findSession(
  project: ProjectState | undefined,
  sessionId: string,
): SessionState | undefined {
  if (!project) return undefined;
  const target = normalizeId(sessionId);
  if (!target) return undefined;
  for (const sandbox of Object.values(project.sandboxes)) {
    const session = sandbox.sessions[target];
    if (session) return session;
  }
  return undefined;
}

function hasSandbox(project: ProjectState | undefined, directory: string): boolean {
  if (!project) return false;
  return Boolean(project.sandboxes[directory]);
}

export function useOpenCodeApi(projects: ProjectsMap | Ref<ProjectsMap>) {
  const pendingCount = ref(0);
  const pending = computed(() => pendingCount.value > 0);

  const getProjects = (): ProjectsMap => (isRef(projects) ? projects.value : projects);

  async function waitWithRetry(predicate: (projects: ProjectsMap) => boolean, timeoutMs = 30_000) {
    try {
      await waitForState(getProjects, predicate, timeoutMs);
      return;
    } catch {
      try {
        await waitForState(getProjects, predicate, timeoutMs);
        return;
      } catch {
        window.location.reload();
        throw new Error('State synchronization failed after retry. Reload requested.');
      }
    }
  }

  async function withPending<T>(runner: () => Promise<T>): Promise<T> {
    pendingCount.value += 1;
    try {
      return await runner();
    } finally {
      pendingCount.value = Math.max(0, pendingCount.value - 1);
    }
  }

  function requireProjectId(projectId: string): string {
    const normalized = normalizeId(projectId);
    if (!normalized) {
      throw new Error('Project ID is required for SSE-confirmed operations.');
    }
    return normalized;
  }

  async function createSession(directory: string): Promise<SessionInfo> {
    return withPending(async () => {
      const session = (await opencodeApi.createSession(directory)) as SessionInfo;
      if (!session?.id) {
        throw new Error('Session create failed: invalid response.');
      }
      const effectiveProjectId = normalizeId(session.projectID);
      if (!effectiveProjectId) {
        throw new Error('Session create failed: missing projectID.');
      }
      const sessionId = normalizeId(session.id);
      await waitWithRetry((state) => Boolean(findSession(state[effectiveProjectId], sessionId)));
      return session;
    });
  }

  async function patchSessionArchive(
    payload: { sessionId: string; projectId: string; directory?: string },
    archivedAt: number,
    failedLabel: string,
    isDone: (session: SessionState | undefined) => boolean,
  ): Promise<SessionInfo> {
    return withPending(async () => {
      const projectId = requireProjectId(payload.projectId);
      const session = (await opencodeApi.updateSession(
        payload.sessionId,
        { time: { archived: archivedAt } },
        payload.directory,
      )) as SessionInfo;
      if (!session?.id) {
        throw new Error(`${failedLabel}: invalid response.`);
      }
      await waitWithRetry((state) => isDone(findSession(state[projectId], payload.sessionId)));
      return session;
    });
  }

  async function archiveSession(payload: {
    sessionId: string;
    projectId: string;
    directory?: string;
    archivedAt?: number;
  }): Promise<SessionInfo> {
    return patchSessionArchive(
      payload,
      payload.archivedAt ?? Date.now(),
      'Session archive failed',
      (current) =>
        Boolean(current && typeof current.timeArchived === 'number' && current.timeArchived > 0),
    );
  }

  async function unarchiveSession(payload: {
    sessionId: string;
    projectId: string;
    directory?: string;
  }): Promise<SessionInfo> {
    return patchSessionArchive(payload, 0, 'Session unarchive failed', (current) =>
      Boolean(current && !(typeof current.timeArchived === 'number' && current.timeArchived > 0)),
    );
  }

  async function renameSession(payload: {
    sessionId: string;
    projectId: string;
    directory?: string;
    title: string;
  }): Promise<SessionInfo> {
    return withPending(async () => {
      const projectId = requireProjectId(payload.projectId);
      const title = payload.title.trim();
      if (!title) {
        throw new Error('Session rename failed: title is empty.');
      }
      const session = (await opencodeApi.updateSession(
        payload.sessionId,
        { title },
        payload.directory,
      )) as SessionInfo;
      if (!session?.id) {
        throw new Error('Session rename failed: invalid response.');
      }
      await waitWithRetry((state) => {
        const current = findSession(state[projectId], payload.sessionId);
        return Boolean(current && (current.title || '').trim() === title);
      });
      return session;
    });
  }

  async function deleteSession(payload: {
    sessionId: string;
    projectId: string;
    directory?: string;
  }): Promise<void> {
    return withPending(async () => {
      const projectId = requireProjectId(payload.projectId);
      await opencodeApi.deleteSession(payload.sessionId, payload.directory);
      await waitWithRetry((state) => !findSession(state[projectId], payload.sessionId));
    });
  }

  async function revertSession(payload: {
    sessionId: string;
    messageId: string;
    projectId: string;
    directory?: string;
  }): Promise<void> {
    return withPending(async () => {
      const projectId = requireProjectId(payload.projectId);
      const before = findSession(getProjects()[projectId], payload.sessionId);
      const beforeUpdated = before?.timeUpdated ?? 0;
      await opencodeApi.revertSession(payload.sessionId, payload.messageId, payload.directory);
      await waitWithRetry((state) => {
        const current = findSession(state[projectId], payload.sessionId);
        return Boolean(current && (current.timeUpdated ?? 0) > beforeUpdated);
      });
    });
  }

  async function unrevertSession(payload: {
    sessionId: string;
    projectId: string;
    directory?: string;
  }): Promise<SessionInfo> {
    return withPending(async () => {
      const projectId = requireProjectId(payload.projectId);
      const before = findSession(getProjects()[projectId], payload.sessionId);
      const beforeUpdated = before?.timeUpdated ?? 0;
      const session = (await opencodeApi.unrevertSession(
        payload.sessionId,
        payload.directory,
      )) as SessionInfo;
      await waitWithRetry((state) => {
        const current = findSession(state[projectId], payload.sessionId);
        return Boolean(current && (current.timeUpdated ?? 0) > beforeUpdated);
      });
      return session;
    });
  }

  async function deleteWorktree(payload: {
    directory: string;
    targetDirectory: string;
    projectId: string;
  }): Promise<void> {
    return withPending(async () => {
      const projectId = requireProjectId(payload.projectId);
      const targetDirectory = payload.targetDirectory.trim();
      await opencodeApi.deleteWorktree(payload.directory, targetDirectory);
      await waitWithRetry((state) => !hasSandbox(state[projectId], targetDirectory));
    });
  }

  return {
    pending,
    createSession,
    archiveSession,
    unarchiveSession,
    renameSession,
    deleteSession,
    revertSession,
    unrevertSession,
    deleteWorktree,
  };
}
