# Native Find-in-Page behavior and Virtual Search parity

Research collected 1 August 2026. This document covers browser **Find in
Page** for web documents: the feature normally opened by Cmd/Ctrl+F. It does
not treat site search, address-bar search, browser history search, PDF search,
or text-fragment navigation as the same feature, although those surfaces are
called out where they affect an embedded client.

## Executive summary

There is no complete, interoperable Find-in-Page algorithm. The HTML Standard
defines the user-query/match/active-match model, selection interaction, and
the reveal sequence for `<details>` and `hidden="until-found"`. It deliberately
does not define how a user agent converts a rendered page to searchable text,
how strings compare, where a new search starts, how frames are ordered, or
most UI and session behavior. Those details belong to browser engines and, on
macOS and mobile, partly to the OS.

Virtual Search already implements the central Find model well: incremental
literal search, a complete occurrence count, an active occurrence, next and
previous navigation with wrapping, two classes of highlights, reveal before
scroll, cancellation, mutation refresh, and focus restoration. Its unique
capability—searching unmounted application data—is outside native Find and is
the reason to keep a custom implementation.

The largest parity gaps are:

1. **Rendered-text extraction.** The implementation searches raw DOM text
   with a hard-coded HTML block list. Native engines search layout-derived
   text. CSS `display`, whitespace collapsing/preservation, `<br>`, generated
   text, form-control internals, ruby annotations, slots, and shadow trees all
   affect the native surface.
2. **Text controls.** Page `<input>` and `<textarea>` values are excluded. In
   Blink they are searched as isolated layout blocks and the active substring
   can be selected inside the control. This is the input-highlighting gap that
   motivated this audit.
3. **International matching.** Lowercasing plus NFC is not native-equivalent.
   Chromium uses ICU collation and by default ignores case and accent
   differences; Firefox exposes separate Match Case and Match Diacritics
   controls and defaults to ignoring diacritics. Kana width/script handling,
   quote folding, soft hyphens, and locale-sensitive word boundaries also
   differ from the current matcher.
4. **Search topology.** Native browser Find can search subframes and browser-
   privileged composed/anonymous content. The library deliberately omits
   iframes and implicit shadow roots and cannot reach a closed shadow root or
   a cross-origin frame from page JavaScript without cooperation.
5. **Starting point and selection.** Native Find may anchor a new search at the
   current selection, caret, active match, or visible area; it may turn the
   active match into the document selection. Virtual Search always selects
   match zero for a new query and paints a CSS highlight without changing the
   document selection.
6. **Find-box and OS state.** Native implementations preserve queries per tab,
   can prefill from selected page text, select the query when Find is invoked
   again, and on macOS may use the system Find pasteboard. The built-in Virtual
   Search panel does select its existing query, but does not implement page-
   selection prefill, a Find pasteboard, or persistence across navigation.
7. **Entry points.** The library handles Cmd/Ctrl+F and Cmd/Ctrl+G only in the
   top document. It does not handle F3/Shift+F3, macOS “Use Selection for
   Find,” Firefox Quick Find, shortcuts originating in an iframe, or the
   browser-owned mobile menu item. Mobile therefore requires a visible
   application control or a native client bridge.

## Reading the tables

- **Supported** means the repository has an implementation and tests or a
  clear contract for the behavior.
- **Partial** means the common case works but the native surface is broader.
- **Missing** means native browsers commonly expose it and Virtual Search does
  not.
- **Different by design** means the difference is explicit and useful, not
  necessarily a bug.
- **Verify** means the behavior is implementation-defined or has recently
  changed and belongs in the cross-browser fixture before becoming a promise.

## 1. Find interface, query, and session behavior

