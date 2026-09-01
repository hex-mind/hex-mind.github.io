# OpenCode HTTP (what HEX calls)

HEX talks to a local OpenCode server (default `http://127.0.0.1:4096`). The client is `app/utils/opencode.ts`. Do not scatter extra `fetch` calls.

This is not a full OpenCode OpenAPI dump. For unused endpoints, see OpenCode itself.

## Conventions HEX relies on

- Scope with `?directory=` or `x-opencode-directory`. Without it, OpenCode uses its process cwd.
- Optional Basic auth via `Authorization`.
- **`GET /file` returns HTTP 500 (not 404) when the path does not exist.** Treat that as “directory not found”. Never use a guessed missing path as `directory=` (that would spawn an instance). List the parent (usually home) instead. Helpers: `listFilesAt`, `isMissingPathError`.

## Endpoints HEX uses

| Method | Path | HEX helper |
| --- | --- | --- |
| GET | `/path` | `getPathInfo` (home) |
| GET | `/file` | `listFiles` / `listFilesAt` |
| GET | `/file/content` | `readFileContent` |
| GET | `/find/file` | `findFiles` |
| GET | `/project` | `listProjects` |
| GET | `/project/current` | `getCurrentProject` |
| GET | `/session` | `listSessions` |
| GET | `/session/:id` | `getSession` |
| POST | `/session` | `createSession` |
| PATCH | `/session/:id` | `updateSession` |
| DELETE | `/session/:id` | `deleteSession` |
| POST | `/session/:id/prompt_async` | `sendPromptAsync` |
| POST | `/session/:id/command` | `sendCommand` |
| POST | `/session/:id/abort` | `abortSession` |
| POST | `/session/:id/revert` | `revertSession` |
| POST | `/session/:id/unrevert` | `unrevertSession` |
| GET | `/session/:id/message` | `listSessionMessages` |
| GET | `/session/:id/todo` | `getSessionTodos` |
| GET | `/session/status` | `getSessionStatusMap` |
| GET | `/command` | `listCommands` |
| GET | `/config/providers` | `listProviders` |
| GET | `/agent` | `listAgents` |
| GET | `/permission` | `listPendingPermissions` |
| POST | `/permission/:id/reply` | `replyPermission` |
| GET | `/question` | `listPendingQuestions` |
| POST | `/question/:id/reply` | `replyQuestion` |
| POST | `/question/:id/reject` | `rejectQuestion` |
| GET | `/vcs` | `getVcsInfo` |
| DELETE | `/experimental/worktree` | `deleteWorktree` |
| GET | `/pty` | `listPtys` |
| POST | `/pty` | `createPty` |
| PUT | `/pty/:id` | `updatePtySize` |
| DELETE | `/pty/:id` | `deletePty` |

PTY data plane is WebSocket ` /pty/:id/connect` (`createWsUrl`), used for interactive shells and one-shot git porcelain.

HEX does **not** call `GET /file/status` for the Git tab. See [prd-git-panel.md](./prd-git-panel.md).

## SSE

`GET /global/event` — see [SSE.md](./SSE.md).
