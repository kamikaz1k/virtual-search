# Search Panels, iOS Keyboards, and the Visual Viewport

Living research notes for keeping Virtual Search controls reachable while
search navigation scrolls a page containing virtualized content.

This is working material for testing and a possible future blog post. Keep
failed approaches, contradictory results, device details, and raw measurements
instead of rewriting history around the eventual solution.

Last updated: 2026-08-01

## Status at a glance

- The production bug is reproducible on iOS: while the software keyboard is
  open, navigating to a virtualized result can move the search panel outside
  the visible viewport.
- Responsive Chromium testing does **not** reproduce the relevant iOS viewport
  behavior and is not sufficient validation.
- Pinning the panel to the top is simpler than pinning it to the bottom, but a
  CSS-only `position: fixed; top: ...` is not sufficient when iOS pans the
  visual viewport.
- The previous production top-anchor implementation is known to be incorrect.
  It deliberately removed vertical `visualViewport.offsetTop` compensation in
  commit `bba06ff` after a misleading Chromium test.
- The revised implementation and delayed-offset regression test passed a manual
  visual check in the iOS 26.5 Simulator. Physical-device validation remains
  necessary, and transition telemetry should still be captured in a repeat run.

## User-visible production reproduction

Environment reported by the user: iOS browser, production GitHub Pages demo.

1. Open <https://kamikaz1k.github.io/virtual-search/>.
2. Scroll to roughly the middle of the page.
3. Tap the floating **Find anywhere** button.
4. With the software keyboard open, type `Theo` one character at a time.
5. When the `o` is entered, the active match moves into a middle row of the
   first virtualized list and the virtualizer scrolls that row into view.
6. The search panel moves outside the visible viewport, so **Next** is no
   longer reachable.

Expected behavior:

- Result navigation may scroll either the document or an inner virtualizer.
- The search panel remains fully reachable in the visual viewport throughout
  keyboard presentation, viewport panning, and result navigation.
- **Next** advances to occurrence 2 without requiring the keyboard to close or
  the user to recover the panel manually.

## Mental model: two viewports

Mobile browsers expose two related coordinate systems:

1. The **layout viewport** is the area CSS uses to lay out the document.
2. The **visual viewport** is the portion currently visible after browser UI,
   pinch zoom, visual panning, and the software keyboard are accounted for.

Showing a software keyboard can shrink or pan the visual viewport without
resizing the layout viewport. On mobile, scrolling can change
`visualViewport.offsetTop` while ordinary window scroll values do not describe
the whole visible movement.

This matters because a supposedly fixed panel can remain fixed to a layout
viewport position that is no longer on screen. A top-anchored control therefore
needs to follow the visual viewport's top edge:

```text
visible top = visualViewport.offsetTop
desired panel top = visible top + padding
```

Safe areas complicate the exact expression. The desired invariant is closer to:

```css
top: max(
  calc(var(--visual-viewport-top) + var(--panel-padding)),
  env(safe-area-inset-top)
);
```

For our purposes, top anchoring is still preferable to bottom anchoring. It only
needs the visual viewport's origin. A bottom anchor needs both the origin and a
reliable, animated keyboard-adjusted height, plus safe-area behavior at the
bottom edge.

Authoritative background:

- [MDN: VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)
  describes the layout/visual viewport distinction, keyboard resizing, and a
  `position: fixed` “device-fixed” example that compensates using visual
  viewport offsets.