| Native behavior | Browser/client notes | Virtual Search today | Status |
| --- | --- | --- | --- |
| Cmd+F on macOS and Ctrl+F on Windows/Linux/ChromeOS opens Find and focuses its field | Browser chrome owns the real UI. A page can cancel the keystroke only while its own document receives the event. | Capture listener opens the custom panel. | Supported in the top document |
| Invoking Find again focuses the field and selects the current query | Chromium calls `SetFocusAndSelection`; this is the “highlight the find input text” behavior, distinct from searching page form values. | `useFindShortcut()` focuses and calls `select()`; `SearchPanel` also selects on open. Custom panels must preserve the required selector or implement it. | Supported for the query field |
| Page selection may prefill the new Find query | Chromium accepts selected text up to 250 UTF-16 units when the platform Find bar allows it, selects the prefill, computes counts/highlights, and initially avoids a surprise jump. Firefox behavior is platform/preference dependent. | No selection prefill. | Missing |
| Existing query is retained after closing/reopening | Chrome preserves a tab's last query; Firefox retains the bar value. Exact restart/active-match behavior differs. | Query and active occurrence are retained. Opening or refocusing does not navigate or scroll; the former reset-on-open option is deprecated. | Supported, policy differs |
| Query can persist across tabs or applications | Chromium preserves per-tab state and can prepopulate a new tab from recent Find state. macOS supplies a global Find pasteboard; “Use Selection for Find” can update it. Private/incognito separation applies. | State is scoped to one provider instance and is lost with the page/application lifecycle. | Missing; probably optional |
| Search runs incrementally as committed text changes | Browser UIs normally search on every committed edit. Chromium explicitly waits for IME composition to commit. | Controlled input calls `setQuery` for every React `onChange`, including browser/framework-dependent composition updates. | Partial; add composition guard |
| Empty query has no results or active match | Normal across browsers. | Implemented. | Supported |
| Result UI reports active ordinal and total | Chrome/Edge and Safari show a count; Firefox shows `N of M`, “Phrase not found,” and may cap display as “More than 1000 matches.” Counts may arrive asynchronously. | Complete `N of M`; `aria-busy` while searching. | Supported; no count cap |
| No-result state is perceivable | Browsers use text, field styling, and sometimes an audible cue. | “No results” in an ARIA live output. | Supported, presentation differs |
| Escape closes Find and removes or converts highlights according to browser policy | Firefox documents Escape as closing and canceling highlighting. Browser selection may remain after closing. | Closes, clears custom highlights, and restores the pre-open focused element. | Supported, selection differs |
| Browser navigation/reload/tab switch updates Find state | Per-browser: the bar may stay open, close, retain its query, or recompute after navigation. | Page lifecycle destroys state unless application code preserves it. | Missing / host responsibility |

### Important clarification about “input highlighting”

There are two separate behaviors:

1. **Selecting the query in the custom Find field on Cmd/Ctrl+F:** already
   supported by both `useFindShortcut()` and the built-in `SearchPanel`.
2. **Finding and highlighting a matching substring in a page's own `<input>`
   or `<textarea>` value:** supported for text-like controls as a separate
   corpus document. The opt-in `inputValueHighlighting` API uses an inert mirror
   overlay for exact substring painting without stealing focus from the Find
   field. Password and non-text controls are excluded; autofill and unusual
   layout cases still need broader browser validation.

## 2. Query matching semantics

