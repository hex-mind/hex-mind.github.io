# HEX for OpenCode

> Cast a HEX on your code.

HEX is a browser-based interface for [OpenCode](https://github.com/sst/opencode), with session management, project navigation, tool output, reasoning views, and an integrated terminal.

## Quick start

Start OpenCode with CORS enabled:

```bash
opencode serve --cors https://hex-mind.github.io
```

Then open **<https://hex-mind.github.io/>** and connect to:

```text
http://localhost:4096
```

Alternatively, configure CORS in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "server": {
    "cors": ["https://hex-mind.github.io"]
  }
}
```

Restart OpenCode after changing the configuration.

## Browser permission

Chrome may block hosted websites from accessing services on your computer. Open one of the following settings pages:

```text
chrome://settings/content/loopbackNetwork
chrome://settings/content/localNetworkAccess
```

Allow `https://hex-mind.github.io`. On macOS, also enable Chrome under **System Settings → Privacy & Security → Local Network**.

## Windows

If the `opencode` command is unavailable, add its installation directory to your user `Path`:

```text
E:\Users\<your-username>\.local\share\opencode\bin
```

On managed company devices, you may only have permission to edit user-level environment variables.
