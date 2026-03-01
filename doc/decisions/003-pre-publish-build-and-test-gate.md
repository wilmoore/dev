# 003. Pre-Publish Build and Test Gate

Date: 2026-03-01

## Status

Accepted

## Context

To maintain code quality and ensure that published NPM packages are functional, any artifact generated must pass the project's standard build and test routines before it is uploaded to the NPM registry.

## Decision

The publishing script enforces a mandatory execution of `npm run format:check`, `npm run build` (if applicable, or equivalent TypeScript check), and `npm test`. The publish step (`npm publish`) only proceeds if all preceding checks pass successfully.

## Consequences

- Positive: Prevents publishing of broken or improperly formatted code.
- Negative: Increases total time for a successful release cycle.

## Alternatives Considered

- Relying on CI/CD only: This would mean local development releases are untrusted.
- Skipping format check: Violates project standards defined in CLAUDE.md.

## Related

- Planning: .plan/.done/feat/npm-publish-script/plan.md