| Matching dimension | Native behavior/support surface | Virtual Search today | Status |
| --- | --- | --- | --- |
| Literal substring | Default in mainstream browsers; no regular expressions in their ordinary web-page Find UI. | Literal `indexOf`. | Supported |
| Case | Default is insensitive. Firefox offers Match Case. Chromium's public web-page UI has no ordinary Match Case toggle; embedded APIs may expose it. | Insensitive by default; optional `caseSensitive`. | Supported at API level |
| Diacritics/accents | Chromium's ICU primary-strength comparison ignores case and accent differences by default. Firefox separately exposes Match Diacritics and defaults to ignoring them. Safari's exact collation is engine/locale dependent. | NFC-equivalent spellings match, but `cafe` does **not** match `café`. | Missing native-default parity |
| Canonical equivalence | Engines use Unicode/ICU search; composed and decomposed forms commonly match. | NFC normalization with offset mapping. | Supported for canonical NFC cases |
| Compatibility equivalence | Chromium treats Hiragana, Katakana, and half-width Katakana as equivalent in tested cases, while preserving distinctions users perceive as different (small kana and voicing). Width, ligature, and compatibility behavior is engine/locale dependent. | No NFKC/width/script collation. | Missing / verify desired policy |
| Locale-sensitive casing | ICU search handles more than simple lowercase; Turkish I, Greek sigma, German sharp S, and length-changing folds need tests. | `toLowerCase()` without an explicit locale. Some length changes are mapped per grapheme, but this is not a collator. | Partial |
| Whole words | Firefox offers Whole Words. Chromium engine and embedded APIs have whole-word capability even though Chrome's ordinary Find UI does not expose it. Word boundaries are Unicode/locale aware. | No whole-word option. | Missing optional mode |
| Safari prefix mode | Safari on macOS exposes “Contains” versus “Starts With” in its Find pop-up. This is not equivalent to whole-word matching. | Substring only. | Missing Safari-specific option |
| Firefox links-only mode | `'` opens Quick Find (links only); `/` opens timed Quick Find. | No links-only corpus/filter and no Quick Find entry point. | Missing Firefox-specific modes |
| Overlapping occurrences | Engines normally enumerate non-overlapping results; this still needs an explicit fixture (`aaaa` / `aa`) for all targets. | Non-overlapping (`from = start + needle.length`). | Likely aligned; verify |
| Quote variants | Blink folds quote-mark variants before ICU search. Exact equivalences should be fixture-tested. | Exact code points only. | Missing |
| Soft hyphens and discretionary breaks | Blink folds soft hyphens and treats `<wbr>` as transparent, allowing a visual word to match across it. | `<wbr>` is transparent; U+00AD remains literal. | Partial |
| Whitespace | Native matching uses layout text: collapsed runs become one space; preserved newlines/spaces under `white-space` remain meaningful; `<br>` creates a line break. | Raw text-node whitespace plus hard-coded `\n` separators for selected HTML tags. | Major gap |
| Across inline elements | Native matches can span inline text nodes in the same uninterrupted inline formatting context. | Text nodes concatenate within a DOM segment. | Supported in simple cases |
| Across block/layout boundaries | Blink does not match across actual layout block boundaries, text controls, replaced elements, or several anonymous/shadow boundaries. `display:contents` remains transparent. | Boundaries come from tag names, not computed layout. A CSS-block `<span>` may be joined; an inline/contents `<div>` is split. | Major gap |
| Bidirectional text | Search operates on logical text order, not the visual glyph order; highlights render in visual fragments. | DOM/source order. | Mostly aligned; range QA needed |
| Ruby | Current Blink can match base text or annotation readings through separate buffers and avoids invalid mixtures. | Raw DOM concatenation can create false cross-base/annotation matches. | Missing |
| Text transforms and generated glyph shaping | Whether search follows source or rendered transforms and how ligatures map is engine-specific. Browser engines retain offset maps back to DOM positions. | Searches source strings. | Verify; do not promise parity |

Do not replace the matcher with `Intl.Collator` without prototyping offset and
performance behavior. A native-like matcher needs **all matches with source
offsets**, not only equality/order, and collation can change match length.

## 3. What page content participates

