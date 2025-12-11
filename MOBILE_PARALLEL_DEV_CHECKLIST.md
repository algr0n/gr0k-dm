# Mobile + Parallel Development Checklist

Use this checklist on each feature/design/PR to keep mobile-friendly work safe when many people work in parallel.

## Branching & workflow
- [ ] Branch from main/trunk and keep branches short-lived (days, not weeks).
- [ ] Use feature flags/toggles for incomplete work so code can land safely.
- [ ] Rebase or sync with trunk at least daily to avoid large merge conflicts.
- [ ] Prefer trunk-based flow for frequent integration; create integration branches only when necessary.

## API & contract stability
- [ ] Add/agree on OpenAPI/GraphQL schema changes before implementing.
- [ ] Provide mock servers or contract stubs for frontend/backends to work in parallel.
- [ ] Add API versioning / deprecation plan for breaking changes.

## Component & design system
- [ ] Implement UI as small, reusable components (component-driven development).
- [ ] Add components to the shared component library or Storybook before consuming them widely.
- [ ] Use shared tokens (spacing/colors/typography) to avoid per-feature drift.

## PR size & review
- [ ] Keep PRs small and focused (<= ~200-400 changed lines where possible).
- [ ] Include screenshots / device screenshots and Storybook links for UI changes.
- [ ] Run accessibility checks and include results for UI changes.
- [ ] Add a short QA checklist in the PR description (screens, OS versions tested).

## Testing
- [ ] Unit tests for logic and snapshot tests for components where appropriate.
- [ ] Integration tests for feature flows and API interactions (use mocked network).
- [ ] E2E tests for critical user journeys (run in CI on a matrix of devices/emulators).
- [ ] Visual regression tests for visual changes (Percy/Chromatic or equivalent).

## Mobile-specific rules
- [ ] Mobile-first CSS and responsive breakpoints defined and reused.
- [ ] Verify touch targets, font sizes, and accessible tap spacing.
- [ ] Ensure viewport meta tag and correct scaling behavior for web/mobile web.
- [ ] Implement responsive images (srcset/picture) and serve appropriately sized assets.
- [ ] Use lazy-loading for non-critical images and components.

## Performance & budgets
- [ ] Define performance budgets (bundle size, main-thread work, time-to-interactive).
- [ ] Run Lighthouse or Web Vitals checks on CI for builds.
- [ ] Code-split and lazy-load features where feasible.

## CI/CD & parallelization
- [ ] CI runs unit and integration tests on PRs; run E2E and heavy checks on main or nightly.
- [ ] Cache build artifacts and node/android/ios toolchains to speed CI.
- [ ] Use parallel CI jobs and device farms to avoid serial slowdowns (matrix by OS, screen size).

## Device testing & matrix
- [ ] Maintain a prioritized device/OS matrix (lowest supported OS, popular device sizes).
- [ ] Use device labs or services (Firebase Test Lab, BrowserStack, Sauce Labs) for real-device testing.
- [ ] Automate screenshot capture for core screens across device sizes.

## Accessibility & localization
- [ ] Run automated a11y scans; fix reported high-severity issues.
- [ ] Keep localization keys and allow for variable-length UI testing.
- [ ] Allow QA with large-font / RTL / different locales.

## Monitoring & rollout
- [ ] Use feature flags for staged rollouts (canary, incremental %).
- [ ] Add runtime monitoring for crashes, slow interactions, and frontend errors.
- [ ] Capture user metrics and real-device performance to validate assumptions.

## Developer experience & tooling
- [ ] Provide a reproducible dev environment: devcontainer, docker-compose, or a script to start mocks.
- [ ] Document how to run the app on an emulator/device and how to use mocks.
- [ ] Enforce linters, formatters, and pre-commit hooks in CI and locally.

## Collaboration & communication
- [ ] Add CODEOWNERS for core areas to route reviews.
- [ ] Use Storybook/Design previews for design sign-off before large UI merges.
- [ ] Keep the design doc synced with code: reference the design doc in PRs that implement it.

## Merge & release
- [ ] Protect main/trunk with required status checks and review count.
- [ ] Prefer small, frequent releases with feature flags rather than big, risky launches.
- [ ] Document rollback steps for features that are behind flags.
