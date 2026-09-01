# Projects & Sessions

## Data Model

The session graph uses a **directory-first tree model**:

```
Worktree (project root)
 └─ Sandbox (directory)
     ├─ projectID (session namespace, assigned from session.created)
     ├─ branch (VCS branch name)
     └─ Sessions
         ├─ Session (root)
         │   └─ Session (child)  ← subagent sessions
         └─ Session (root)
```

### Tree Structure

The primary data structure is a nested map keyed by **project id**, then sandbox directory:

```typescript
projects: Record<projectId, ProjectState>;

type ProjectState = {
  id: string;
  worktree: string;
  sandboxes: Record<directory, SandboxState>;
};

type SandboxState = {
  directory: string;
  name: string; // VCS branch
  rootSessions: string[];
  sessions: Record<sessionId, SessionState>;
};
```

**Key insight**: Directory is the first-class citizen for UI selection. ProjectID is a session namespace assigned by OpenCode.

### Worktree

The project root directory, selected via the top-left dropdown. Typically the root of a git repository.

- Example: `/home/user/prog/hex`
- The API exposes this as `ProjectInfo.worktree`.
- Maps to `projects[id]` (worktree) and `projects[id].sandboxes` in the session graph.

### Sandbox

A directory under a worktree. Can be:

- The worktree itself (`sandbox == worktree`)
- A git worktree (`/path/to/.git/worktrees/...`)
- A sandbox directory (`ProjectInfo.sandboxes[]`)

- Example: `/home/user/prog/hex`, `/home/user/.local/share/opencode/worktree/.../neon-canyon`
- Passed to the API as `?directory=` query parameter or `x-opencode-directory` header.
- Maps to `projects[id].sandboxes[directory]` in the session graph.

### ProjectID

An identifier assigned by OpenCode to each project (SHA hash string). **Only assigned from `session.created` SSE events.**

- Example: `95c06a8380e966d762e14efc434b1111b7169ab7`
- Stored as `ProjectState.id`. Sandboxes under that project share it.
- Multiple sandboxes under the same worktree can belong to different project IDs.

### Session

A conversation session belonging to a specific sandbox (and thus a specific projectID).

- Sessions without a `parentID` are **root sessions**, shown in Recents and in the top-bar path dropdown (`>`).
- Sessions with a `parentID` are **child sessions**, created by subagents.

With no root session selected, the main column is the welcome composer. Path select and **New session** do not create a session.

## API and Directory

Most API calls require a `?directory=` parameter or `x-opencode-directory` header to specify the directory. Without it, the server defaults to its startup working directory, which is not robust.

### Building the Tree from APIs

The session graph is built from two primary APIs:

| API                        | Purpose                                            | Tree Update                                                                        |
| -------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /project`             | List all projects with worktrees and sandboxes     | `stateBuilder.applyProjects` creates `projects[id]` and sandbox directories |
| `GET /session?directory=X` | List sessions for a directory                      | `stateBuilder.applySessions` fills sandbox session maps                     |

**Important**: The `/project` API returns `projectID`, but this is **unreliable** for tree building. Only use the `worktree` and `sandboxes` fields. ProjectID is assigned only from `session.created` SSE events.

### Enumerating Sandboxes

A single worktree may have multiple sandboxes:

- The worktree itself (`ProjectInfo.worktree`)
- Git worktrees and other sandbox paths (`ProjectInfo.sandboxes[]`)

These lists come from `GET /project` (plus sessions discovered during bootstrap). HEX only **deletes** worktrees (`DELETE /experimental/worktree`); it does not list them via a separate GET.

## SSE Events

`GET /global/event` delivers events across all projects in a single stream.

Session-related events:

| Event             | Key Fields                                                               | Tree Update                                                                                                      |
| ----------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `session.created` | `info.id`, `info.projectID`, `info.directory`                            | **ONLY source of projectID**: create/update project + sandbox, insert session |
| `session.updated` | `info.id`, `info.projectID`, `info.directory`, `info.title`, `info.time` | Update session metadata                                                       |
| `session.status`  | `sessionID`, `status.type` (`busy` / `idle` / `retry`)                   | Update session status                                                         |
| `session.deleted` | `sessionID`                                                              | Remove session                                                                |
| `project.updated` | `id`, `worktree`, `sandboxes[]`                                          | Sync sandboxes under the project. **Ignore using `id` as a directory.**       |
| `worktree.ready`  | `directory`, `branch`                                                    | Set sandbox `name` (branch)                                                   |

**Critical**: Only `session.created` carries a reliable `projectID`. Use it to assign the projectID to the sandbox. Other events should not attempt to resolve or assign projectID.

## Session graph (worker)

The graph lives in the SharedWorker. Types: `app/types/worker-state.ts`. Mutations: `app/utils/stateBuilder.ts`. SSE bootstrap and incremental updates: `app/workers/sse-shared-worker.ts`. The tab keeps a reactive copy via `useServerState` (`projects`, `notifications`, `bootstrapped`). Top bar, Recents, and bookmarks read that copy. They do not each re-fetch `/session`.

There is no `sessionGraph.ts` / `sessionGraphStore`.

### Session fields

| Field         | Description                                                        |
| ------------- | ------------------------------------------------------------------ |
| `id`          | Session ID (`ses_...`)                                             |
| `parentID`    | Parent session ID (`undefined` for root sessions)                  |
| `directory`   | Owning sandbox directory                                           |
| `status`      | `busy` / `idle` / `retry`                                          |
| `timeArchived`| Set when the user archives the session                             |

Child/descendant sessions are stored under the **root session's sandbox**. `rootSessions` is display order (newest `timeUpdated` first).

`stateBuilder` keeps indexes:

- `projectIdByDirectory` — directory → project id
- `sessionLocationById` — session id → `{ projectId, directory }`

### Builder API (worker-only)

Used by `sse-shared-worker.ts`, not by Vue components:

- `applyProjects` / `applySessions` / `applyStatuses` / `applyVcsInfo` — bootstrap
- `processSessionCreated` / `Updated` / `Deleted` / `Status` / `processProjectUpdated` / `processVcsBranchUpdated` — SSE
- `registerSandboxDirectory`, `applySessionMutated`, `applySessionRemoved`
- `getState`, `getProject`, `resolveProjectIdForDirectory`, `resolveRootSessionIdForProject`, `isSessionTreeIdle`

### UI state (App.vue)

Computed from `useServerState().projects`:

| State                 | Purpose                                      |
| --------------------- | -------------------------------------------- |
| `focusedDirectory`    | Path the user selected (writable)            |
| `activeDirectory`     | Path of the selected session, if any         |
| `workingDirectory`    | `focusedDirectory \|\| activeDirectory`      |
| `selectedSessionId`   | Selected session (writable via selection)    |
| `selectedProjectId`   | Derived from the selected session / path     |

### Fetching flow

```
1. Worker bootstrap
   a. GET /project → applyProjects
   b. listSessions + session/status for default instance + those worktrees/sandboxes
   c. One extra round of directories discovered from those sessions
   d. GET /vcs for that set
   e. Broadcast state.bootstrap
2. Tab goes ready (path + session selection). History/providers/git continue in background.
3. SSE (real-time)
   a. project.updated → processProjectUpdated
   b. session.created → processSessionCreated
   c. session.status → processSessionStatus
   d. worktree.ready / vcs.branch.updated → branch on sandbox
4. Remembered localStorage directories lazy-sync after bootstrap (not on splash).
```

Selecting a path does not create a session. **New session** clears `selectedSessionId` and stays on the path (welcome composer). Send creates the session. Deleting the current session stays on that path.

