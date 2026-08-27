# SSE

This document describes the SSE stream shape used by this app. The goal is that this file alone is enough to implement a client parser.

## Endpoints

### `GET /global/event`

Aggregates events from all project instances into a single stream.

Each SSE `data:` line contains a JSON object:

```text
data: {"directory?":"string","payload":{"type":"string","properties":{...}}}

```

- `directory` (string) — Scope key for the event source. Usually a project directory; for workspace-synced events this can be a workspace ID (`wrk...`). Absent for `server.connected` and `server.heartbeat`. Set to `"global"` for `global.disposed`.
- `payload.type` (string) — Event name.
- `payload.properties` (object) — Event-specific fields.

### `GET /event`

Streams events for a single project/workspace scope selected by `?directory=` and optional `?workspace=` (or `X-OpenCode-Directory` / `X-OpenCode-Workspace` headers).

Each SSE `data:` line contains a JSON object without the `directory`/`payload` wrapper:

```text
data: {"type":"string","properties":{...}}

```

The server does not use SSE `event:`, `id:`, or `retry:` fields.

## Event Types

Below lists each `payload.type` and its `payload.properties`.

Nested objects use inline notation: `time: { created: number }` means `{"time":{"created":123}}` in JSON. Optional fields are marked with `?`.

### Server Lifecycle

- `server.connected`
  - `{}`
- `server.heartbeat`
  - `{}`
- `server.instance.disposed`
  - `directory: string`
- `global.disposed`
  - `{}`

### Installation

- `installation.updated`
  - `version: string`
- `installation.update-available`
  - `version: string`

### IDE

- `ide.installed`
  - `ide: string`

### LSP

- `lsp.client.diagnostics`
  - `serverID: string`
  - `path: string`
- `lsp.updated`
  - `{}`

### Message

- `message.updated`
  - `info: Message`
- `message.removed`
  - `sessionID: string`
  - `messageID: string`
- `message.part.updated`
  - `part: Part`
- `message.part.delta`
  - `sessionID: string`
  - `messageID: string`
  - `partID: string`
  - `field: string`
  - `delta: string`
- `message.part.removed`
  - `sessionID: string`
  - `messageID: string`
  - `partID: string`

### Permission

- `permission.asked`
  - `id: string`
  - `sessionID: string`
  - `permission: string`
  - `patterns: string[]`
  - `metadata: Record<string, unknown>`
  - `always: string[]`
  - `tool?: { messageID: string; callID: string }`
- `permission.replied`
  - `sessionID: string`
  - `requestID: string`
  - `reply: "once" | "always" | "reject"`
- `permission.updated` (deprecated)
  - `id: string`
  - `type: string`
  - `pattern?: string | string[]`
  - `sessionID: string`
  - `messageID: string`
  - `callID?: string`
  - `message: string`
  - `metadata: Record<string, unknown>`
  - `time: { created: number }`

### Question

- `question.asked`
  - `id: string`
  - `sessionID: string`
  - `questions: QuestionInfo[]`
  - `tool?: { messageID: string; callID: string }`
- `question.replied`
  - `sessionID: string`
  - `requestID: string`
  - `answers: string[][]`
- `question.rejected`
  - `sessionID: string`
  - `requestID: string`

### Session

- `session.status`
  - `sessionID: string`
  - `status: SessionStatus`
- `session.idle` (deprecated)
  - `sessionID: string`
- `session.compacted`
  - `sessionID: string`
- `session.created`
  - `info: Session`
- `session.updated`
  - `info: Session`
- `session.deleted`
  - `info: Session`
- `session.diff`
  - `sessionID: string`
  - `diff: FileDiff[]`
- `session.error`
  - `sessionID?: string`
  - `error?: ErrorObject`

### File

- `file.edited`
  - `file: string`
- `file.watcher.updated`
  - `file: string`
  - `event: "add" | "change" | "unlink"`

### Todo

- `todo.updated`
  - `sessionID: string`
  - `todos: Todo[]`

### Command

- `command.executed`
  - `name: string`
  - `sessionID: string`
  - `arguments: string`
  - `messageID: string`

### Project

- `project.updated`
  - `properties: ProjectInfo`

### Workspace

- `workspace.ready`
  - `name: string`
- `workspace.failed`
  - `message: string`

### Worktree

