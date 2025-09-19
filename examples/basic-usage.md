# Basic Usage Examples

## Quick Start

```bash
# Initialize in your project
npx dev-server-manager init

# Start default server
npx dev-server-manager start

# Check status
npx dev-server-manager status
```

## Example Project Setup

### React + Node.js API

```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "api": "node server.js",
    "preview": "vite preview"
  }
}
```

After running `npx dev-server-manager init`, you'll get:

```json
// .dev/servers.json
{
  "dev": {
    "command": "npm run dev > .dev/log/dev.log 2>&1",
    "preferredPort": 3000,
    "healthCheck": "http://localhost:{PORT}"
  },
  "api": {
    "command": "npm run api > .dev/log/api.log 2>&1",
    "preferredPort": 3010,
    "healthCheck": "http://localhost:{PORT}"
  },
  "preview": {
    "command": "npm run preview > .dev/log/preview.log 2>&1",
    "preferredPort": 3020,
    "healthCheck": "http://localhost:{PORT}"
  }
}
```

### Starting Multiple Servers

```bash
# Start frontend
npx dev-server-manager start dev

# Start API in another terminal
npx dev-server-manager start api

# Check what's running
npx dev-server-manager status
# Output:
# Running servers:
#   dev: port 3000 (pid 12345) - healthy
#   api: port 3010 (pid 12346) - healthy
```

### Custom Health Checks

```json
{
  "api": {
    "command": "npm run start:api",
    "preferredPort": 3001,
    "healthCheck": "http://localhost:{PORT}/api/health"
  },
  "websocket": {
    "command": "npm run start:ws",
    "preferredPort": 8080,
    "healthCheck": "http://localhost:{PORT}/ws/ping"
  }
}
```

### Log Monitoring

```bash
# View logs with default viewer
npx dev-server-manager logs dev

# Use custom log viewer
npx dev-server-manager start api --log-viewer "bat -f"

# Set environment variable
export DEV_LOG_VIEWER="less +F"
npx dev-server-manager logs
```

## Advanced Configuration

### Template Variables

```json
{
  "multi-env": {
    "command": "NODE_ENV={ROLE} npm start --port {PORT} > .dev/log/{ROLE}.log 2>&1",
    "preferredPort": 3000,
    "healthCheck": "http://localhost:{PORT}/health"
  }
}
```

When running `npx dev-server-manager start multi-env`:
- `{ROLE}` becomes `multi-env`
- `{PORT}` becomes the assigned port (3000 or next available)

### Port Management

The tool automatically handles port conflicts:

```bash
# If port 3000 is busy, it tries 3001, 3002, etc.
npx dev-server-manager start dev
# Started on port 3001 (3000 was busy)
```

### Cleanup

```bash
# Remove stale process entries
npx dev-server-manager cleanup

# Stop all servers
npx dev-server-manager stop
```