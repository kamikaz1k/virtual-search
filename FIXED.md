# Fixed bugs

## 2026-08-01

- Diff demo: a shorter matching query such as `rel` remained highlighted after
  continuing to a non-matching query such as `relo`.
  - Fix: clear the diff viewer's shadow-DOM highlight whenever the query or
    panel state changes, and prevent an aborted reveal from restoring it.
  - Verified: demo tests, TypeScript, production build, and a Chromium browser
    regression confirming the CSS Highlight registry is empty for `relo`.
