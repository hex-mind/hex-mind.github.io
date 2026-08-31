---
name: hex-performance
description: HEX startup and render performance invariants. Use when changing splash, bootstrap, SSE worker, file tree, git fetch, markdown highlighting, or remembered directories.
license: MIT
compatibility: opencode
---

# HEX performance

Do not put work back on the splash critical path.

## Splash (`uiInitState === 'loading'`)

Wait only for:

1. SSE `connection.open`
2. `GET /path` (home)
3. Worker `state.bootstrap` (current OpenCode projects only)
4. Session/path selection

Then go `ready`. History, providers, agents, commands, permissions, questions, git status, and extra remembered directories stay in the background.

## Worker bootstrap

Sync `GET /project` worktrees/sandboxes plus the default instance. Remembered `instanceDirectories` (cap 80) lazy-sync **after** bootstrap. Do not fan out dozens of OpenCode instances at startup. `load-sessions` still syncs a directory when the user opens it.

## Files tree

Paint root listing first. Background scan fills the `@file` index (limit 1000). Expanding a folder loads that folder. Do not BFS the whole tree before `treeLoading` clears.

## Git

On-demand on the Git tab only. See skill `hex-git-panel` and `docs/prd-git-panel.md`.

## Markdown

File-index updates must not re-highlight the whole thread. `useAssistantPreRenderer` watches visible roots and theme. `@file` basenames are snapshotted at submit time, not a watch source.
