# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-09

### Changed
- **Breaking**: Complete architecture rewrite - now a self-contained TypeScript CLI
- **Breaking**: Switched from compiled output to running TypeScript directly via `tsx`
- **Breaking**: Removed modular `src/` architecture in favor of single `bin/dev.ts`
- Updated to use `tsx` instead of `ts-node` for TypeScript execution
- Simplified package structure for easier maintenance

### Added
- Native OS notifications via `node-notifier` for server events
- `doctor` command for environment diagnostics
- `restart` command for quick server restarts
- Network IP display in status output for mobile/device testing
- Process tree killing for cleaner shutdown of spawned processes
- Exponential backoff for health checks

### Removed
- Compiled `dist/` output (no build step required)
- Modular `src/` directory (consolidated into `bin/dev.ts`)
- Test suite (tests were for old architecture)

## [1.0.0] - 2024-09-19

### Added
- Initial release of dev
- Core server lifecycle management (start, stop, status)
- Process monitoring with PID tracking
- Health check system for server verification
- Automatic port management and conflict resolution
- Centralized log management with real-time viewing
- Auto-configuration from package.json scripts
- Stale process cleanup functionality
- Custom log viewer support
- Zero-dependency architecture using Node.js built-ins
- CLI shortcuts for common operations
- Comprehensive documentation and examples

### Features
- **Commands**: init, start, stop, status, port, logs, cleanup
- **Configuration**: JSON-based server configuration
- **Monitoring**: Real-time process health monitoring
- **Logging**: Centralized log files with tail support
- **Ports**: Automatic port detection and management
- **Health Checks**: Configurable HTTP health endpoints
- **Template Variables**: {PORT} and {ROLE} substitution
- **Environment Variables**: DEV_LOG_VIEWER support
- **Aliases**: dev shorthand command
- **Platform Support**: macOS and Linux

### Technical Details
- Built with ES modules
- Requires Node.js >=18.0.0
- Uses child_process, fs, path, and util built-ins
- Implements fetch for health checks
- Process management with SIGTERM handling
- File-based PID and configuration storage
