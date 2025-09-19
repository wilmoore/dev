# Dev Server Manager

[![npm version](https://badge.fury.io/js/dev-server-manager.svg)](https://badge.fury.io/js/dev-server-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)](https://github.com/wilmoore/dev-server-manager)

> A sophisticated development server management tool with process monitoring, health checks, and log management.

![Dev Server Manager Banner](./assets/banner.png)

## ✨ Features

- 🚀 **Intelligent Server Management** - Start, stop, and monitor multiple development servers
- 🔍 **Process Monitoring** - Real-time health checks and PID tracking
- 📊 **Port Management** - Automatic port conflict resolution and detection
- 📝 **Log Management** - Centralized logging with real-time log viewing
- ⚙️ **Auto-Configuration** - Automatically infers server configurations from package.json
- 🎯 **Zero Dependencies** - Built with Node.js built-ins only
- 🛡️ **Process Cleanup** - Automatic cleanup of stale processes
- 📺 **Log Viewer Integration** - Customizable log viewers (tail, bat, etc.)

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g dev-server-manager

# Or use with npx
npx dev-server-manager --help
```

### Basic Usage

```bash
# Initialize in your project
npx dev-server-manager init

# Start the first configured server
npx dev-server-manager start

# Start a specific server
npx dev-server-manager start frontend

# Check running servers
npx dev-server-manager status

# View logs
npx dev-server-manager logs

# Stop all servers
npx dev-server-manager stop
```

## 📖 Documentation

### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `init` | Initialize .dev directory and infer servers from package.json | `dsm init` |
| `start [server]` | Start a server (default: first server) | `dsm start frontend` |
| `stop [server]` | Stop server(s) (default: all) | `dsm stop backend` |
| `status` | Show running servers with health status | `dsm status` |
| `port` | Show server ports | `dsm port` |
| `logs [server]` | Monitor server logs in real-time | `dsm logs api` |
| `cleanup` | Remove stale entries from PID tracking | `dsm cleanup` |

### Shortcuts

You can use server names directly as commands:

```bash
# These are equivalent
npx dev-server-manager start frontend
npx dev-server-manager frontend
```

### Configuration

The tool automatically creates a `.dev/servers.json` configuration file:

```json
{
  "frontend": {
    "command": "vite --mode development > .dev/log/{ROLE}.log 2>&1",
    "preferredPort": 3000,
    "healthCheck": "http://localhost:{PORT}"
  },
  "backend": {
    "command": "npm run server --port {PORT} > .dev/log/{ROLE}.log 2>&1",
    "preferredPort": 3001,
    "healthCheck": "http://localhost:{PORT}/health"
  }
}
```

#### Configuration Options

- **command**: Shell command to start the server
  - `{PORT}`: Replaced with the assigned port
  - `{ROLE}`: Replaced with the server name
- **preferredPort**: Starting port number (auto-increments if busy)
- **healthCheck**: URL for health checking the server

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEV_LOG_VIEWER` | Default log viewer command | `tail -f` |

### CLI Options

| Option | Description | Example |
|--------|-------------|---------|
| `--log-viewer "cmd"` | Custom log viewer command | `--log-viewer "bat -f"` |

## 🏗️ Project Structure

After initialization, your project will have:

```
your-project/
├── .dev/
│   ├── servers.json    # Server configurations
│   ├── pid.json        # Running process tracking
│   └── log/            # Server log files
│       ├── frontend.log
│       └── backend.log
└── package.json
```

## 🔧 Advanced Usage

### Custom Log Viewers

```bash
# Use bat for syntax highlighting
npx dev-server-manager start frontend --log-viewer "bat -f"

# Use less for scrollable logs
npx dev-server-manager start api --log-viewer "less +F"

# Set default via environment
export DEV_LOG_VIEWER="bat -f"
npx dev-server-manager start
```

### Health Check Customization

Configure custom health check endpoints for your servers:

```json
{
  "api": {
    "command": "npm run start:api",
    "preferredPort": 3001,
    "healthCheck": "http://localhost:{PORT}/api/health"
  },
  "websocket": {
    "command": "npm run start:ws",
    "preferredPort": 3002,
    "healthCheck": "http://localhost:{PORT}/ws/ping"
  }
}
```

### Process Monitoring

The tool automatically monitors running processes and cleans up stale entries:

```bash
# Check what's running
npx dev-server-manager status

# Output:
# Running servers:
#   frontend: port 3000 (pid 12345) - healthy
#   backend: port 3001 (pid 12346) - healthy

# Clean up any stale processes
npx dev-server-manager cleanup
```

## 🛠️ Development

### Project Architecture

```
src/
├── DevServerManager.js  # Main orchestrator class
├── ConfigManager.js     # Configuration management
├── ProcessManager.js    # Process lifecycle management
├── LogManager.js        # Log handling and viewing
├── HealthChecker.js     # Server health verification
└── index.js            # Public API exports
```

### Running Tests

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Linting
npm run lint
npm run lint:fix

# Formatting
npm run format
npm run format:check
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Node.js built-in modules for maximum compatibility
- Inspired by modern development workflow needs
- Designed for simplicity and reliability

---

<div align="center">
  <strong>Made with ❤️ for developers who love efficient workflows</strong>
</div>