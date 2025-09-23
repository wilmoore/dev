# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `dev` - a sophisticated development server management tool with process monitoring, health checks, and log management. It's a CLI tool built with TypeScript that helps developers manage multiple development servers in a single project.

## Common Development Commands

### Build and Development
- `npm run build` - Build the TypeScript project using tsconfig.build.json
- `npm start` - Run the dev tool directly

### Testing
- `npm test` - Run both basic and integration tests
- `npm run test:basic` - Run basic tests only (test/basic.test.ts)
- `npm run test:integration` - Run integration tests only (test/integration.test.ts)
- `npm run test:watch` - Run tests in watch mode

### Code Quality
- `npm run lint` - Lint TypeScript files in src/, bin/, and test/ directories
- `npm run lint:fix` - Auto-fix linting issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

### Documentation
- `npm run docs:generate` - Generate documentation (via scripts/generate-docs.js)

### Release Process
- `npm run prepublishOnly` - Build, lint, and test before publishing (runs automatically)

## Architecture

The codebase follows a modular architecture with clear separation of concerns:

### Core Modules (`src/`)
- **`dev.ts`** - Main orchestrator and CLI command handler, contains argument parsing and command routing
- **`config.ts`** - Configuration management for servers.json and project initialization
- **`process.ts`** - Process lifecycle management including starting, stopping, and monitoring servers
- **`log.ts`** - Log handling and viewer integration
- **`health.ts`** - Server health verification via HTTP checks
- **`index.ts`** - Public API exports

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
src/
├── dev.ts        # Main CLI orchestrator
├── config.ts     # Configuration and initialization
├── process.ts    # Process lifecycle management
├── log.ts        # Log handling
├── health.ts     # Health checking
└── index.ts      # API exports

bin/dev           # Executable entry point
test/             # Basic and integration tests
```

## Testing Framework

Uses custom test runner with ts-node, not Jest or other frameworks. Tests are in:
- `test/basic.test.ts` - Basic functionality tests
- `test/integration.test.ts` - Integration tests

## Development Notes

- Built for Node.js >= 18.0.0
- Targets macOS and Linux platforms only
- Uses ES modules (type: "module" in package.json)
- TypeScript with multiple tsconfig files for different contexts
- No external runtime dependencies (built with Node.js built-ins only)
- Global installation preferred (`preferGlobal: true`)

## Key Implementation Details

- Server commands are executed via shell (`sh -c`) to handle redirection
- Process detection uses `ps` and `lsof` commands for Unix-like systems
- Health checks are HTTP-based with configurable endpoints
- Port detection attempts to discover actual listening ports from running processes
- Template variable replacement for dynamic configuration