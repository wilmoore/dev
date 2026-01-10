# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `@wilmoore/dev` - a development server management tool with process monitoring, health checks, and log management. It's a CLI tool built with TypeScript that helps developers manage multiple development servers in a single project.

## Common Commands

```bash
# Run the dev tool
npm start

# Format code
npm run format
npm run format:check
```

## Architecture

The codebase is a self-contained TypeScript CLI:

### Core Files (`bin/`)
- **`dev.ts`** - Main CLI script (~1200 lines, all-in-one)
- **`notify.ts`** - Native OS notification utility using node-notifier

### Key Concepts

#### Server Configuration
- Servers are defined in `.dev/servers.json` with command, preferredPort, and healthCheck
- Template variables: `{PORT}` for dynamic port assignment, `{ROLE}` for server name
- Automatic server inference from package.json scripts during `init`

#### Process Management
- PID tracking in `.dev/pid.json` with port, startTime, and status
- Automatic port conflict resolution (tries ports sequentially)
- Health checks before marking servers as successfully started
- Process cleanup and stale entry detection

#### Log Management
- Centralized logging in `.dev/log/` directory
- Configurable log viewers via `--log-viewer` flag or `DEV_LOG_VIEWER` environment variable

### File Structure
```
bin/
├── dev.ts        # Main CLI script
└── notify.ts     # Notification utility

assets/
└── logo-banner.png  # Logo for README and notifications

.dev/             # Runtime directory (created in target projects)
├── servers.json  # Server configuration (tracked in git)
├── pid.json      # Process tracking (gitignored)
└── log/          # Log files (gitignored)
```

## Development Notes

- Built for Node.js >= 18.0.0
- Targets macOS and Linux platforms only
- Uses ES modules (type: "module" in package.json)
- Runs TypeScript directly via `tsx` (no compilation step)
- Dependencies: `node-notifier` for OS notifications, `tsx` for TypeScript execution

## Key Implementation Details

- Server commands are executed via shell (`sh -c`) to handle redirection
- Process detection uses `ps` and `lsof` commands for Unix-like systems
- Health checks are HTTP-based with configurable endpoints and exponential backoff
- Port detection attempts to discover actual listening ports from running processes
- Process tree killing ensures all child processes are cleaned up
