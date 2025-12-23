# Development Best Practices Checklist

Use this checklist for each feature/PR to maintain code quality and mobile-friendly design.

## Branching & Workflow
- [ ] Branch from main and keep branches short-lived (days, not weeks)
- [ ] Use feature flags/toggles for incomplete work so code can land safely
- [ ] Rebase or sync with main at least daily to avoid large merge conflicts
- [ ] Follow trunk-based development for frequent integration

## Code Quality
- [ ] Follow existing code style and conventions (see design_guidelines.md)
- [ ] Run `npm run check` to verify TypeScript types
- [ ] Add/update tests for new functionality (when test infrastructure exists)
- [ ] Keep functions focused and single-responsibility
- [ ] Use meaningful variable and function names

## API & Contract Stability
- [ ] Validate API request/response with Zod schemas
- [ ] Add proper error handling with appropriate HTTP status codes
- [ ] Document any API changes or new endpoints
- [ ] Maintain backward compatibility when possible

## Component & Design System
- [ ] Use existing shadcn/ui components from `client/src/components/ui/`
- [ ] Follow design system guidelines (design_guidelines.md)
- [ ] Keep components small and reusable
- [ ] Use shared Tailwind tokens (spacing/colors/typography)

## PR Size & Review
- [ ] Keep PRs small and focused (<= ~200-400 changed lines where possible)
- [ ] Include screenshots for UI changes
- [ ] Add clear description of what changed and why
- [ ] Test manually before requesting review

## Mobile-Specific Rules
- [ ] Use mobile-first CSS with Tailwind responsive breakpoints (`sm:`, `md:`, `lg:`)
- [ ] Verify touch targets are at least 44x44px
- [ ] Test on actual mobile devices or Chrome DevTools device emulator
- [ ] Ensure responsive images and appropriate asset sizes
- [ ] Use lazy-loading for non-critical images and components

## Performance & Budgets
- [ ] Avoid unnecessary re-renders (use React.memo when appropriate)
- [ ] Optimize database queries (use indexes, limit results)
- [ ] Code-split and lazy-load features where feasible
- [ ] Monitor bundle size for significant increases

## Accessibility
- [ ] Add ARIA labels where needed
- [ ] Ensure keyboard navigation works
- [ ] Test with screen reader if changing navigation/critical UI
- [ ] Maintain proper heading hierarchy

## Documentation
- [ ] Update README.md if adding new setup steps
- [ ] Update relevant documentation for feature changes
- [ ] Add code comments for complex logic (match existing style)
- [ ] Keep design docs in sync with implementation

## Security
- [ ] Never commit secrets or API keys
- [ ] Validate and sanitize all user inputs
- [ ] Use parameterized queries (Drizzle handles this)
- [ ] Sanitize AI-generated content before displaying

## Before Merging
- [ ] Run `npm run check` successfully
- [ ] Test feature manually in browser
- [ ] Verify existing functionality still works
- [ ] Check that changes are minimal and focused
- [ ] Ensure no debug code or console.logs remain
