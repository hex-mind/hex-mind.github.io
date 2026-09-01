# HEX for OpenCode

> Cast a HEX on your code.

**HEX** is a fast, local-first web UI for a [OpenCode](https://opencode.ai) server running on your machine. You keep your own agent, your own files, and your own data — HEX just gives the agent a rich, eyes-on interface to work through.

## Why "HEX"

> The name doubles as a spell: three letters that conjure order out of chaos.

Pick whichever fits: **hexagon** — the six-sided cell of a honeycomb, a neat structure grown organically; or **hexadecimal** — the raw, precise encoding underneath every byte your agent touches. Either way, it reads like an incantation: cast a HEX, and your codebase rearranges itself under your control.

## Table of contents

- [Demo](#video-demo)
- [Features](#features)
- [User Guide](#user-guide)
- [Technical Stack](#technical-stack)
- [Development Guide](#development-guide)

---

## Demo

A short walkthrough is coming soon. Until then, open the hosted build at **<https://hex-mind.github.io/>** against your local OpenCode (see [User Guide](#user-guide)).

## Intro

HEX is a **browser client for a locally running OpenCode server**. The UI never owns the agent runtime — OpenCode owns sessions, tools, terminals, and the filesystem. HEX renders that state in real time and sends your actions back over HTTP, SSE, and WebSocket.

The result is a **path-first** experience: pick a directory, then talk to your agent inside it. Open a folder and it never auto-creates a session; only expanding a path into the session tree shows the chats living there.

A lot of thought went into not getting in your way — see [docs/architecture.md](docs/architecture.md) and [AGENTS.md](AGENTS.md) for how the pieces fit.

## Features

- **Local-first.** Talks to OpenCode on `localhost` (default port **4096**). No cloud account, no data leaves your machine; the browser calls OpenCode directly.
- **Path-first navigation.** The top bar shows the focused directory; clicking a path selects it, and only `>` expands into that directory's sessions. Deleting the current session keeps you on the same path.
- **Live session graph.** A `SharedWorker` holds one SSE connection and builds the project → worktree/sandbox → session tree. Recent, bookmarks, and the top bar all read from that single source of truth instead of refetching.
- **Streaming chat.** Assistant responses render as they arrive via SSE deltas, with Shiki syntax highlighting and per-message follow-up composer.
- **Floating tool windows.** Shell/terminal (xterm), file diffs, file viewers, grep/glob results, web fetches & searches, sub-agent runs, reasoning traces, permission prompts, and question dialogs — each in a resizable window you can arrange.
- **Compose with context.** Pick the model and agent inline, attach images/PDFs, and reference `@file` paths that are resolved at submit time.
- **Git panel.** On-demand status with **Staged** / **Changes** split, file-level diffs, "view diff for all", a branch picker that switches/creates/merges, and one-shot PTY snapshots — never a slow `git status` on every paint.
- **Permissions & questions.** Inline allow/deny for agent actions and multiple-choice question dialogs with a custom free-text answer.
- **Organize sessions.** Recent history, bookmarks, pinning, rename, archive, and delete (Shift reveals archive/delete on archived sessions).
- **In-chat search.** Content search across the current chat, plus full-text across recent sessions.

## User Guide

### 1. Start OpenCode

OpenCode must be running with CORS enabled for the origin you'll load HEX from:

```bash
opencode serve --cors https://hex-mind.github.io
```

Or configure it once in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "server": {
    "cors": ["https://hex-mind.github.io"]
  }
}
```

Restart OpenCode after changing the configuration.

### 2. Open HEX and connect

- **Hosted:** open **<https://hex-mind.github.io/>** and connect to `http://localhost:4096`.
- **Local dev:** see [Development Guide](#development-guide); open `http://localhost:5173`.

HEX prefers `localhost` over `127.0.0.1` when you open it in a browser.

### 3. Work path-first

- Use the top-bar path picker (or **Files** panel) to select a directory.
- Selecting a path does **not** create a session. **New session** (top bar or `⌘/Ctrl J`) also does not create one — it shows the welcome composer on the current path. Send a message and HEX starts a session in that `workingDirectory`.
- Use **Recent**, **Bookmarks**, or the `>` expansion in the top bar to jump into existing sessions.

### 4. Keep an eye on the agent

- **Side panel** — six tabs: **Recent**, **Files**, **Git**, **Search**, **Todo**, and **Bookmarks**. Todo appears on complex tasks when the agent breaks work into steps. The activity bar also has **Open shell** and Tips.
- **Floating windows** — tool results (shell, diffs, file viewers, web, sub-agents, permissions, questions) open in windows you can move, resize, and close.
- **Permissions** — when the agent wants to run something, allow or deny it inline.

### 5. Shortcuts

| Shortcut               | Action                                                 |
| ---------------------- | ------------------------------------------------------ |
| `⌘/Ctrl J`             | New session                                            |
| `⌥/Alt N`              | New session                                            |
| `⌥/Alt ↑ ↓`            | Switch session                                         |
| `Esc Esc`              | Stop                                                   |
| `Enter`                | Send (or `Ctrl+Enter` if you enabled that in Settings) |
| Hold `Shift` (top bar) | Show archive/delete on archived sessions               |

### 6. Chrome loopback permission

Chrome may block hosted HTTPS sites from reaching services on your computer. Open one of:

```text
chrome://settings/content/loopbackNetwork
chrome://settings/content/localNetworkAccess
```

and allow `https://hex-mind.github.io`. On macOS also enable Chrome under **System Settings → Privacy & Security → Local Network**.

### 7. Windows

If the `opencode` command isn't on your `Path`, add its install directory:

```text
E:\Users\<your-username>\.local\share\opencode\bin
```

On managed devices you may only be able to edit user-level environment variables.

## Technical Stack

| Layer               | Choice                                                                    |
| ------------------- | ------------------------------------------------------------------------- |
| Framework           | **Vue 3** (Composition API) + **TypeScript** (strict)                     |
| Build               | **Vite 7**                                                                |
| Styling             | **Tailwind CSS 4**                                                        |
| Syntax highlighting | **Shiki** (via markdown-it / code renderer)                               |
| Terminal            | **xterm.js** (interactive PTY shells)                                     |
| Markdown            | **markdown-it**                                                           |
| Icons               | **Iconify** (`lucide:`)                                                   |
| Rendering           | Worker-based markdown/render pipeline                                     |
| Server / static     | **Hono** + `@hono/node-server` (`server.js`, optional static/proxy serve) |
| Real-time           | **SSE** over a **SharedWorker** (one connection per OpenCode base URL)    |
| Package manager     | **pnpm**                                                                  |
| CI / deploy         | GitHub Actions → GitHub Pages & npm publish                               |

Code layout and architecture: [docs/architecture.md](docs/architecture.md). OpenCode protocol: [docs/API.md](docs/API.md) / [docs/SSE.md](docs/SSE.md). Full doc index: [docs/README.md](docs/README.md).

## Development Guide

Prerequisites: **Node 24+** and **pnpm**. OpenCode must already be running (`opencode serve`, default port **4096**) — this repo must **not** start or occupy 4096.

```bash
pnpm install
pnpm dev
```

Then open **<http://localhost:5173>**.

Scripts:

```bash
pnpm dev       # Vite dev server (default :5173)
pnpm build     # production build → dist/
pnpm lint      # oxlint + vue-tsc --noEmit (typecheck)
pnpm format    # oxfmt
pnpm prepack   # vite build before npm pack
```

Serve the built app with the bundled server:

```bash
node server.js           # static serve of dist/ (HEX_PORT, default 3000)
node server.js proxy     # proxy the hosted build (default hex-mind.github.io/hex)
```

Contributors: read [AGENTS.md](AGENTS.md) **before** touching UI, startup, layout, or git-panel code — it encodes the product rules and performance invariants you must not regress. Per-skill docs live in [`.opencode/skills/`](.opencode/skills/).

---

<p align="center">
  <sub>HEX was the working name for a coding agent — itself still being cast. Until it's ready, HEX is the surface it will one day work through.</sub>
</p>
