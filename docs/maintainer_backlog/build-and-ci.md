# Build and CI Backlog

## Repeated research dataset work during build

Several static routes call `getResearchDataset()`, which loads the full research universe. A production build can therefore fetch and compute the same dataset multiple times.

Possible follow-ups:

- Add request/build-pass memoization around the research dataset.
- Split route-specific data loaders so lightweight pages do not need the full dataset.
- Consider whether data-heavy pages should be dynamic instead of statically generated.

Review criteria:

- CI remains keyless.
- Fallback disclosure remains visible.
- Build logs do not expose secrets.
- Tests cover cache invalidation or memoization behavior.
