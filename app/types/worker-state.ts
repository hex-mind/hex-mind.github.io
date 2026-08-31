// ---------------------------------------------------------------------------
// Worker State Type Definitions
// ---------------------------------------------------------------------------
// Canonical SSOT for the worker session graph (project → sandbox → sessions).
// The tab holds a reactive copy via useServerState; mutations live in stateBuilder.
//
// Key design decisions:
// - All child/descendant sessions are placed under the root session's sandbox
// - rootSessions array maintains display order (sorted by timeUpdated desc)
// - SessionState.status is the individual session's own status
// ---------------------------------------------------------------------------

/**
 * Individual session state.
 * Represents a single conversation session with metadata about its lifecycle.
 */
export type SessionState = {
  id: string;
  title?: string;
  slug?: string;
  parentID?: string;
  status?: 'busy' | 'idle' | 'retry';
  directory?: string;
  timeCreated?: number;
  timeUpdated?: number;
  timeArchived?: number;
  revert?: {
    messageID: string;
    partID?: string;
    snapshot?: string;
    diff?: string;
  };
};

/**
 * Sandbox state within a project.
 * A sandbox represents a VCS branch/worktree with its sessions.
 * All child sessions are stored under the root session's sandbox.
 */
export type SandboxState = {
  directory: string;
  name: string; // VCS branch name
  rootSessions: string[]; // ordered root session IDs for display
  sessions: Record<string, SessionState>; // flat: root + all descendants
};

/**
 * Project state.
 * Represents a project with its worktree and multiple sandboxes.
 */
export type ProjectState = {
  id: string;
  name?: string;
  icon?: {
    url?: string;
    override?: string;
    color?: string;
  };
  commands?: {
    start?: string;
  };
  time?: {
    created?: number;
    updated?: number;
    initialized?: number;
  };
  worktree: string; // primary worktree directory
  sandboxes: Record<string, SandboxState>; // keyed by directory
};

/**
 * Server state.
 * Root state containing all projects.
 */
export type ServerState = {
  projects: Record<string, ProjectState>;
};

export type WorkerNotificationEntry = {
  projectId: string;
  sessionId: string;
  requestIds: string[];
};
