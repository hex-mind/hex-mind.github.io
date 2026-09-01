# OpenCode SSE (what HEX handles)

HEX uses **`GET /global/event`** only (one stream for all instances). The SharedWorker owns the connection (`app/workers/sse-shared-worker.ts`). If `SharedWorker` is unavailable, the tab falls back to the same URL.

Envelope:

```text
data: {"directory?":"string","payload":{"type":"string","properties":{...}}}
```

Typed payloads live in `app/types/sse.ts` (`GlobalEventMap`). That file is the source of truth for field shapes. Do not grow a second copy here.

## Worker (session graph)

These types update `stateBuilder` and are broadcast as `state.*` / forwarded packets:

`session.created` · `session.updated` · `session.deleted` · `session.status` · `project.updated` · `vcs.branch.updated` · `worktree.ready` · `permission.asked` · `permission.replied` · `question.asked` · `question.replied` · `question.rejected`

`session.created` is the reliable source of `projectID` for a sandbox. `/project` worktree/sandbox paths are used for directories; do not treat `project.id` as a filesystem path.

## Tab (UI)

`useGlobalEvents` fans packets to session-scoped listeners. Main consumers:

| Events | Consumer |
| --- | --- |
| `message.updated` / `removed`, `message.part.updated` / `delta` / `removed` | `useMessages`, `useDeltaAccumulator`, reasoning / subagent windows |
| `todo.updated` | `useTodos` |
| `pty.created` / `updated` / `exited` / `deleted` | App.vue shell windows |
| `file.edited`, `file.watcher.updated` | file tree / `@file` index |
| `session.error`, `session.diff`, `session.compacted` | thread / revert UI |
| `command.executed` | command UX |

Client-only (not from OpenCode): `connection.open`, `connection.error`, `connection.reconnected`.

Other OpenCode event names may appear on the wire; HEX ignores types it does not subscribe to.
