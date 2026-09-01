# Window / Viewer / Renderer Architecture

```
FloatingWindow  (drag, resize, z-index, titlebar)
└── entry.component  (viewer / tool window)
```

`FloatingWindow` is a generic shell from `useFloatingWindows`. `App.vue` (and a few composables) pick the content component:

| Use case | component |
| --- | --- |
| File / binary / image | `ContentViewer` |
| Diff (git, message, commit) | `DiffViewer` |
| Debug text dump | `ContentViewer` |
| Interactive terminal | `ToolWindow/Shell.vue` |
| Grep / glob / web | `ToolWindow/Grep.vue`, `Glob.vue`, `Web.vue` |
| Subagent / reasoning | `ToolWindow/Subagent.vue`, `Reasoning.vue` |
| Permission / question | `ToolWindow/Permission.vue`, `Question.vue` |

Tool titles and which window to open come from `app/utils/toolRenderers.ts`.

## Renderers

Stateless display. Under `app/components/renderers/`:

| Component | Role |
| --- | --- |
| `CodeRenderer` | Shiki source + line ranges (`useCodeRender`) |
| `DiffRenderer` | Side-by-side / unified diff, optional file tabs |
| `MarkdownRenderer` | markdown-it HTML via `render-worker` (or pre-rendered `html`) |
| `ImageRenderer` | Zoom / pan |
| `HexRenderer` | Hexdump (`CodeContent` `variant="binary"`) |

## Viewers

Select a renderer and own mode tabs. Under `app/components/viewers/`:

- **ContentViewer** — file / image / debug dump. Modes: Image, Hex, Rendered (markdown), Source.
- **DiffViewer** — git / message / commit diffs. Primary: Original | Modified | Diff. Markdown files get Rendered / Source when not on Diff.

## MessageViewer

`app/components/MessageViewer.vue` wraps `MarkdownRenderer` or `CodeRenderer` for conversation text.

Used by: `ThreadBlock`, `ThreadHistoryContent`, `ToolWindow/Question`, `ToolWindow/Subagent`, `ToolWindow/Reasoning`. The welcome composer in `App.vue` does **not** use it.

## App.vue call sites

- `openFileViewer` → `ContentViewer` (fetch then `fw.updateOptions`)
- `handleOpenImage` → `ContentViewer` with `imageSrc`
- `openGitDiff` / `openAllGitDiff` / `handleShowMessageDiff` / `handleShowCommit` → `DiffViewer`
- Debug dumps → `ContentViewer` with plain text

## File map

```
app/
├── components/
│   ├── renderers/          Code, Diff, Hex, Image, Markdown
│   ├── viewers/            ContentViewer, DiffViewer
│   ├── ToolWindow/         Shell, Grep, Glob, Web, Subagent, Reasoning, Permission, Question
│   ├── MessageViewer.vue
│   ├── FloatingWindow.vue
│   └── CodeContent.vue
├── composables/
│   ├── useFloatingWindows.ts
│   └── useFloatingWindow.ts
├── utils/
│   ├── toolRenderers.ts
│   ├── useCodeRender.ts
│   └── workerRenderer.ts
└── workers/
    └── render-worker.ts
```
