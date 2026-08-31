---
name: hex-architecture
description: HEX code layout and where to put new work. Use when adding features, extracting from App.vue, calling OpenCode HTTP, or changing the session graph / SharedWorker.
license: MIT
compatibility: opencode
---

# HEX architecture

HEX is a Vue 3 browser client. OpenCode owns sessions, tools, PTY, and the filesystem.

| Path | Role |
| --- | --- |
| `app/App.vue` | Composition root. Extract instead of growing it. |
| `app/workers/sse-shared-worker.ts` | Shared SSE + bootstrap |
| `app/utils/stateBuilder.ts` | Session-graph mutations |
| `app/types/worker-state.ts` | Graph types |
| `app/utils/opencode.ts` | REST client — no scattered `fetch` to OpenCode |
| `app/utils/gitSnapshots.ts` | Git/commit snapshot scripts + parsers |
| `app/composables/useFileTree.ts` | Files tree + git status |
| `app/composables/useServerState.ts` | Tab copy of worker graph |
| `docs/architecture.md` | Runtime |
| `docs/projects.md` | Graph model (there is no `sessionGraph.ts`) |

## Where new code goes

- Protocol HTTP → `opencode.ts`
- Session graph → worker / `stateBuilder`
- Files / git listing → `useFileTree`
- Git snapshot bash/parsers → `gitSnapshots.ts`
- Isolated UI state → `use*.ts` composable or a child component

## App.vue

Still holds PTY/shell windows, composer drafts, panel sashes, slash/debug, and tool-window routing. If you touch one of those, extract that slice rather than adding a sibling of the same size.

## Independent judgment

Read `AGENTS.md` § Independent judgment. Do not implement a requested layout that fights the table above or ordinary Vue 3 composition (duplicate stores, scattered `fetch`, more logic inlined in `App.vue`). Push back with the smaller design first.

## Style

Match existing Vue/TS. Small diffs. No drive-by refactors. Commits/PRs only when asked.