| Content type/state | Native behavior/support surface | Virtual Search today | Status |
| --- | --- | --- | --- |
| Visible DOM text | Searchable. | Searchable. | Supported |
| `script`, `style`, comments, templates | Not part of ordinary rendered-page Find. | Excluded (`template` and `noscript` included in the exclusion policy). | Supported |
| `display:none`, regular `hidden` | Not searchable in normal browser behavior. | Excluded. | Supported |
| `visibility:hidden`/`collapse` | Blink excludes non-visible layout text. | Excluded through computed style. | Supported for hidden |
| `inert` | HTML says user agents should ignore inert nodes for Find. | Excluded. | Supported |
| `content-visibility:hidden` | Not available to user-agent Find unless it is an activatable reveal state such as Hidden Until Found. | Excluded, except `hidden=until-found`. | Supported in common case |
| `content-visibility:auto` offscreen content | The CSS containment model makes skipped `auto` content available to Find and activates/scrolls it as needed. | DOM text is indexed even when layout content is currently skipped. | Search supported; reveal QA needed |
| Closed `<details>` body | HTML requires synchronous search access; choosing an active match queues ancestor reveal and opens the details element, producing a `toggle` event. Modern engines implement this, with recent fixes around exclusive accordions. | Included; active navigation opens closed ancestors before locating. | Supported; event/timing not exact |
| `hidden="until-found"` | Searchable; active-match reveal fires bubbling `beforematch`, rechecks connection/state, removes `hidden`, then scrolls. The element needs a revealable box; `display:none`, `contents`, or `inline` defeats the mechanism. Modern support reached Baseline in late 2025, so older clients remain a concern. | Included; dispatches an untrusted non-bubbling `Event` by default, then removes `hidden`. It does not recheck every standard precondition or box requirement. | Partial; event must bubble and cancellation/mutation cases need tests |
| Application tabs/accordions using ordinary `hidden`/CSS | Native Find generally cannot discover content that has been removed from layout. Authors must use `hidden=until-found` or reveal integration. | Same for ordinary DOM; a registered virtual region can opt into application-specific reveal. | Different by design, useful |
| `<input>` values | Blink exposes actual visible/autofilled text through user-agent shadow content and treats the control as a Find boundary. Suggested-but-uncommitted autofill values are deliberately not searched. Password and non-text controls need privacy/engine tests. | Text-like live values are indexed as boundaries; passwords and non-text controls are excluded. Exact paint is an opt-in overlay. | Experimental; autofill and layout QA remain |
| `<textarea>` values | Searchable in native engines as a separate control surface; a multiline textarea has special layout handling. | Live values are indexed separately; exact paint is an opt-in wrapping mirror. | Experimental; multiline geometry QA remains |
| `<select>/<option>` | Blink searches listbox/multiple options but not the closed one-line menu-list implementation. Engines may differ. | Both select and option excluded. | Missing / browser-specific |
| Placeholder, accessible name, `alt`, `title`, ARIA labels | Find is primarily rendered text, not the accessibility name. Placeholder and replaced-element rules vary; do not silently index metadata as if native. | Not searched. | Usually aligned; fixture-test exceptions |
| `contenteditable`/`designMode` | Rendered text is searchable; active selection and editing interactions can be special. | Ordinary DOM text is searchable. | Partial; selection/edit mutation behavior differs |
| CSS `::before`/`::after`, list markers, counters | Generated text support has changed over time and differs by engine. Firefox explicitly added anonymous/generated-content Find support; Blink's layout-derived pipeline can traverse pseudo/anonymous content. Exact marker/counter coverage needs tests. | Not in DOM corpus. | Missing / verify target engines |
| Open and closed author shadow roots | Browser internals can traverse the flat/composed tree beyond normal page-script access. Matching and selection across shadow boundaries have recent engine bugs. | No implicit traversal. Custom regions can return explicit ranges where the application has access. | Missing by default; closed roots require owner cooperation |
| Slots and fallback content | Native traversal follows the flat tree: assigned nodes appear at slots; undisplayed light/fallback content should not be double-counted. | Light DOM is traversed from the ordinary root; shadow presentation is not modeled. | Missing / can miscount web components |
| User-agent shadow/anonymous content | Enables Find in text controls and some generated/fallback surfaces. | Inaccessible to ordinary page JS. | Fundamentally unavailable without client API |
| Same-origin iframe | Native tab Find commonly searches subframes and aggregates results. | Excluded; parent shortcut listener also does not receive a focused frame's keydown. | Missing |
| Cross-origin iframe | Browser chrome can search it because it is not constrained by same-origin page script. Firefox's extension Find API explicitly searches all frames. | Parent page cannot inspect it. Requires cooperative messaging, an extension, or host API. | Fundamental page-library limitation |
| SVG text | Rendered `<text>` is commonly searchable; exact fragment/range behavior needs browser QA. | Text nodes are indexed if under the root, but HTML-only boundary classification is incomplete. | Partial |
| Canvas/WebGL/image pixels/video | No searchable DOM text; OCR/Lens is a separate product feature. | Not searched. | Aligned |
| Unmounted virtualized records | Native Find sees only content represented in the engine's searchable/rendered tree. | Data-backed registered regions include all records. | Better than native by design |
| DOM retained offscreen or visually clipped | If text still has searchable visible layout, native Find may match it even when clipped, translated offscreen, transparent, or visually obscured. This is distinct from semantic visibility. | Corpus often includes it; `isRangeVisible` checks attributes/CSS but not opacity, clipping, coverage, or zero area. | Mostly aligned; define policy |

## 4. Match ordering, active match, navigation, and selection

