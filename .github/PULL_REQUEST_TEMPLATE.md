# PR template

## Summary
- Short summary of what this PR changes and why.

## What I changed
- Add viewport meta tag for mobile scaling.
- Add responsive/mobile-first stylesheet and a small device-detect helper (if applicable).
- Brief notes on any components that were modified.

## How to test
1. Pull branch locally and run the app.
2. Visit the app in desktop browser, then in mobile device emulator (Chrome devtools Device Toolbar) and a real device if available.
3. Verify layout adapts at common breakpoints (320px, 375px, 414px, 768px).
4. Verify touch targets are large enough and text is readable.
5. Attach screenshots (mobile & desktop) in the PR.

## Checklist
- [ ] Viewport meta present and correct
- [ ] Layout behaves correctly at small screen widths
- [ ] Touch targets >= 44x44px (or close)
- [ ] Images use responsive rules (max-width: 100% or srcset)
- [ ] No horizontal scrolling on mobile
- [ ] Accessibility smoke check (keyboard/tap order, color contrast)
- [ ] CI passes (unit/lint)

## Notes
- If this introduces visual changes, include before/after screenshots.
- Link to design doc: (paste link)
