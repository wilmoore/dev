# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-09-19

### Added
- Initial release of dev-server-manager
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
- **Aliases**: dsm shorthand command
- **Platform Support**: macOS and Linux

### Technical Details
- Built with ES modules
- Requires Node.js >=18.0.0
- Uses child_process, fs, path, and util built-ins
- Implements fetch for health checks
- Process management with SIGTERM handling
- File-based PID and configuration storage