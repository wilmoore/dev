# 001. Version Bumping Strategy

Date: 2026-03-01

## Status

Accepted

## Context

To ensure a repeatable and consistent release process for new features and fixes, we needed a standardized way to manage version increments before creating artifacts and publishing. Manually tracking versions in `package.json` is error-prone.

## Decision

We decided to use the `npm version <type>` command within the new publishing script. This command atomically updates `package.json` and creates a corresponding git tag, satisfying prerequisites for automated release workflows.

## Consequences

- Positive: Versioning is now integrated with git tagging, reducing manual steps.
- Negative: Requires that the branch has a clean working directory before execution.

## Alternatives Considered

- Manually updating `package.json` and using `sed`/`edit` to tag: Too brittle and error-prone.
- Relying solely on GitHub actions for versioning: Lacks local development flow verification.

## Related

- Planning: .plan/.done/feat/npm-publish-script/plan.md
