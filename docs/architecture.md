# HEX architecture

HEX is a browser client for a local OpenCode server. The UI never owns the agent runtime: OpenCode does sessions, tools, PTY, and the filesystem. HEX renders that state and sends user actions back over HTTP, SSE, and WebSocket.

Related docs: [README.md](./README.md), [API.md](./API.md), [SSE.md](./SSE.md), [projects.md](./projects.md), [window-arch.md](./window-arch.md), [prd-git-panel.md](./prd-git-panel.md), [tools/](./tools/). Agent working notes: [AGENTS.md](../AGENTS.md). OpenCode skills: [`.opencode/skills/`](../.opencode/skills/).

## Runtime pieces

```
Browser tab (Vue)
  ├── App.vue                 composition root (selection, send, shortcuts)
  ├── SharedWorker            one SSE connection per OpenCode base URL
  │     └── stateBuilder      project → sandbox → session graph
  ├── REST (opencode.ts)      /session, /file, /pty, /permission, …
  └── PTY WebSocket           interactive shells only
           │
           ▼
OpenCode  (opencode serve, default :4096)
```

Vite serves `app/`. Production can be GitHub Pages (`hex-mind.github.io`) or `server.js` static/proxy. The browser still calls OpenCode directly (plus Chrome loopback permission for hosted HTTPS).

## Directory vs session

HEX is **path-first**:

- `focusedDirectory` — path the user selected (top bar / picker).
- `activeDirectory` — path of the selected session, if any.
- `workingDirectory` — `focusedDirectory || activeDirectory`. Files, git, compose, and PTY use this.

Selecting a path does not create a session. If the current session is not on that path, the session id is cleared and the thread is empty. Send may create a session in `workingDirectory` at that moment.

OpenCode scopes almost every call with `?directory=` (or `x-opencode-directory`). Each distinct directory can become an OpenCode **instance** (watchers, LSP). Creating instances is expensive and leaks EventTarget listeners in current OpenCode builds, so HEX must not probe dozens of guessed paths at startup.

## Startup sequence

Splash (`uiInitState === 'loading'`) only waits for:

1. SSE `connection.open`
2. `GET /path` (home)
3. Worker `state.bootstrap` (current OpenCode projects only)
4. Session/path selection

Then the shell goes `ready`. History, providers, agents, commands, permissions, questions, git status, and extra remembered directories continue in the background.

Worker bootstrap (`sse-shared-worker.ts`):

1. `GET /project`
2. `listSessions` + `session/status` for the default instance and those project worktrees/sandboxes
3. One extra round of directories discovered from those sessions
4. `GET /vcs` for that set
5. Broadcast `state.bootstrap`

Remembered paths in `localStorage` (`instanceDirectories`, cap 80) are **lazy-synced** after bootstrap (12 at a time, concurrency 3). `load-sessions` still syncs a directory when the user opens it.

## Session graph

The worker builds the tree described in [projects.md](./projects.md): worktree → sandbox → sessions. The tab keeps a reactive copy via `useServerState`. Top bar, Recent, and bookmarks read that graph. They do not each re-fetch `/session`.

## Files and git

`useFileTree` lists `GET /file?path=.` for the working directory, paints the root, then walks children in the background to fill the `@file` index (limit 1000). Expanding a row loads that directory only.

Git status is **on-demand** on the Git tab (open / refresh / git commands from that panel), using one-shot PTY porcelain. See [prd-git-panel.md](./prd-git-panel.md). The branch picker still runs a one-shot PTY `git branch` **when the menu opens**. Interactive terminals are real PTY sessions; one-shot PTY remains for commit snapshots and branch switch commands from the tree.

OpenCode `GET /file` returns HTTP 500 for missing paths. Pickers must list an existing parent (usually home) instead of using the missing path as `directory`.

## Chat rendering

`useMessages` applies history plus SSE deltas. Assistant markdown is highlighted in `render-worker`. Initial thread paint is gated by `useInitialRenderTracking` (5s safety timeout). File-index updates must not force a full markdown re-render (`useAssistantPreRenderer` does not watch `files`).

Tool cards, diffs, and file viewers use floating windows (`docs/window-arch.md`).

## Event flow

```
OpenCode SSE  →  SharedWorker  →  tab (useGlobalEvents)
                     │
                     ├── state.bootstrap / project-updated
                     └── packet  →  messages, permissions, todos, file.watcher
```

If `SharedWorker` is missing, the tab falls back to a direct SSE connection. Same packet types.

## What not to put in App.vue

`App.vue` is already the composition root. New protocol calls go in `opencode.ts`. New session-graph rules go in the worker / `stateBuilder`. New files/git listing goes in `useFileTree`. Git snapshot scripts and parsers go in `gitSnapshots.ts`. Keep splash awaits limited to the four steps above.

Git diffs from the Git tab still *open* windows from `App.vue` (floating-window + PTY wiring), but the bash scripts they run live in `gitSnapshots.ts`.