- [CSSOM View Module](https://w3c.github.io/csswg-drafts/cssom-view/) defines
  `VisualViewport`, including `offsetTop`, and includes keyboard-driven visual
  viewport behavior in its model.
- [W3C mobile viewport roadmap](https://www.w3.org/2019/11/web-roadmaps/mobile/adaptation.html)
  explains why fixed layout UI can be outside the portion currently visible
  and positions the Visual Viewport API as the adaptation mechanism.

## iOS and WebKit findings

### Viewport values can be temporarily stale

[WebKit bug 237851](https://bugs.webkit.org/show_bug.cgi?id=237851) reports
`visualViewport.offsetTop` sometimes being `0` inside the keyboard resize event
and becoming correct roughly 50 ms later. The report specifically notes that a
delayed read can see the correct value even when the event-time read was stale.

Implication: a single synchronous read in `resize` or `scroll` is not enough.
The panel needs at least one trailing resample, or a short bounded settling
period, after keyboard/focus/viewport transitions.

### Keyboard panning is not equivalent to document scrolling

[WebKit bug 311821](https://bugs.webkit.org/show_bug.cgi?id=311821) describes an
iOS 26 keyboard pan where DOM geometry moves while document scroll positions
remain zero. Its reproduction observes a negative body rectangle top and a
visual viewport offset even though `documentElement.scrollTop` and
`body.scrollTop` are zero.

Implications:

- Listening only to `window.scroll` is insufficient.
- Calling `window.scrollTo()` cannot necessarily undo the keyboard pan.
- Tests must record visual viewport values and element rectangles, not only
  `scrollY`.
- The behavior affects browsers using WebKit on iOS, not only the Safari app.

### WebKit still lacks cleaner keyboard controls

- [WebKit bug 259770](https://bugs.webkit.org/show_bug.cgi?id=259770) tracks
  support for `interactive-widget=resizes-content`. Without it, a page cannot
  simply opt into having the layout viewport become the keyboard-visible area.
- [WebKit bug 230225](https://bugs.webkit.org/show_bug.cgi?id=230225) tracks the
  VirtualKeyboard API. The API would provide more explicit control and keyboard
  inset information, but it is not currently a dependable iOS solution.
- [VirtualKeyboard API specification](https://w3c.github.io/virtual-keyboard/)
  defines overlay behavior and keyboard inset environment variables, which are
  useful future options once WebKit support is available.

### Other known iOS edge cases

- [WebKit bug 292603](https://bugs.webkit.org/show_bug.cgi?id=292603) reports an
  extra safe-area-sized scrollable strip with the keyboard open. This is
  relevant to bottom anchoring and to assumptions that `100dvh` exactly equals
  usable keyboard-visible space.
- [WebKit bug 300523](https://bugs.webkit.org/show_bug.cgi?id=300523) reports an
  iOS 26 Dynamic Island viewport shift around scrolling and keyboard closing.
- [WebKit bug 312149](https://bugs.webkit.org/show_bug.cgi?id=312149) reports
  intermittent incorrect painting of bottom-fixed elements on iOS 26. This is
  another reason not to make bottom anchoring the default.
- [WebKit bug 191204](https://bugs.webkit.org/show_bug.cgi?id=191204) is an older
  umbrella report describing unreliable fixed positioning, viewport metrics,
  and caret-driven scrolling while the software keyboard is visible.

## Approaches tried in this project

### 1. Demo-specific responsive repositioning

The first iterations adjusted the custom demo panel with responsive CSS and
visual viewport handling. This improved the demo but did not satisfy the
library goal: consumers using the built-in `SearchPanel` need the same behavior.

Decision: viewport management belongs in the reusable React component/hook,
while styling remains consumer-controlled.

### 2. Bottom anchoring to the visual viewport

The panel was initially treated like a bottom sheet on mobile. This proved
fragile because the visual viewport's bottom edge changes throughout the iOS
keyboard animation. Safe-area behavior and browser toolbar animation added more
moving inputs.

Decision: prefer a top anchor. This reduces the required calculation, but does
not eliminate visual viewport tracking.

### 3. Top CSS plus rectangle-based correction

`useSearchPanelViewport()` originally:

- set a CSS top anchor;
- listened to visual viewport resize/scroll and window scroll;
- measured `getBoundingClientRect()`;
- translated the panel back inside the visual viewport.

This was directionally correct, but it trusted the viewport value available in
that one update. It did not explicitly account for WebKit exposing a corrected
`offsetTop` after the event without another dependable event.

### 4. CSS-only top anchoring — failed

Commit `bba06ff` removed vertical correction for top mode and stopped listening
to window scroll in that mode. The reasoning was that CSS should be the sole
owner of a fixed top position.

That reasoning applies when the fixed-position containing viewport is the same
as the visible viewport. It does not hold when iOS pans the visual viewport
inside an unchanged layout viewport. The user can still reproduce the panel
leaving the screen in production.

This change passed our tests because those tests did not produce an iOS
keyboard or a nonzero, delayed visual viewport pan.

### 5. Current candidate — Simulator observed, physical device pending

The local candidate:

- restores top anchoring relative to `visualViewport.offsetTop`;
- publishes the offset through `--virtual-search-viewport-top`;
- listens to visual viewport resize and scroll, document scroll, and panel
  focus transitions;
- performs bounded resampling after those transitions so a late WebKit offset
  can be observed;
- retains `viewportAnchor="preserve"` for application-owned positioning;
- adds a unit regression where `offsetTop` changes after the triggering event
  and no second event is emitted.

Current status: 28 unit tests pass, typechecking passes, the production build
succeeds, and the user reports that the original flow remains usable in an
iPhone 17 Pro / iOS 26.5 Simulator run with the software keyboard visible. This
is encouraging device-level evidence, but it is not a substitute for the
planned physical-device matrix or captured transition telemetry.

Open design question: determine the smallest reliable settling policy on real
devices. Candidates include one or more delayed trailing reads, a short
`requestAnimationFrame` loop, and a `scrollend` read where supported. Prefer the
simplest policy demonstrated reliable across the test matrix.

## Why the previous harness was inadequate

The earlier “mobile” verification used desktop Chromium with a 390 × 844
viewport. It tested responsive layout, not Mobile Safari keyboard behavior.

Specific gaps:

- No software keyboard was presented.
- `visualViewport.offsetTop` stayed at `0`.
- Playwright's `fill()` did not reproduce tap → focus → keyboard animation.
- The test only measured geometry after navigation had settled.
- The unit mock returned a constant element rectangle.
- The mock changed `offsetTop` synchronously before dispatching the event.
- It did not represent a stale event-time value followed by a silent correction.
- It did not sample the transition between `T`, `Th`, `The`, and `Theo`.

Responsive desktop-browser testing remains useful for CSS breakpoints and
basic navigation, but it cannot serve as proof for this bug.

## Required validation layers

### Unit tests

Unit tests should cover deterministic policy:

- top mode incorporates the visual viewport top;
- a delayed offset change is observed during the bounded settling period;
- visual viewport and document scroll events schedule updates;
- focus/blur transitions schedule trailing updates;
- preserve mode does not overwrite the consumer's anchor;
- cleanup cancels frames/listeners and restores original inline styles;
- oversized panels remain internally scrollable within the usable height.

### Desktop browser tests

Use Chromium responsive mode to verify:

- mobile visual styling and touch-target sizes;
- `Theo` search order and virtualizer navigation;
- **Next** remains enabled and advances results;
- desktop behavior remains unchanged;
- no horizontal overflow at common viewport widths.

Do not label these tests as iOS keyboard validation.

### iOS Simulator tests

Apple supports WebDriver sessions targeting iOS Simulator using
`platformName: "iOS"` and `safari:useSimulator: true`. See
[WebDriver is Coming to Safari in iOS 13](https://webkit.org/blog/9395/webdriver-is-coming-to-safari-in-ios-13/)
and [Apple's WebDriver documentation](https://developer.apple.com/documentation/safari-developer-tools/webdriver/).

Required flow:

1. Use an iPhone simulator in portrait orientation.
2. Load the production-like build, not a special simulator-only component.
3. Scroll the page to the middle.
4. Tap **Find anywhere** using a synthesized touch.
5. Confirm the actual software keyboard is visible.
6. Type `T`, `h`, `e`, `o` as separate input events.
7. Capture telemetry before typing and after every character.
8. Wait through the keyboard and scroll animations while continuing telemetry.
9. Confirm the first virtualized result is active and the panel remains visible.
10. Tap **Next** and confirm occurrence 2 is active and controls remain visible.
11. Repeat after closing/reopening the panel and after keyboard dismissal.

Current simulator setup:

- Xcode contains an iOS 26.5 runtime.
- An iPhone 17 Pro simulator is booted.
- The demo can be opened in Simulator Safari.
- Safari Web Inspector can attach to the running Simulator page and collect DOM
  and visual viewport measurements without production-only test code.
- iOS still requires a trusted physical tap to present the software keyboard;
  programmatic focus and console-driven clicks do not create that activation.
- After that manual activation, the user reports the candidate passed the
  original interaction visually in Simulator.
- Fully automated Safari WebDriver remains unavailable until Remote Automation
  and the Xcode developer path receive administrator authorization.

### Physical-device tests

The simulator uses WebKit but cannot cover every device/browser-UI interaction.
Before calling the issue fully resolved, repeat the core case on at least:

- a current iPhone and iOS release in Safari;
- iOS Chrome or another WKWebView browser;
- an older supported iOS release if available;
- a Dynamic Island device and a non-Dynamic-Island device;
- portrait and landscape;
- keyboard open, keyboard closing, and keyboard reopened;
- browser toolbar expanded and collapsed;
- pinch zoom at the library's supported zoom policy.

## Telemetry harness

Record state over time instead of taking only before/after measurements. This
snippet is intended for a development harness or WebDriver script, not the
production library:

```js
const samples = [];
const panel = document.querySelector("[data-virtual-search-panel]");

function sample(reason) {
  const vv = window.visualViewport;
  const rect = panel?.getBoundingClientRect();

  samples.push({
    at: performance.now(),
    reason,
    activeElement: document.activeElement?.tagName,
    window: {
      innerHeight: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    },
    document: {
      clientHeight: document.documentElement.clientHeight,
      scrollTop: document.documentElement.scrollTop,
      bodyTop: document.body.getBoundingClientRect().top,
    },
    visualViewport: vv && {
      height: vv.height,
      width: vv.width,
      offsetLeft: vv.offsetLeft,
      offsetTop: vv.offsetTop,
      pageLeft: vv.pageLeft,
      pageTop: vv.pageTop,
      scale: vv.scale,
    },
    panel: rect && {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      inlineTop: panel.style.top,
      inlineTranslate: panel.style.translate,
    },
  });
}

for (const eventName of ["resize", "scroll", "scrollend"]) {
  window.visualViewport?.addEventListener(eventName, () => {
    sample(`visualViewport:${eventName}`);
  });
}

window.addEventListener("scroll", () => sample("window:scroll"), {
  passive: true,
});
document.addEventListener("focusin", () => sample("document:focusin"));
document.addEventListener("focusout", () => sample("document:focusout"));
```

During a focused investigation, also sample every animation frame for a short,
bounded interval after focus and navigation. This reveals offset changes that
are not paired with a trustworthy event. Do not ship perpetual frame sampling.

## Minimal standalone reproduction

Use this to separate browser behavior from Virtual Search and the virtualizer:

```html
<!doctype html>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>
  body { margin: 0; min-height: 300vh; }
  #panel {
    position: fixed;
    z-index: 10;
    top: max(10px, env(safe-area-inset-top));
    left: 10px;
    right: 10px;
    padding: 12px;
    background: white;
    border: 2px solid black;
  }
  #target { margin-top: 180vh; }
  input { font-size: 16px; }
</style>

<form id="panel">
  <input id="query" type="search" value="Theo">
  <button type="button" id="next">Next</button>
</form>
<button id="target">Theo target</button>

<script>
  next.onclick = () => target.scrollIntoView({ block: "center" });
</script>
```

Test first with pure CSS. Then add visual viewport compensation and compare the
event/geometry timeline. The important interaction is tapping the input so the
real keyboard appears before invoking `scrollIntoView()`.

## Success invariants

For every captured sample after the short settling allowance:

```text
panel.top >= visualViewport.offsetTop + padding
panel.bottom <= visualViewport.offsetTop + visualViewport.height - padding
```

If WebKit reports rectangles in a coordinate space inconsistent with its
visual viewport metrics, record both the numeric invariant and the screenshot.
The user-visible screenshot takes precedence over an apparently correct CSSOM
value when investigating browser painting defects.

Functional invariants:

- search retains focus while results navigate;
- typing does not cause stale searches to move the panel later;
- the result row is mounted, highlighted, and visible;
- previous/next controls remain reachable;
- closing search restores focus appropriately;
- the solution is part of the reusable built-in component, not demo-only code;
- consumers can opt out or use `viewportAnchor="preserve"` when they own layout.

## Test matrix and findings log

Add one row per meaningful run. Preserve failures after they are fixed.

| Date | Build/commit | Device | OS/browser | Orientation | Keyboard | Toolbar | Query/action | Result | Evidence/notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-01 | `bba06ff` production | iPhone reported by user | iOS browser | Portrait | Open | Unknown | Scroll middle → open → type `Theo` | **Fail** | First virtualizer navigation moves panel out of view |
| 2026-08-01 | `bba06ff` production | Desktop Playwright | Chromium, 390 × 844 | Portrait-sized | None | N/A | Scroll to 2200 → `Theo` → Next | Pass, but invalid for iOS claim | `offsetTop` stayed 0; panel top measured 10 px |
| 2026-08-01 | local candidate | jsdom/Vitest | Simulated delayed offset | N/A | Simulated | N/A | Offset changes after event | Pass | Policy regression only; not browser validation |
| 2026-08-01 | local candidate | iPhone 17 Pro Simulator | iOS 26.5 Safari | Portrait | Open | Bottom toolbar | Middle scroll → open → `Theo` navigation | Pass (manual visual check) | User reports the panel remained usable; repeat later for exported transition telemetry |

Suggested evidence for each device run:

- screen recording or before/during/after screenshots;
- exported telemetry JSON;
- exact URL and commit SHA;
- whether the page came from dev server, preview build, or production Pages;
- whether input was tapped or populated through a method that bypassed keyboard;
- whether Reduce Motion, page zoom, or external keyboard settings differed.

## Open questions

1. How long after the last viewport/focus/scroll event can iOS expose a corrected
   `offsetTop` without another event?
2. Is a single trailing read sufficient, or is bounded frame sampling required?
3. Does `visualViewport.scrollend` fire reliably for keyboard-driven panning on
   every supported iOS version?
4. During the reported `Theo` case, is the decisive movement a window scroll,
   a visual viewport pan, an inner virtualizer scroll, or a combination?
5. Do `getBoundingClientRect()` and `visualViewport.offsetTop` share a consistent
   coordinate system throughout the animation?
6. Does adding the offset through `top` paint more reliably than applying it via
   `translate` on affected WebKit versions?
7. How should pinch zoom interact with panel scaling and horizontal correction?
8. What is the minimum supported iOS version for the library?
9. Should the settling duration be configurable, internal, or replaced when
   WebKit implements a more reliable keyboard API?

## Chronology in this repository

- `48abfbe` — kept the mobile search panel in the visual viewport.
- `6eb2a93` — moved visual viewport guarding into the reusable `SearchPanel`.
- `0066bf8` — improved demo navigation and mobile top positioning.
- `bba06ff` — removed vertical correction for top anchoring; later confirmed by
  the user to still fail on iOS.
- Current candidate — restores visual-top tracking and adds delayed-offset
  testing; passed a manual iOS 26.5 Simulator check and awaits physical-device
  validation.

## Blog-post angles to preserve

- “Responsive mode is not a mobile keyboard.”
- Why `position: fixed` can still leave the visible screen.
- The failed simplification: top anchoring is easier, not free.
- Why before/after screenshots miss transient viewport bugs.
- Virtualization makes the issue easier to trigger because search navigation
  intentionally performs large programmatic scrolls while the input stays
  focused.
- A library must expose escape hatches without forcing every consumer to learn
  WebKit viewport archaeology.