| Behavior | Native support surface | Virtual Search today | Status |
| --- | --- | --- | --- |
| One active match; optionally highlight all others | Required model in HTML. Chrome highlights all and uses scrollbar markers; Firefox makes Highlight All a user option. | Always highlights all mounted matches plus active. Unmounted matches count but cannot be painted. | Supported with deliberate virtualization exception |
| New-search starting anchor | Often based on current selection/caret, prior Find selection, focus, or visible position. Exact precedence is not standardized and differs by engine. | Always index 0. | Missing; current “native restart” wording is too strong |
| Forward/backward navigation | Enter/down/next advances; Shift+Enter/up/previous reverses. | Implemented. | Supported |
| Wrap at document ends | Mainstream browsers wrap and may announce “continued from top/bottom.” Android WebView documents wrapping. | Wraps silently. | Core supported; wrap announcement missing |
| Keyboard Find Again after bar closes | Cmd/Ctrl+G and Shift+Cmd/Ctrl+G; F3 and Shift+F3 on Windows/Linux browsers. Firefox documents these even with no visible bar. | Cmd/Ctrl+G only while custom panel is open; no F3. | Missing |
| Search order | Logical/flat-tree document order, with engine-defined aggregation across frames and separate layout buffers. CSS visual reordering normally does not redefine text order. | DOM segment / virtual anchor / application unit order. | Supported for declared corpus; topology differs |
| Active match scrolls into view | HTML model requires the active match to be highlighted and scrolled. Engines scroll nested ancestors and account for their own overlay; Chromium may move the Find bar when it covers the result. | Checks only vertical window bounds, then calls `scrollIntoView` on the range's start parent. | Partial |
| Horizontal/writing-mode/nested-scroll visibility | Browser layout has range fragments and scroll-container knowledge. | No horizontal check, clipping/occlusion check, writing-mode logic, or panel-overlap avoidance. | Missing |
| Active match affects document selection | HTML explicitly permits the active match range to dictate document selection at engine-chosen points. Closing Find may clear, keep, or activate the selection. | CSS highlight only; `window.getSelection()` is unchanged. | Missing / policy decision |
| Copy or activation after Find | A retained native selection may be copied; Electron exposes clear/keep/activate-selection stop actions. Chromium notes ordinary Find is not a general way to activate controls. | No conversion to a normal selection or activation. | Missing optional behavior |
| Focus | Native browser UI owns focus while the page match is active. Page focus/caret consequences vary, especially for text controls. | Find input keeps focus; close restores prior element. Revealing an input match would require special policy. | Supported for DOM text; unresolved for controls |

## 5. Highlight rendering and accessibility

Native visual presentation is not a stable API contract. Chrome currently uses
yellow match highlights, a stronger active color, and scrollbar tick marks.
Firefox can highlight all and may dim the rest of the page. Safari uses its own
overlay/dimming treatment. Colors change with theme, forced colors, contrast
settings, and platform releases.

Virtual Search should promise semantics, not pixel parity:

- active versus inactive matches are distinguishable;
- foreground/background contrast remains readable;
- forced-colors and high-contrast modes receive visible indicators;
- highlights work across multiple range rectangles, bidi runs, zoom, and
  writing modes;
- no-result, searching, result count, active ordinal, and wrap state are
  announced without excessive live-region chatter;
- active navigation does not steal focus from the query field;
- reduced motion is respected;
- mounted/unmounted highlight differences do not make the count misleading.

The CSS Custom Highlight API is a good non-mutating renderer, but it is not the
same thing as the user-agent's Find highlight or document selection. It cannot
paint an unmounted record, and styling in shadow trees depends on highlight
rules being present in the relevant tree. The repository already diagnoses
missing shadow highlight styles; it still needs forced-colors and fallback
policy for clients without Custom Highlight support.

## 6. Mutation, loading, and performance behavior

Native implementations scan asynchronously on large documents, cancel stale
queries, and can report provisional counts. Their behavior after a DOM
mutation, lazy/infinite loading, navigation, or stylesheet/layout change is
not consistently specified; some changes are only reflected after another
Find action.

Virtual Search is stronger and more deterministic in several ways:

- query and navigation requests are abortable;
- a mutation observer reruns an active query for child, text, and selected
  visibility attribute changes;
- registered data can invalidate explicitly;
- the count includes all declared virtual records.

Remaining surface area:

- observer coverage omits relevant attributes such as `open`, `value`, slot
  assignment, iframe/shadow changes, and layout-affecting stylesheet changes;
- computed layout boundaries can change without a mutation inside the root;
- automatic rescans of a large corpus can be expensive or chatty;
- “complete count” needs an explicit contract for server-paged/infinite data;
- result identity preservation is exact-offset based and can move after text
  edits before the same semantic occurrence;
- native engines may cap or progressively report totals, while Virtual Search
  currently promises a complete in-memory total.

## 7. Browser, OS, and embedded-client differences

### Chromium browsers: Chrome, Edge, Brave, Opera, desktop Android variants

