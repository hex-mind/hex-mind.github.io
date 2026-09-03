# HEX — agent notes

HEX is a Vue 3 + TypeScript web UI for a locally running [OpenCode](https://opencode.ai) server. It is not Ant Design. Follow this file, `docs/architecture.md`, and existing code style.

OpenCode skills for this repo live in `.opencode/skills/` (`hex-ui`, `hex-performance`, `hex-architecture`, `hex-git-panel`). Load the matching skill before UI, startup, layout, or git-panel work.

## Independent judgment

Do not rubber-stamp the user's diagnosis, proposed fix, or architecture. The request is a hypothesis. Check the code (and this file) before agreeing.

Before implementing, look for:

1. **Wrong premises** — Does the claimed cause match the code? If they say Vue always refetches, and the real cause is a `watch` plus no session cache, say that first. Do not implement a Vue workaround for an app-design issue.
2. **Logical jumps** — "X is slow" does not imply "rewrite X". Name the missing step. "I clicked session" does not imply every `/file` call is session-scoped.
3. **Missing information** — If you cannot tell which directory, session, or code path is involved, inspect or ask. Do not invent a story and code to it.
4. **Architecture** — Prefer mainstream Vue 3 composition: one source of truth, HTTP in `opencode.ts`, session graph in the worker, UI state in composables/components. Do not add a parallel store, a second REST client, or grow `App.vue` because the prompt sketched it that way. If the requested shape fights this repo or ordinary Vue/TS practice, push back with a smaller design and the tradeoff.

Disagree briefly, then implement the sounder path unless the user explicitly overrides after hearing the objection.

## Runtime

- The user runs OpenCode (`opencode serve`, default `http://127.0.0.1:4096`). **Do not start, restart, or occupy port 4096** unless they explicitly ask.
- Local Vite is typically `http://localhost:5173`. Prefer `localhost`, not `127.0.0.1`, when opening the app in a browser.
- **Ports you bind are yours to release.** If this agent started Vite (or anything else) on 5173 — or any other port — stop that process when verification is done. Do not leave it listening. Do not kill a server the user already had running unless they asked.
- Hosted UI: `https://hex-mind.github.io` talking to the same local OpenCode. CORS must allow that origin.
- Chrome may block loopback access from HTTPS; see README.

## Product rules (do not regress)

- **Path-first.** The top bar shows the focused directory. Clicking a path selects the path; only `>` expands sessions. Opening a folder must not auto-create a session. **New session** (top bar / Cmd+J) clears the selected session and shows the welcome composer; it does not `POST /session`. Deleting the current session stays on that path and does not jump to another chat.
- Compose / send / files / git / shell use `workingDirectory` (`focusedDirectory || activeDirectory`), not “must have a session id”.
- Default send is Enter. Do not advertise Ctrl+Enter unless settings changed it.
- Do not bind Cmd/Ctrl+F to the left Search tab. In-window find in `FloatingWindow` may keep Cmd+F.
- OpenCode `GET /file` returns **500** (not 404) for missing paths. Never probe guessed directories as new instances. List the parent via home (or `/`) and look for the child name. Treat that 500 as “directory not found” in pickers.
- Browser folder pickers do not expose absolute `File.path`. Resolve via parent listings / project history, or fall back to the path picker at **home + filter**, never `~/folderName/`.

## Performance invariants

Startup must stay cheap. Do not put these back on the splash critical path:

1. Worker bootstrap only syncs OpenCode’s current `GET /project` worktrees/sandboxes (plus the default instance). Remembered paths load **after** `state.bootstrap`, capped (`LAZY_DIRECTORY_LIMIT`).
2. `uiInitState = 'ready'` after SSE + path + project/session **selection**. Session history, providers, agents, commands, permissions, and questions are background.
3. Files tree paints **root listing first**, then scans in the background. Expanding a folder loads that folder. Do not BFS the whole tree before `treeLoading` clears.
4. Git status is **on-demand** on the Git tab (open tab, refresh, or a git command from that panel). Use one-shot PTY porcelain (`git status --porcelain=v1` + numstat), never `/file/status` for Staged/Changes, and never on splash or directory change from Files. Branch lists may still use a one-shot PTY when the user opens the branch picker. See `docs/prd-git-panel.md`.
5. File-index updates (`useFileTree` `files`) must not force a full assistant markdown re-render. `useAssistantPreRenderer` watches thread content and theme only; `@file` basenames are a snapshot at submit time.

`rememberInstanceDirectories` is for reconnect/lazy sync, not a reason to fan out 80 OpenCode instances during splash.

## Layout of the code

| Path | Role |
| --- | --- |
| `app/App.vue` | Composition root: connection, selection, send, shortcuts. Extract instead of growing it. |
| `app/workers/sse-shared-worker.ts` | Shared SSE + project/session graph bootstrap |
| `app/utils/stateBuilder.ts` | Session-graph mutations (worker SSOT) |
| `app/types/worker-state.ts` | Session-graph types |
| `app/utils/opencode.ts` | REST client for OpenCode |
| `app/utils/gitSnapshots.ts` | One-shot PTY scripts + parsers for git/commit diffs |
| `app/composables/useGitDiffWindows.ts` | Git / commit / message diff floating windows |
| `app/utils/fileViewerWindow.ts` | Shared file-viewer window size + chrome |
| `app/utils/debugDump.ts` | `/debug session` graph dump |
| `app/composables/useFileTree.ts` | Files tree, git status, background `@file` index |
| `app/composables/useServerState.ts` | Tab copy of worker graph |
| `app/composables/useGlobalEvents.ts` | Tab ↔ worker events |
| `app/utils/pickLocalDirectory.ts` | Native folder picker → absolute path |
| `docs/architecture.md` | Runtime architecture |
| `docs/API.md` / `docs/SSE.md` / `docs/projects.md` | HEX-used OpenCode HTTP/SSE + session graph |

## App.vue size

`App.vue` is the composition root and is already large. **Do not add new features inline.** Put new work in:

- Protocol HTTP → `opencode.ts`
- Session graph → worker / `stateBuilder`
- Files / git status → `useFileTree`
- Git snapshot scripts/parsers → `gitSnapshots.ts`
- Isolated UI state → a composable (`use*.ts`) or a child component

Still in `App.vue` (extract later if you touch that area): PTY/shell windows, composer drafts, panel sashes, slash/debug commands, tool-window routing.

## Implementation habits

- Match existing Vue/TS style. Small diffs. No drive-by refactors.
- Prefer `app/utils/opencode.ts` for HTTP; do not scatter raw `fetch` to OpenCode.
- After UI/layout/behavior changes, verify in the browser when tools are available (`localhost`, not `127.0.0.1`). If this agent started the Vite (or other) server for that check, **stop it before finishing** so 5173 is free. Never leave a leftover listener.
- Commits and PRs only when the user asks. PR titles in English (`type: summary`).
- Do not update git config, skip hooks, or force-push unless the user asks.
