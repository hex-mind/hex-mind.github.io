---
name: hex-git-panel
description: HEX Git side panel fetch policy and Staged/Changes split. Use when changing the Git tab, git status, branch picker, stage/unstage, or git snapshot diffs.
license: MIT
compatibility: opencode
---

# HEX Git panel

Full PRD: `docs/prd-git-panel.md`. Snapshot scripts: `app/utils/gitSnapshots.ts`. Listing: `app/composables/useFileTree.ts`.

## Fetch policy

Pull git status **only while the Git tab is in use**, via one-shot PTY porcelain — not `GET /file/status`:

```text
git status --porcelain=v1
git diff --numstat
git diff --cached --numstat
```

| Event | Pull git status? |
| --- | --- |
| Splash / Files tab / path change while not on Git | No |
| Open Git tab (status not loaded for this path) | Yes |
| Git tab refresh | Yes |
| Path change while Git tab is already open | Yes (status was cleared) |
| Files tab refresh | No (file tree only) |
| User git command from the Git header | Yes |

Branch picker: one-shot PTY `git branch` **when the menu opens**.

## Staged vs Changes

- **Staged**: porcelain index column `x` is not space and not `?`. `+/-` from `diff --cached --numstat`.
- **Changes**: worktree column or untracked (`??`). `+/-` from `diff --numstat`.
- If the active tab is empty and the other has files, switch to the tab that has files.

Do not restore `/file/status` for Staged/Changes. `listFileStatus` was removed from `opencode.ts` on purpose.