- `worktree.ready`
  - `name: string`
  - `branch: string`
- `worktree.failed`
  - `message: string`

### VCS

- `vcs.branch.updated`
  - `branch?: string`

### MCP

- `mcp.tools.changed`
  - `server: string`
- `mcp.browser.open.failed`
  - `mcpName: string`
  - `url: string`

### TUI

- `tui.prompt.append`
  - `text: string`
- `tui.command.execute`
  - `command: string`
- `tui.toast.show`
  - `title?: string`
  - `message: string`
  - `variant: "info" | "success" | "warning" | "error"`
  - `duration?: number`
- `tui.session.select`
  - `sessionID: string`

### PTY

- `pty.created`
  - `info: Pty`
- `pty.updated`
  - `info: Pty`
- `pty.exited`
  - `id: string`
  - `exitCode: number`
- `pty.deleted`
  - `id: string`

## Core Payload Shapes

### Message (discriminated by `role`)

`Message = UserMessage | AssistantMessage`

`UserMessage`

- `id: string`
- `sessionID: string`
- `role: "user"`
- `time: { created: number }`
- `format?: OutputFormat`
- `summary?: { title?: string; body?: string; diffs: FileDiff[] }`
- `agent: string`
- `model: { providerID: string; modelID: string }`
- `system?: string`
- `tools?: Record<string, boolean>`
- `variant?: string`

`AssistantMessage`

- `id: string`
- `sessionID: string`
- `role: "assistant"`
- `time: { created: number; completed?: number }`
- `error?: ErrorObject`
- `parentID: string`
- `modelID: string`
- `providerID: string`
- `mode: string` (deprecated)
- `agent: string`
- `path: { cwd: string; root: string }`
- `summary?: boolean`
- `cost: number`
- `tokens: { total?: number; input: number; output: number; reasoning: number; cache: { read: number; write: number } }`
- `structured?: unknown`
- `variant?: string`
- `finish?: string`

### OutputFormat (discriminated by `type`)

`OutputFormat = OutputFormatText | OutputFormatJsonSchema`

`OutputFormatText`

- `type: "text"`

`OutputFormatJsonSchema`

- `type: "json_schema"`
- `schema: Record<string, unknown>`
- `retryCount: number` (default `2`)

### Part (discriminated by `type`)

All part variants include:

- `id: string`
- `sessionID: string`
- `messageID: string`

`Part = TextPart | ReasoningPart | FilePart | ToolPart | StepStartPart | StepFinishPart | SnapshotPart | PatchPart | AgentPart | RetryPart | CompactionPart | SubtaskPart`

`TextPart`

- `type: "text"`
- `text: string`
- `synthetic?: boolean`
- `ignored?: boolean`
- `time?: { start: number; end?: number }`
- `metadata?: Record<string, unknown>`

`ReasoningPart`

- `type: "reasoning"`
- `text: string`
- `metadata?: Record<string, unknown>`
- `time: { start: number; end?: number }`

`FilePart`

- `type: "file"`
- `mime: string`
- `filename?: string`
- `url: string`
- `source?: FilePartSource`

`ToolPart`

- `type: "tool"`
- `callID: string`
- `tool: string`
- `state: ToolState`
- `metadata?: Record<string, unknown>`

`StepStartPart`

- `type: "step-start"`
- `snapshot?: string`

`StepFinishPart`

- `type: "step-finish"`
- `reason: string`
- `snapshot?: string`
- `cost: number`
- `tokens: { total?: number; input: number; output: number; reasoning: number; cache: { read: number; write: number } }`

`SnapshotPart`

- `type: "snapshot"`
- `snapshot: string`

`PatchPart`

- `type: "patch"`
- `hash: string`
- `files: string[]`

`AgentPart`

- `type: "agent"`
- `name: string`
- `source?: { value: string; start: number; end: number }`

`RetryPart`

- `type: "retry"`
- `attempt: number`
- `error: APIError`
- `time: { created: number }`

`CompactionPart`

- `type: "compaction"`
- `auto: boolean`

`SubtaskPart`

- `type: "subtask"`
- `prompt: string`
- `description: string`
- `agent: string`
- `model?: { providerID: string; modelID: string }`
- `command?: string`

### ToolState (discriminated by `status`)

`ToolState = ToolStatePending | ToolStateRunning | ToolStateCompleted | ToolStateError`

