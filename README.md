<div align="center">

![dev](./assets/logo-banner.png)

[![npm version](https://badge.fury.io/js/@wilmoore%2Fdev.svg)](https://badge.fury.io/js/@wilmoore%2Fdev)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)](https://github.com/wilmoore/dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Manage multiple dev servers with health checks, port handling, and unified logs.**

</div>

---

## Features

- Start, stop, and monitor multiple servers from one command
- Health checks with automatic retry and status reporting
- Port conflict resolution — finds the next available port
- Centralized logs in `.dev/log/` with configurable viewers
- Auto-configuration from `package.json` scripts
- Native OS notifications for server events
- Automatic cleanup of stale processes

## Why dev?

Most projects juggle multiple servers: frontend, backend, workers. Running them manually means scattered terminals, forgotten processes, and port conflicts. `dev` gives you a single command to start everything, track what's running, and view logs in one place.

## Quick Start

```bash
# Install globally
npm install -g @wilmoore/dev

# Or run directly with npx
npx @wilmoore/dev init
```

Initialize in your project, then start:

```bash
npx dev init      # Creates .dev/servers.json from package.json
npx dev start     # Starts the first configured server
npx dev status    # Shows running servers
npx dev logs      # Follows logs in real-time
npx dev stop      # Stops all servers
```

## Commands

| Command            | Description                                    | Example                  |
| ------------------ | ---------------------------------------------- | ------------------------ |
| `init`             | Initialize `.dev/` directory from package.json | `npx dev init`           |
| `start [server]`   | Start a server (default: first)                | `npx dev start frontend` |
| `stop [server]`    | Stop server(s) (default: all)                  | `npx dev stop backend`   |
| `restart [server]` | Restart a server                               | `npx dev restart api`    |
| `status`           | Show running servers with health status        | `npx dev status`         |
| `logs [server]`    | Follow server logs                             | `npx dev logs api`       |
| `doctor`           | Diagnose environment and configuration         | `npx dev doctor`         |
| `cleanup`          | Remove stale PID entries                       | `npx dev cleanup`        |

**Shortcut:** Use server names directly as commands:

```bash
npx dev frontend   # Same as: npx dev start frontend
```

## Configuration

The `init` command creates `.dev/servers.json`:

```json
{
  "frontend": {
    "command": "npm run dev > .dev/log/frontend.log 2>&1",
    "preferredPort": 3000,
    "healthCheck": "http://localhost:{PORT}"
  },
  "backend": {
    "command": "npm run server --port {PORT} > .dev/log/backend.log 2>&1",
    "preferredPort": 3010,
    "healthCheck": "http://localhost:{PORT}/health"
  }
}
```

### Options

| Key             | Description                                                      |
| --------------- | ---------------------------------------------------------------- |
| `command`       | Shell command to run. Use `{PORT}` and `{ROLE}` as placeholders. |
| `preferredPort` | Starting port. Auto-increments if busy.                          |
| `healthCheck`   | URL to poll until the server responds.                           |

### Environment Variables

| Variable               | Description              | Default   |
| ---------------------- | ------------------------ | --------- |
| `DEV_LOG_VIEWER`       | Command for viewing logs | `tail -f` |
| `ENABLE_NOTIFICATIONS` | Enable OS notifications  | `true`    |

## Advanced Usage

### Custom Log Viewers

```bash
npx dev logs --log-viewer "bat -f"      # Syntax highlighting
npx dev logs --log-viewer "less +F"     # Scrollable

# Or set a default
export DEV_LOG_VIEWER="bat -f"
```

### Template Variables

Use `{PORT}` and `{ROLE}` for dynamic values:

```json
{
  "worker": {
    "command": "NODE_ENV={ROLE} node worker.js --port {PORT} > .dev/log/{ROLE}.log 2>&1",
    "preferredPort": 4000,
    "healthCheck": "http://localhost:{PORT}/health"
  }
}
```

### Port Handling

If the preferred port is busy, `dev` tries the next one:

```
$ npx dev start api
Started api on port 3001 (3000 was busy)
```

### Disable Notifications

```bash
ENABLE_NOTIFICATIONS=false npx dev start
```

## Project Structure

After initialization:

```
your-project/
├── .dev/
│   ├── servers.json    # Server config (commit this)
│   ├── pid.json        # Process tracking (gitignored)
│   └── log/            # Log files (gitignored)
└── package.json
```

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <strong>Built for developers who value efficient workflows.</strong>
</div>
