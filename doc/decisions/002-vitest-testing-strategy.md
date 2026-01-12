# 002. Vitest Testing Strategy

Date: 2026-01-12

## Status

Accepted

## Context

ADR-001 established a single-file TypeScript CLI architecture, deliberately removing the previous Jest-based test suite. The rationale was that the implementation had been "battle-tested through plugin usage."

However, as the project matures and becomes the canonical implementation for `@wilmoore/dev`, several factors drive the need for automated testing:

1. **Backlog item #2** explicitly requested E2E testing
2. **Regression prevention** as features are added or modified
3. **CI/CD integration** for quality gates on pull requests
4. **Documentation** through executable test specifications
5. **Confidence** when refactoring the ~1300-line single file

The previous test approach (Jest with modular architecture) was removed because it was tied to the modular architecture. A fresh testing strategy was needed that:
- Works with the current single-file architecture
- Supports ESM and TypeScript without compilation
- Handles process management testing (spawning, killing)
- Provides fast feedback for pure function unit tests

## Decision

Adopt **Vitest** as the testing framework with a three-tier testing strategy:

### 1. Unit Tests (Pure Functions)
Fast, isolated tests for deterministic functions:
- `sanitizeServerName()` - String transformation
- `parseArguments()` - CLI argument parsing
- `detectPortFromOutput()` - Regex pattern matching
- `getLogViewerCommand()` - Config resolution

### 2. Integration Tests (Config & HTTP)
Tests requiring real resources but no process spawning:
- Config file structure validation
- Template variable replacement
- Health check with mock HTTP server

### 3. E2E Tests (Full CLI)
Complete workflow tests using the actual CLI:
- `help` command output
- `status` with empty pid.json
- `doctor` configuration display
- `cleanup` of stale entries
- `logs` when server not running
- `stop` for non-running servers
- Error handling for missing config

### Test Infrastructure
- **Vitest**: Modern, fast, native ESM support
- **Mock HTTP server**: For health check testing
- **CLI runner helper**: Execute CLI and capture output
- **Config backup/restore**: Prevent test pollution

### CI/CD
GitHub Actions workflow running on:
- Ubuntu and macOS
- Node.js 18, 20, 22
- Format check, unit, integration, and E2E tests
- Coverage reporting via Codecov

## Consequences

### Positive
- **Regression prevention**: Automated tests catch breaking changes
- **Documentation**: Tests serve as executable specifications
- **Confidence**: Safe to refactor the large single file
- **CI/CD**: Quality gates prevent merging broken code
- **Fast feedback**: Unit tests run in milliseconds

### Negative
- **Maintenance overhead**: Tests require updates when behavior changes
- **Config file constraints**: E2E tests share project's .dev/ directory
- **Port conflicts**: E2E tests need careful port isolation
- **Function duplication**: Unit tests duplicate function code from dev.ts

### Trade-offs
- **No function exports**: Pure functions are duplicated in unit tests rather than exported from dev.ts (preserves single-file simplicity)
- **Sequential E2E**: Tests run sequentially to avoid config file conflicts (slower but more reliable)
- **Local testing only**: Tests the local bin/dev.ts, not the published npm package

## Alternatives Considered

### Node.js Built-in Test Runner
- Rejected: Less ecosystem support, fewer features than Vitest

### Jest
- Rejected: Slower startup, ESM support still maturing

### Export functions for testing
- Rejected: Would clutter the module's API; duplication is acceptable for unit tests

### Test published package
- Rejected: Adds publish-test cycle complexity; local testing sufficient for CI

### No Tests (Status Quo)
- Rejected: Technical debt accumulates, regressions likely

## Related

- ADR-001: Single-file TypeScript CLI Architecture
- Backlog item #2: E2E testing request
- `.plan/feature-automated-testing-strategy/PLAN.md`: Implementation planning
