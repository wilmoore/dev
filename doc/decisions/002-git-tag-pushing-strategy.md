# 002. Git Tag Pushing Strategy

Date: 2026-03-01

## Status

Accepted

## Context

After updating the version and creating a git tag via `npm version`, the tag must be pushed to the remote repository to register the new version externally and allow CI/CD systems to build official releases.

## Decision

The publishing script will use `git push --follow-tags` after successfully bumping the version and committing the change. This ensures that any newly created version tags are pushed along with the version commit.

## Consequences

- Positive: Tags are published reliably with the version commit.
- Negative: If the version commit fails to push, the tags are orphaned locally.

## Alternatives Considered

- Running `git push origin --tags` separately: Causes an extra command execution step and higher chance of race conditions if interleaved with other operations.
- Relying on `npm publish`: `npm publish` only publishes the package, not the tag to Git.

## Related

- Planning: .plan/.done/feat/npm-publish-script/plan.md
