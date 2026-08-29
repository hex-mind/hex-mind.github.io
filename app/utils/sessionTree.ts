export const MAX_VISIBLE_SESSIONS = 5;

export function takeActiveSessions<T extends { archivedAt?: number }>(
  sessions: T[],
  max = MAX_VISIBLE_SESSIONS,
): T[] {
  return sessions.filter((session) => !session.archivedAt).slice(0, max);
}

export function toNavigableSessionTree<
  W extends {
    projectId?: string;
    sandboxes: Array<{ sessions: Array<{ archivedAt?: number }> }>;
  },
>(worktrees: W[], maxSessions = MAX_VISIBLE_SESSIONS): W[] {
  return worktrees
    .map((worktree) => ({
      ...worktree,
      sandboxes: worktree.sandboxes
        .map((sandbox) => ({
          ...sandbox,
          sessions: takeActiveSessions(sandbox.sessions, maxSessions),
        }))
        .filter((sandbox) => worktree.projectId !== 'global' || sandbox.sessions.length > 0),
    }))
    .filter((worktree) => worktree.sandboxes.some((sandbox) => sandbox.sessions.length > 0));
}
