# Git panel

Shipped: on-demand fetch + Staged / Changes split + ahead/behind from `status -b` + per-file stage/unstage.

## Fetch

Pull git status **only while the Git tab is in use**, via one-shot PTY **`git` argv** — not `GET /file/status`, and not bash wrappers:

```text
git status --porcelain=v1 -b
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

Never run this on splash or as part of Files listing. Branch picker: one-shot PTY `git branch -a --no-color` **when the menu opens** (no `--format=%()`, which cmd.exe mangles). Scripts/parsers: `app/utils/gitStatus.ts`. Listing: `app/composables/useFileTree.ts`.

## Staged vs Changes

- **Staged**: porcelain index column `x` is not space and not `?`. `+/-` from `diff --cached --numstat`.
- **Changes**: worktree column or untracked (`??`). `+/-` from `diff --numstat`. Untracked stay in the list even if they do not affect numstat.
- If the active tab is empty and the other tab has files, switch to the tab that has files.
- Git tab is a flat dirty-file list (VS Code SCM): basename + dimmed directory + per-file `+/-` from the same numstat, no folder tree.
- Changes hover `+` → `git add -- path`. Staged hover `−` → `git restore --staged -- path`. Silent one-shot PTY, then refresh. No commit button.

## UX copy

- Git, not loaded: `Click refresh to load git status.`
- Git, Staged empty: `No staged files.`
- Git, Changes empty: `No unstaged changes.`
- Tabs may show counts, e.g. `Staged (18)`.

## Later

- Auto-refresh on `file.watcher` (still must not run on every path change from Files)