- Core Blink behavior is layout-derived: flat-tree traversal, layout
  visibility, block boundaries, text-control internals, whitespace offset
  mapping, ICU matching, quote/soft-hyphen folding, and ruby handling.
- Chrome's desktop Find overlay does not relayout the page. It can move or
  scroll content when it obscures the active result and shows scrollbar result
  markers.
- Chrome/Edge expose Cmd/Ctrl+F and Cmd/Ctrl+G; Windows/Linux also conventionally
  use F3. Edge documents Ctrl/Cmd+G and the shifted previous form.
- Chrome has no ordinary desktop toggles for case, diacritics, whole words, or
  regex, even though underlying/embedded APIs expose some options.
- Query/selection state is browser chrome state, with per-tab preservation and
  special macOS Find-pasteboard behavior.

### Firefox desktop

- Full Find exposes Highlight All, Match Case, Match Diacritics, and Whole
  Words. The result count can stop at a configured limit (default source value
  1000) and report “More than N matches.”
- `/` opens timed Quick Find and `'` opens links-only Quick Find when focus is
  not in a text field. A preference can start Quick Find whenever the user
  types.
- Cmd/Ctrl+G or F3 repeats Find even when the full bar is hidden; shifted forms
  go backward.
- Firefox's generated/anonymous-content and recent `<details>` implementation
  history means CSS-generated text, controls, exclusive accordions, and
  shadow boundaries deserve dedicated regression fixtures.

### Safari and WebKit on macOS

- Safari exposes Contains versus Starts With matching in the Find pop-up.
- Cmd+F, Cmd+G, Shift+Cmd+G, the Edit > Find menu, “Use Selection for Find,”
  and the macOS global Find pasteboard are part of the expected platform
  experience.
- WebKit added/fixed auto-expanding `<details>` and, by late 2025, modern
  `beforematch` support; older Safari/WebViews remain deployed.
- A custom fixed panel must coexist with the visual viewport, safe areas, page
  zoom, and the software keyboard; the repository's top-anchored mobile panel
  already addresses much of this UI surface.

### iPhone and iPad browsers

- Safari's Find entry point is in the Page menu. Chrome on iOS exposes Find in
  Page in its own More menu. A webpage cannot intercept either browser-owned
  menu command.
- Hardware-keyboard Cmd+F may deliver a cancelable event while page content is
  focused, but it cannot be the only entry point. A visible app search control
  is required.
- All iOS browsers have historically shared significant WebKit platform
  behavior, although browser UI, Find state, and OS-version availability still
  differ. Treat iOS browser brand and iOS version as separate test axes.
- Software keyboard, visual viewport, orientation, safe area, pinch zoom, and
  16px input sizing affect the custom UI but not match semantics.

### Chrome/Firefox/Edge on Android

- Find is primarily a browser menu command, not a webpage event. Hardware
  keyboards add Ctrl+F/F3 possibilities but cannot replace a visible trigger.
- Chrome documents highlight markers along the scrollbar on Android. Browser
  versions and OEM WebView updates can change native Find independently of the
  OS release.
- Firefox Android shares Gecko matching but its mobile UI need not expose all
  desktop Find toggles or shortcuts.

### Embedded clients

| Client | Native capability | Consequence for Virtual Search |
| --- | --- | --- |
| Android `WebView` | `findAllAsync`, `findNext`, `FindListener`, count/progress, wrap, highlight, clear. The old built-in `showFindDialog` is documented as unreliable across Android versions; a custom dialog is recommended. | Host can choose Blink's DOM-only Find or bridge a native toolbar to the data-backed controller. The latter is required for unmounted records. |
| iOS/macOS `WKWebView` | `find(_:configuration:)`, `WKFindResult`, and `UIFindInteraction`/`findInteractionEnabled` provide a native Find navigator on supported OS versions. | A native toolbar can use WebKit Find for DOM-only content or call the Virtual Search bridge for the complete virtual corpus. |
| Electron | `webContents.findInPage` supports direction, new/follow-up session, and match case; `found-in-page` reports active ordinal, total, selection area, and final update. `stopFindInPage` can clear, keep, or activate selection. | Electron can own a truly native-engine Find UI, but still needs application data integration for unmounted records. |
| Firefox extension | `browser.find.find` searches all frames and supports case-sensitive/whole-word options plus range/rect data; highlighting is a separate call and stored results are global across extensions. | An extension can exceed page-script frame access, but it still cannot infer records absent from every document. |

