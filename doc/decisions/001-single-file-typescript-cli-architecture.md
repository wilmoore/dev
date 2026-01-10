# 001. Single-file TypeScript CLI Architecture

Date: 2026-01-09

## Status

Accepted

## Context

The `@wilmoore/dev` package previously used a modular TypeScript architecture:
- Source code split across `src/config.ts`, `src/dev.ts`, `src/health.ts`, `src/log.ts`, `src/process.ts`
- Required compilation step via TypeScript compiler
- Test suite with Jest (`test/basic.test.ts`, `test/integration.test.ts`)
- ESLint configuration for linting
- Multiple tsconfig files for different build targets

Separately, a proven implementation existed within the Claude Code plugin system that:
- Was self-contained in a single ~1200 line TypeScript file
- Ran directly via `tsx` without compilation
- Had been battle-tested through plugin usage
- Included native OS notification support

The question was whether to continue evolving the modular architecture or adopt the proven plugin implementation.

## Decision

Replace the modular compiled TypeScript architecture with the plugin's single-file executable approach:

1. **Single entry point**: `bin/dev.ts` contains all CLI logic (~1200 lines)
2. **Direct execution**: Use `tsx` to run TypeScript without compilation
3. **Separate notification utility**: `bin/notify.ts` for OS notifications via `node-notifier`
4. **No test suite**: Removed Jest-based tests (implementation proven via plugin usage)
5. **Simplified tooling**: Prettier only, no ESLint

## Consequences

### Positive

- **Proven stability**: Adopting battle-tested code reduces bugs
- **Faster development**: No compilation step, changes take effect immediately
- **Simpler mental model**: All logic in one file, easy to understand and modify
- **Reduced dependencies**: Fewer dev dependencies to maintain
- **Single source of truth**: This package becomes the canonical implementation

### Negative

- **Larger single file**: ~1200 lines can be harder to navigate than smaller modules
- **No unit tests**: Relying on integration testing and real-world usage for validation
- **Less IDE support**: Module boundaries provided autocomplete hints

## Alternatives Considered

### Continue with modular architecture
- Rejected: Would require porting plugin features, maintaining two codebases

### Hybrid approach (keep modules, adopt tsx)
- Rejected: Added complexity without clear benefit; the single-file approach is working well

### Create shared library
- Rejected: Over-engineering for a CLI tool with a single consumer

## Related

- Planning: `.plan/.done/feature-adopt-plugin-dev-implementation/`
