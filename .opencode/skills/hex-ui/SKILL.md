---
name: hex-ui
description: HEX product rules for path-first navigation, compose/send, shortcuts, and directory pickers. Use when changing HEX UI, layout, selection, compose, send, search shortcuts, or folder pickers.
license: MIT
compatibility: opencode
---

# HEX UI

Read `AGENTS.md` and `docs/architecture.md` first.

## Path-first

- Top bar shows `focusedDirectory`. Clicking a path selects the path; only `>` expands sessions.
- Opening a folder must not create a session.
- Deleting the current session stays on that path. Do not jump to another chat.
- Compose / send / files / git / shell use `workingDirectory` (`focusedDirectory || activeDirectory`). Do not require a session id.

## Input and shortcuts

- Default send is Enter. Do not advertise Ctrl+Enter unless settings changed it.
- Do not bind Cmd/Ctrl+F to the left Search tab. `FloatingWindow` in-window find may keep Cmd+F.

## Directories and pickers

- OpenCode `GET /file` returns **500** (not 404) for missing paths. Never probe guessed directories as new instances.
- List the parent via home (or `/`) and look for the child name. Treat 500 as “directory not found”.
- Browser folder pickers do not expose absolute `File.path`. Resolve via parent listings / project history, or the path picker at **home + filter**. Never `~/folderName/`.

## Verify

After UI/layout/behavior changes, exercise the flow in the browser at `http://localhost:5173` (not `127.0.0.1`). Do not start or occupy OpenCode port 4096.
