# PRD: Git panel — on-demand status

Status: **shipped for fetch + Staged/Changes split**. Fine-tuning (ahead/behind, stage/unstage UI) is later.

## Problem

The Git side panel has Staged and Changes tabs, plus `+/-` totals that open a snapshot diff. `GET /file/status` cannot drive those tabs:

- It does not expose index vs worktree (porcelain `XY`).
- Staged-only files and many untracked files never appear.
- Pulling it on every directory change also wasted work the user never looked at.

## Decision

**Pull git status only while the Git tab is in use**, via one-shot PTY porcelain (not `/file/status`):

```text
git status --porcelain=v1
git diff --numstat
git diff --cached --numstat
```

| Event | Pull git status? |
| --- | --- |
| Splash / Files tab / path change while not on Git | No |
| Open Git tab (status not loaded for this path) | Yes |
| Git tab refresh button | Yes |
| Path change while Git tab is already open | Yes (status was cleared) |
| Files tab refresh | No (file tree only) |
| User git command from the Git header | Yes |

Never run this on splash or as part of Files listing. Branch picker stays a one-shot PTY **when the menu opens**.

## Staged vs Changes

- **Staged**: porcelain index column `x` is not space and not `?`. `+/-` from `diff --cached --numstat`.
- **Changes**: worktree column or untracked (`??`). `+/-` from `diff --numstat`. Untracked stay in the list even if they do not affect numstat.
- If the active tab is empty and the other tab has files, switch to the tab that has files.
- Git tab lists are expanded so nested dirty files are visible without clicking the tree.

## UX copy

- Git, not loaded: `Click refresh to load git status.`
- Git, Staged empty: `No staged files.`
- Git, Changes empty: `No unstaged changes.`
- Tabs may show counts, e.g. `Staged (18)`.

## Later

- Ahead/behind vs upstream
- Staging / unstaging from the UI
- Auto-refresh on `file.watcher` (still must not run on every path change from Files)