### PDFs, reader modes, translations, and browser-generated pages

Built-in PDF viewers, reader modes, view-source, translated pages, and browser
internal pages have their own text models and Find UIs. A page-level shortcut
override may not run at all, and overriding it is usually undesirable. A host
application should disable Virtual Search interception outside its controlled
HTML document and treat PDF/document search as a separate adapter.

## 8. Constraints no page library can fully overcome

1. It cannot read, extend, style, or synchronize the browser's native Find UI
   or native query.
2. It cannot receive a mobile browser-menu Find command.
3. It cannot inspect cross-origin frame DOM from the parent page.
4. It cannot inspect a closed shadow root that the component owner does not
   expose or register.
5. It cannot search user-agent anonymous content with browser-level fidelity.
6. It cannot highlight data that has no rendered range; it can only count it,
   mount/reveal it, then highlight it.
7. It cannot guarantee interception while focus is in browser chrome,
   DevTools, a PDF viewer, a different document/frame, or an OS-level surface.

These are architecture boundaries, not ordinary bugs. Exact native coverage
for those cases requires a browser extension or an embedding-client API.

## 9. Recommended parity backlog

### P0: correctness gaps likely to surprise users

1. Harden the shipped text-input and textarea value support: validate disabled,
   readonly, autofill and suggested values, multiline scroll, RTL, custom
   fonts, zoom, transformed-control fallback, and focus preservation across
   browser engines.
2. Replace tag-name text serialization with a rendered-text abstraction that
   respects computed layout boundaries and `white-space`. Keep the data-region
   contract separate because application data has no layout yet.
3. Add accent-insensitive, Unicode-aware matching as the browser-like default
   or clearly rename the current semantics. Preserve exact source offsets.
4. Correct `hidden=until-found`: `beforematch` should bubble; recheck connection
   and hidden state after the handler; honor revealable-box constraints; test
   nested and removed/reparented nodes.
5. Add iframe policy and shortcut coverage. At minimum, document top-document
   scope and provide a cooperative same-origin/registered-frame adapter.

### P1: native interaction parity

1. Start a new query from a configurable anchor: document start, current
   selection/caret, active element, or visible viewport. Do not call document
   start the universally native behavior.
2. Prefill from selected page text with a length limit and no initial surprise
   jump; retain query-field select-all on repeated Cmd/Ctrl+F.
3. Handle IME composition commit, F3/Shift+F3, and repeat-Find shortcuts when
   the panel is closed. Consider macOS Use Selection for Find only as an
   opt-in because it overlaps OS state.
4. Announce wrap direction and audit live-region output with VoiceOver, NVDA,
   JAWS, and TalkBack.
5. Improve range visibility/scrolling for horizontal overflow, nested scrollers,
   clipping, writing modes, fixed headers, panel overlap, and multi-rect ranges.
6. Add an optional “convert active highlight to Selection on close” policy if
   copy-after-Find is a product goal.

### P2: extended/browser-specific surface

1. Whole-word, Match Case, Match Diacritics, Safari Starts With, and Firefox
   links-only modes.
2. Open-shadow/slot adapters and an owner-provided closed-shadow registration
   API.
3. Select/listbox option behavior, SVG, ruby, CSS generated content, quote
   folding, soft hyphens, kana/width equivalence, and bidi edge cases.
4. Query persistence across application navigation and optional host-level Find
   state integration for Electron/WKWebView/Android WebView.
5. Forced-colors, dark mode, print, zoom, and older-browser highlight fallback.

## 10. Cross-browser conformance fixture

Because the standard leaves core matching details undefined, keep an HTML
fixture and manually/automatically record results for current Chrome, Edge,
Firefox, and Safari on macOS and Windows, plus Chrome/Firefox Android and
Safari/Chrome iOS. Record browser **version**, engine version, OS, locale,
keyboard/input method, page zoom, and active Find settings.

Minimum cases:

- query-field select-all on first open, repeated open, close/reopen, tab switch,
  navigation, page selection, and macOS Find pasteboard;
- starting point with a page selection, input caret, contenteditable caret,
  focused link, scrolled viewport, and prior active match;
- `aaaa`/`aa`, empty query, emoji/graphemes, composed/decomposed accents,
  accentless query, Turkish I, Greek sigma, sharp S, ligatures, smart quotes,
  soft hyphen, ZWJ/ZWNJ, full/half-width Kana, and whole-word boundaries;