`ToolStatePending`

- `status: "pending"`
- `input: Record<string, unknown>`
- `raw: string`

`ToolStateRunning`

- `status: "running"`
- `input: Record<string, unknown>`
- `title?: string`
- `metadata?: Record<string, unknown>`
- `time: { start: number }`

`ToolStateCompleted`

- `status: "completed"`
- `input: Record<string, unknown>`
- `output: string`
- `title: string`
- `metadata: Record<string, unknown>`
- `time: { start: number; end: number; compacted?: number }`
- `attachments?: FilePart[]`

`ToolStateError`

- `status: "error"`
- `input: Record<string, unknown>`
- `error: string`
- `metadata?: Record<string, unknown>`
- `time: { start: number; end: number }`

### FilePartSource (discriminated by `type`)

`FilePartSource = FileSource | SymbolSource | ResourceSource`

`FileSource`

- `type: "file"`
- `path: string`
- `text: { value: string; start: number; end: number }`

`SymbolSource`

- `type: "symbol"`
- `path: string`
- `name: string`
- `kind: number`
- `range: { start: { line: number; character: number }; end: { line: number; character: number } }`
- `text: { value: string; start: number; end: number }`

`ResourceSource`

- `type: "resource"`
- `clientName: string`
- `uri: string`
- `text: { value: string; start: number; end: number }`

### QuestionInfo

- `question: string`
- `header: string`
- `options: QuestionOption[]`
- `multiple?: boolean`
- `custom?: boolean` (default `true`)

`QuestionOption`

- `label: string`
- `description: string`

### SessionStatus (discriminated by `type`)

- `{ type: "idle" }`
- `{ type: "busy" }`
- `{ type: "retry"; attempt: number; message: string; next: number }`

## Other Shared Shapes

### FileDiff

- `file: string`
- `before: string`
- `after: string`
- `additions: number`
- `deletions: number`
- `status?: "added" | "deleted" | "modified"`

### Session

- `id: string`
- `slug: string`
- `projectID: string`
- `directory: string`
- `parentID?: string`
- `title: string`
- `version: string`
- `time: { created: number; updated: number; compacting?: number; archived?: number }`
- `summary?: { additions: number; deletions: number; files: number; diffs?: FileDiff[] }`
- `share?: { url: string }`
- `permission?: PermissionRule[]`
- `revert?: { messageID: string; partID?: string; snapshot?: string; diff?: string }`

### PermissionRule

- `permission: string`
- `pattern: string`
- `action: "allow" | "deny" | "ask"`

### Todo

- `content: string`
- `status: "pending" | "in_progress" | "completed" | "cancelled"`
- `priority: "high" | "medium" | "low"`

### Pty

- `id: string`
- `title: string`
- `command: string`
- `args: string[]`
- `cwd: string`
- `status: "running" | "exited"`
- `pid: number`

### ProjectInfo

- `id: string`
- `worktree: string`
- `vcs?: "git"`
- `name?: string`
- `icon?: { url?: string; override?: string; color?: string }`
- `commands?: { start?: string }`
- `time: { created: number; updated: number; initialized?: number }`
- `sandboxes: string[]`

## Error Shapes

All errors follow the `{ name: string; data: object }` structure.

### ProviderAuthError

- `name: "ProviderAuthError"`
- `data.providerID: string`
- `data.message: string`

### UnknownError

- `name: "UnknownError"`
- `data.message: string`

### MessageOutputLengthError

- `name: "MessageOutputLengthError"`
- `data: {}` (empty object)

### MessageAbortedError

- `name: "MessageAbortedError"`
- `data.message: string`

### StructuredOutputError

- `name: "StructuredOutputError"`
- `data.message: string`
- `data.retries: number`

### ContextOverflowError

- `name: "ContextOverflowError"`
- `data.message: string`
- `data.responseBody?: string`

### APIError

- `name: "APIError"`
- `data.message: string`
- `data.statusCode?: number`
- `data.isRetryable: boolean`
- `data.responseHeaders?: Record<string, string>`
- `data.responseBody?: string`
- `data.metadata?: Record<string, string>`

## UI Notes

The frontend tool windows are rendered from `Part.type === "tool"` events.

- `pending`: not rendered.
- `running`: rendered when content is available.
- `completed` / `error`: status is updated and window expires after about 2 seconds.
