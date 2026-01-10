# dev

[![npm version](https://badge.fury.io/js/@wilmoore%2Fdev.svg)](https://badge.fury.io/js/@wilmoore%2Fdev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)](https://github.com/wilmoore/dev)

> A sophisticated development server management tool with process monitoring, health checks, and log management.

![Logo Banner](./assets/logo-banner.png)

## Features

- **Intelligent Server Management** - Start, stop, and monitor multiple development servers
- **Process Monitoring** - Real-time health checks and PID tracking
- **Port Management** - Automatic port conflict resolution and detection
- **Log Management** - Centralized logging with real-time log viewing
- **Auto-Configuration** - Automatically infers server configurations from package.json
- **Native Notifications** - OS-level notifications for server events
- **Process Cleanup** - Automatic cleanup of stale processes
- **Log Viewer Integration** - Customizable log viewers (tail, bat, etc.)

## Quick Start

### Installation

```bash
# Install globally
npm install -g @wilmoore/dev

# Or use with npx (recommended)
npx @wilmoore/dev init
```

### Basic Usage

```bash
# Initialize in your project
npx dev init

# Start the first configured server
npx dev start

# Start a specific server
npx dev start frontend

# Check running servers
npx dev status

# View logs
npx dev logs

# Stop all servers
npx dev stop
```

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `init` | Initialize .dev directory from package.json | `npx dev init` |
| `start [server]` | Start a server (default: first server) | `npx dev start frontend` |
| `stop [server]` | Stop server(s) (default: all) | `npx dev stop backend` |
| `restart [server]` | Restart a server | `npx dev restart api` |
| `status` | Show running servers with health status | `npx dev status` |
| `logs [server]` | Follow server logs in real-time | `npx dev logs api` |
| `doctor` | Diagnose environment and show configuration | `npx dev doctor` |
| `cleanup` | Remove stale entries from PID tracking | `npx dev cleanup` |

### Shortcuts

You can use server names directly as commands:

```bash
# These are equivalent
npx dev start frontend
npx dev frontend
```

## Configuration

The tool automatically creates a `.dev/servers.json` configuration file:

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

### Configuration Options

- **command**: Shell command to start the server
  - `{PORT}`: Replaced with the assigned port
  - `{ROLE}`: Replaced with the server name
- **preferredPort**: Starting port number (auto-increments if busy)
- **healthCheck**: URL for health checking the server

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEV_LOG_VIEWER` | Default log viewer command | `tail -f` |
| `ENABLE_NOTIFICATIONS` | Enable/disable OS notifications | `true` |

### CLI Options

| Option | Description | Example |
|--------|-------------|---------|
| `--log-viewer "cmd"` | Custom log viewer command | `--log-viewer "bat -f"` |

## Project Structure

After initialization, your project will have:

```
your-project/
├── .dev/
│   ├── servers.json    # Server configurations (tracked in git)
│   ├── pid.json        # Running process tracking (gitignored)
│   └── log/            # Server log files (gitignored)
│       ├── frontend.log
│       └── backend.log
└── package.json
```

## Advanced Usage

### Custom Log Viewers

```bash
# Use bat for syntax highlighting
npx dev start frontend --log-viewer "bat -f"

# Use less for scrollable logs
npx dev start api --log-viewer "less +F"

# Set default via environment
export DEV_LOG_VIEWER="bat -f"
npx dev start
```

### Template Variables

Use `{ROLE}` and `{PORT}` template variables for dynamic configuration:

```json
{
  "multi-env": {
    "command": "NODE_ENV={ROLE} npm start --port {PORT} > .dev/log/{ROLE}.log 2>&1",
    "preferredPort": 3000,
    "healthCheck": "http://localhost:{PORT}/health"
  }
}
```

### Port Management

The tool automatically handles port conflicts:

```bash
# If port 3000 is busy, it tries 3001, 3002, etc.
npx dev start dev
# Started on port 3001 (3000 was busy)
```

### Disabling Notifications

```bash
# Disable OS notifications
ENABLE_NOTIFICATIONS=false npx dev start
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <strong>Made with care for developers who love efficient workflows</strong>
</div>