- collapsed/normal/pre/pre-wrap/pre-line whitespace, `<br>`, `<wbr>`, inline
  splits, CSS block/inline/contents overrides, flex/grid/table, bidi, ruby;
- input/textarea current value, default value, autofill/suggested value,
  password, readonly/disabled, placeholder, one-line select, listbox/multiple;
- `display:none`, `visibility:hidden`, `opacity:0`, clipping, offscreen transform,
  regular hidden, inert, `content-visibility:hidden/auto`, zero-size content;
- nested closed details, exclusive details groups, nested Hidden Until Found,
  bubbling/event order, handler removal/reparenting, invalid display modes;
- CSS pseudo text, counters/markers, SVG text, alt/title/ARIA metadata;
- open/closed nested shadow roots, slots, fallback and undistributed light DOM,
  user-agent control shadow content;
- same-origin and cross-origin frames, nested frames, sandboxed frames;
- mutation while Find is open, lazy load, virtual/infinite list, stylesheet and
  responsive breakpoint changes;
- nested horizontal/vertical scrollers, RTL and vertical writing, sticky/fixed
  overlays, browser Find overlay collision, zoom and mobile visual viewport;
- closing semantics, document selection, copy, link/control activation, focus
  restoration, and screen-reader announcements.

## Primary sources

- [HTML Standard: Find-in-page, selection, details, and Hidden Until Found](https://html.spec.whatwg.org/multipage/interaction.html#find-in-page)
- [HTML Standard: `hidden` and `inert`](https://html.spec.whatwg.org/multipage/interaction.html#the-hidden-attribute)
- [CSS Containment Level 2: skipped contents and user-agent features](https://drafts.csswg.org/css-contain/)
- [Chromium Blink finder overview](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/core/editing/finder/README.md)
- [Chromium `FindBuffer`: flat tree, visibility, controls, layout boundaries, ICU preparation](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/core/editing/finder/find_buffer.cc)
- [Chromium `FindBuffer` tests: whitespace, blocks, controls, Unicode, ruby](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/core/editing/finder/find_buffer_test.cc)
- [Chromium Find bar controller: selection prefill, focus/selection, session behavior](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/chrome/browser/ui/find_bar/find_bar_controller.cc)
- [Chromium Find-in-Page UI design](https://chromium.googlesource.com/playground/chromium-org-site/+/refs/heads/main/user-experience/find-in-page/index.md)
- [Chrome Help: desktop Search within a page](https://support.google.com/chrome/answer/95440)
- [Firefox Help: Find bar, Quick Find, options, and shortcuts](https://support.mozilla.org/en-US/kb/search-contents-current-page-text-or-links)
- [Firefox source strings and result-count limit behavior](https://searchfox.org/mozilla-central/source/toolkit/locales/en-US/toolkit/main-window/findbar.ftl)
- [Firefox default Find preferences](https://searchfox.org/mozilla-central/source/modules/libpref/init/all.js)
- [Safari User Guide: Find text on a webpage](https://support.apple.com/guide/safari/find-text-on-a-webpage-ibrwe8c853c6/mac)
- [iPhone User Guide: Search a webpage in Safari](https://support.apple.com/guide/iphone/search-for-websites-iph6297b394b/ios)
- [Edge keyboard shortcuts](https://support.microsoft.com/en-us/edge/keyboard-shortcuts-in-microsoft-edge)
- [MDN `beforematch` and current availability](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforematch_event)
- [Chrome Developers: `hidden=until-found`](https://developer.chrome.com/docs/css-ui/hidden-until-found)
- [Android `WebView` Find APIs](https://developer.android.com/reference/android/webkit/WebView#findAllAsync(java.lang.String))
- [Apple `WKWebView` Find APIs](https://developer.apple.com/documentation/webkit/wkwebview)
- [Electron `webContents.findInPage`](https://www.electronjs.org/docs/latest/api/web-contents#contentsfindinpagetext-options)
- [Firefox WebExtension `find.find`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/find/find)

## Confidence and maintenance note

The standards, current engine source, and vendor documentation support the
core findings above. Browser UI details and engine-specific text extraction
change without a web-platform compatibility guarantee. Any row labeled Verify,
and any behavior promoted into the public contract, should be backed by the
versioned conformance fixture rather than this document alone.
