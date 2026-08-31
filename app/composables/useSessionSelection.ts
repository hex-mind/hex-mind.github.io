import { computed, ref, type Ref } from 'vue';
import type { ProjectState } from '../types/worker-state';
import { waitForState } from '../utils/waitForState';

function getProjectSessionIds(project: ProjectState): string[] {
  const ids: string[] = [];
  Object.values(project.sandboxes).forEach((sandbox) => {
    ids.push(...sandbox.rootSessions);
  });
  return Array.from(new Set(ids));
}

function findMostRecentSession(
  projects: Record<string, ProjectState>,
): { projectId: string; sessionId: string } | null {
  let best: { projectId: string; sessionId: string; time: number } | null = null;

  for (const [projectId, project] of Object.entries(projects)) {
    for (const sandbox of Object.values(project.sandboxes)) {
      for (const session of Object.values(sandbox.sessions)) {
        if (session.parentID) continue;
        if (session.timeArchived) continue;
        const time = session.timeUpdated ?? session.timeCreated ?? 0;
        if (!best || time > best.time) {
          best = { projectId, sessionId: session.id, time };
        }
      }
    }
  }

  return best;
}

export function useSessionSelection(projects: Ref<Record<string, ProjectState>>) {
  const selectedProjectId = ref<string>('');
  const selectedSessionId = ref<string>('');

  const projectMap = computed(() => projects.value);

  const project = computed(() => projectMap.value[selectedProjectId.value]);

  const activeDirectory = computed(() => {
    const currentProject = projectMap.value[selectedProjectId.value];
    const sessionId = selectedSessionId.value;
    if (!currentProject || !sessionId) return currentProject?.worktree ?? '';
    for (const sandbox of Object.values(currentProject.sandboxes)) {
      if (sandbox.sessions[sessionId]) return sandbox.directory;
    }
    return currentProject.worktree;
  });

  const projectDirectory = computed(() => project.value?.worktree ?? '');

  async function ensureSession(projectIdHint?: string): Promise<string> {
    const map = projectMap.value;
    let projectId = projectIdHint?.trim() || selectedProjectId.value.trim();

    if (!projectId || !map[projectId]) {
      const recent = findMostRecentSession(map);
      if (recent) {
        selectedProjectId.value = recent.projectId;
        selectedSessionId.value = recent.sessionId;
        return recent.sessionId;
      }
      projectId = Object.keys(map)[0] ?? '';
    }

    if (!projectId || !map[projectId]) {
      selectedSessionId.value = '';
      return '';
    }

    const targetProject = map[projectId];
    const ids = getProjectSessionIds(targetProject);
    if (ids.length > 0) {
      const sessionId = ids[0] ?? '';
      if (sessionId) {
        selectedProjectId.value = projectId;
        selectedSessionId.value = sessionId;
        return sessionId;
      }
    }

    selectedProjectId.value = projectId;
    selectedSessionId.value = '';
    return '';
  }

  async function switchSession(projectId: string, sessionId: string, timeoutMs = 30_000) {
    const nextProjectId = projectId.trim();
    const nextSessionId = sessionId.trim();
    if (!nextProjectId || !nextSessionId) {
      await ensureSession(nextProjectId);
      return;
    }

    await waitForState(
      () => projectMap.value,
      (projects) => {
        const nextProject = projects[nextProjectId];
        if (!nextProject) return false;
        return Object.values(nextProject.sandboxes).some((sandbox) =>
          Boolean(sandbox.sessions[nextSessionId]),
        );
      },
      timeoutMs,
    );

    selectedProjectId.value = nextProjectId;
    selectedSessionId.value = nextSessionId;
  }

  async function initialize() {
    if (selectedSessionId.value) return selectedSessionId.value;
    return ensureSession();
  }

  return {
    selectedProjectId,
    selectedSessionId,
    project,
    activeDirectory,
    projectDirectory,
    switchSession,
    ensureSession,
    initialize,
  };
}
