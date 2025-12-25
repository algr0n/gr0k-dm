---
name: 'Feature: Encounter versioning & DM Editor'
about: 'Persist encounter versions and add DM UI to review and accept/rollback edits'
labels: ['feature','backend','dm']
assignees: []
---

## Summary
Enable storing versions of encounters (stages) and provide endpoints/UI for the DM to review generator edits, accept/reject them, and roll back to previous versions.

## Acceptance criteria ✅
- [ ] DB schema extended to store versions for `combat_encounters` (version number, createdBy, createdAt, metadata snapshot).
- [ ] New endpoints: `GET /api/encounters/:id/versions`, `PUT /api/encounters/:id/versions/:versionId/rollback`, `POST /api/encounters/:id/generate-edit` (already present, add accept flow).
- [ ] DM Panel UI to list versions, preview a version, accept or rollback.
- [ ] Tests for persistence of versions and rollback behavior.

## Notes 🔍
- Keep a retention policy (configurable) to avoid unbounded growth.
- Record LLM prompt and parsed output in the version metadata for audit.

## Estimated effort
- 2–4 days

---

Add notes or blockers:

- 
