# Virtual Search: Research and Design Notes

Research collected July 29, 2026.

## Summary

There is not currently a widely adopted library that completely replaces browser Find while also understanding virtualized, unmounted, or application-hidden content.

Existing packages solve individual parts of the problem:

- Search engines index application data.
- DOM highlighters decorate content that has already been rendered.
- Virtualization libraries can render and scroll to a selected record.
- Browser APIs can help native Find discover some hidden content.

The opportunity is to connect these pieces behind a framework-neutral search controller. The central design principle should be:

> Search the application's source data, not only its current DOM. Render, locate, highlight, and scroll to a result only when the user navigates to it.

## Existing libraries and APIs

| Library or API | Useful for | Limitation |
| --- | --- | --- |
| [mark.js](https://markjs.io/) | Finding and highlighting text nodes in rendered DOM, including matches spanning elements | Cannot search unmounted virtualized rows; highlights by wrapping matches and mutating the DOM |
| [MiniSearch](https://github.com/lucaong/minisearch) | Lightweight in-browser full-text index, prefix and fuzzy matching, incremental updates | Returns matching documents rather than browser-style occurrences and navigation |
| [FlexSearch](https://github.com/nextapps-de/flexsearch) | Larger indexes, workers, IndexedDB persistence, multiple languages, snippets and result highlighting | Still requires virtualization, occurrence-position, and DOM-range adapters |
| [Fuse.js](https://www.fusejs.io/) | Fuzzy filtering of a relatively small collection | Fuzzy ranking differs from expected Find-in-page substring behavior |
| [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Custom_highlight_API) | Highlighting rendered text ranges without inserting elements into the DOM | Works only after matching content has been rendered and mapped to `Range` objects |
| [`Window.find()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/find) | Invoking limited native-style searching in some browsers | Non-standard, inconsistently supported, DOM-only, and unsuitable as a library foundation |

No package in this set supplies the complete flow:

1. Search data that is absent from the DOM.
2. Produce individual match occurrences in document order.
3. Ask a virtualizer to mount the relevant item.
4. Wait for rendering and measurement.
5. Map a data offset to a DOM `Range`.
6. Highlight the active and inactive matches.
7. Scroll between matches with native-Find-like behavior.

## Virtualization integration

Virtualization libraries provide useful navigation hooks. For example, [TanStack Virtual](https://tanstack.com/virtual/latest/docs/api/virtualizer) exposes:

- `scrollToIndex()` to navigate to a matching record.
- `rangeExtractor` to force specific indexes to remain rendered outside the normal visible range.
- Measurement and total-size APIs that can help stabilize navigation.

Equivalent adapters could be built for:

- TanStack Virtual
- React Window
- React Virtuoso
- Framework-specific virtualizers
- A generic callback-based virtualizer

An adapter should not assume that scrolling immediately makes a row available. Navigation may need to:

1. Request the target item.
2. Wait for it to mount.
3. Wait for size measurement or one/two animation frames.
4. Locate the exact occurrence.
5. Apply the active highlight.
6. Correct the scroll alignment if dynamic sizing shifted the item.

## Alternatives to replacing native Find

### `content-visibility: auto`

When the content can remain in the DOM, `content-visibility: auto` may provide enough rendering optimization without true virtualization:

```css
.searchable-section {
  content-visibility: auto;
  contain-intrinsic-size: auto 400px;
}
```

The browser may skip layout and painting for offscreen sections while their contents remain available to native Find, selection, focus navigation, and accessibility APIs.

Sources:

- [MDN: `content-visibility`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility)
- [web.dev: content-visibility](https://web.dev/articles/content-visibility)

This approach is likely preferable for thousands of modest elements. True virtualization remains useful for extremely large lists, expensive component trees, or records that have not been loaded.

### `hidden="until-found"` and `beforematch`

Collapsed content can participate in native Find using:

```html
<section hidden="until-found">
  Searchable collapsed content
</section>
```

When native Find locates matching content, the browser:

1. Fires `beforematch` on the hidden element.
2. Removes the hidden state.
3. Scrolls to the result.

Sources:

- [MDN: `beforematch`](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforematch_event)
- [MDN: `hidden`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/hidden)
- [WebKit: Safari 26.2 support](https://webkit.org/blog/17640/webkit-features-for-safari-26-2/)

This is valuable for accordions, disclosures, and collapsed sections. It cannot help with virtualized content that does not exist in the DOM. The event also does not expose the user's native search query.

## Overriding Find on desktop websites

A page can commonly intercept Ctrl/Cmd+F while its document has focus:

```js
document.addEventListener(
  "keydown",
  event => {
    const findShortcut =
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      event.key.toLowerCase() === "f";

    if (!findShortcut || !event.cancelable) return;

    event.preventDefault();
    searchController.open();
  },
  { capture: true }
);
```

Important limitations:

- The page does not gain access to the browser's native search box.
- The page cannot read the query entered into native Find.
- The page must supply its own search interface.
- Browser, operating-system, extension, and embedding behavior can affect whether a shortcut is cancelable.
- Shortcut replacement should be opt-in because some users deliberately expect native Find.

Source:

- [MDN: `preventDefault()`](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault)

The UI should also consider native conventions:

- Escape closes the panel and restores focus.
- Enter or Cmd/Ctrl+G moves to the next result.
- Shift+Enter or Cmd/Ctrl+Shift+G moves to the previous result.
- The UI reports the active ordinal and total, such as “3 of 18.”
- Search wraps at the beginning and end when configured to do so.

## Mobile browser research

### Ordinary Safari, Chrome, Firefox, and PWAs

A normal webpage cannot override the browser menu's **Find on Page** command.

There is no standard page API that:

- Announces that the browser's native Find panel opened.
- Exposes the native query to page JavaScript.
- Replaces the browser menu command with application code.
- Makes unmounted data visible to the native Find engine.

`beforematch` is not an override mechanism. It runs only after the browser has found matching content that already exists in a searchable DOM subtree.

Consequently, the reliable mobile entry point is a visible in-page search control. Hardware-keyboard Cmd/Ctrl+F interception on a tablet can be supported as an enhancement, but it should not be the only way to open search.

A mobile search panel should handle:

- Software-keyboard viewport resizing.
- Safe areas and browser toolbars.
- A compact match counter.
- Large previous/next/close touch targets.
- `<input type="search">` and `inputmode="search"`.
- Focus restoration after closing.
- An `aria-live` result-count announcement.
- Scroll completion only after a virtualized item has mounted and been measured.
- Optional sticky or bottom-sheet presentation depending on available space.

### iOS applications using `WKWebView`

There are two approaches in a native iOS application:

1. Enable Apple's standard Find interaction.
2. Build a custom native search bar and communicate with the page through a JavaScript bridge.

Starting with iOS 16, `WKWebView.isFindInteractionEnabled` supplies the system Find UI, hardware-keyboard shortcuts, and an interface adapted for iPhone and iPad.

Sources:

- [Apple WWDC: desktop-class editing interactions](https://developer.apple.com/videos/play/wwdc2022/10071/)
- [Apple WWDC: WKWebView Find interaction](https://developer.apple.com/br/videos/play/wwdc2022/10049/?time=230)

`WKWebView.find(_:configuration:)` supports direction, case sensitivity, and wrapping:

- [Apple: `WKWebView.find`](https://developer.apple.com/documentation/webkit/wkwebview/find%28_%3Aconfiguration%3A%29)

These native APIs still search WebKit-visible page content. They do not know about application records that are absent from the DOM. For virtualized content, a native search bar should call the JavaScript library's data-backed controller. The controller should return match count and active-match state to native code and accept next/previous/open/close commands.

### Android applications using `WebView`

Android `WebView` provides:

- `findAllAsync(query)`
- `findNext(forward)`
- `clearMatches()`
- `WebView.FindListener`

Sources:

- [Android: `WebView`](https://developer.android.com/reference/android/webkit/WebView)
- [Android: `WebView.FindListener`](https://developer.android.com/reference/android/webkit/WebView.FindListener)

The built-in methods search and highlight DOM content and report progress and result counts. They have the same virtualization limitation as browser Find.

For virtualized content, an Android application should use a native toolbar connected to the page's data-backed search controller through a JavaScript bridge.

### Browser extensions

An extension can inject a custom interface and search logic, but it cannot automatically discover application data that is absent from the DOM.

Firefox exposes a WebExtension Find API that can return match counts, ranges, and rectangles for tab content:

- [Mozilla: `find.find()`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/find/find)

This remains DOM-based. A virtualized application would still need to expose its data through an adapter, application integration, or a page-specific content script.

## Proposed architecture

The package should separate data search, navigation, rendering, and user interface.

```ts
interface SearchSource {
  search(
    query: string,
    options: SearchOptions,
    signal?: AbortSignal
  ): Promise<SearchMatch[]> | SearchMatch[];
}

interface SearchMatch {
  id: string;
  itemKey: string;
  itemIndex?: number;
  start: number;
  end: number;
  excerpt?: string;
  field?: string;
}

interface SearchNavigator {
  reveal(match: SearchMatch): Promise<void>;
  scrollTo(match: SearchMatch): Promise<void>;
  locateRenderedRange(match: SearchMatch): Range | null;
}

interface SearchHighlighter {
  render(matches: SearchMatch[], activeMatch: SearchMatch | null): void;
  clear(): void;
}
```

### Core controller

The controller should own:

- Current query and normalized query.
- Result collection and ordering.
- Active-result index.
- Next, previous, first, and last navigation.
- Wrap behavior.
- Asynchronous cancellation.
- Stale-result protection.
- Open and closed UI state.
- Search and navigation events.
- Result-count announcements.

### Search sources

Potential built-in sources:

1. **Array/data source**
   - Searches records whether rendered or not.
   - Accepts a text extractor and stable key extractor.
   - Produces exact occurrence offsets.

2. **DOM source**
   - Walks eligible text nodes.
   - Defines policies for scripts, styles, form controls, `aria-hidden`, `display:none`, and shadow roots.
   - Maps results directly to DOM ranges.

3. **Indexed source**
   - Adapts MiniSearch, FlexSearch, or a caller-supplied search engine.
   - Converts document-level results into ordered occurrences.

4. **Remote source**
   - Supports server-side search for data too large or unavailable locally.
   - Uses `AbortSignal` and progressive result updates.

5. **Composite source**
   - Merges visible DOM, virtualized data, and remote results into document order.

### Virtualizer adapters

An adapter should expose enough behavior to:

- Resolve an item key to an index.
- Scroll to an index.
- Force an item into the render range if supported.
- Report when the item mounts.
- Report when measurement is stable.
- Resolve occurrence offsets to a rendered DOM range.

The core package should remain framework-neutral; framework integrations can live in separate entry points or packages.

### Highlight rendering

Preferred strategy:

- Use the CSS Custom Highlight API for active and inactive ranges.
- Avoid DOM mutation.
- Maintain separate named highlights, for example `virtual-search-match` and `virtual-search-active`.

Fallback:

- Wrap matching text in `<mark>` elements.
- Restore original text nodes cleanly when the query changes or closes.
- Avoid breaking framework hydration and reconciliation.

An unrendered match cannot be highlighted. The UI can still report the complete match count while only creating visual ranges for currently mounted matches.

### Matching semantics

Default behavior should resemble native Find:

- Literal substring search.
- Case-insensitive by default.
- Results ordered by application/document order.
- Individual occurrence navigation rather than document-only results.
- Optional wrapping.

Optional modes:

- Case sensitive.
- Whole word.
- Diacritic-sensitive or insensitive.
- Unicode normalization.
- Regular expressions.
- Prefix search.
- Fuzzy search.

Fuzzy search should be explicit because it changes result ordering and users' expectations of “3 of 18.”

Unicode details to define carefully:

- Locale-aware case folding.
- NFC/NFD normalization.
- Grapheme clusters versus UTF-16 offsets.
- Combining marks.
- Right-to-left text.
- CJK tokenization for indexed modes.

The internal match representation should make its offset unit explicit. UTF-16 offsets map most directly to DOM `Range` offsets, while grapheme-based display logic may need `Intl.Segmenter`.

## Accessibility considerations

A replacement for native Find assumes responsibility for behavior users normally receive from the browser:

- A labeled search input.
- Programmatic result-count updates through `aria-live`.
- Focus containment only if the search UI is modal.
- Escape-to-close behavior.
- Focus restoration to the element that opened search.
- Visible active-match styling that does not rely on color alone.
- Sufficient contrast in active and inactive highlights.
- Reduced-motion support.
- Logical navigation order.
- No duplicated offscreen content exposed to assistive technologies merely to make native Find work.

Using hidden duplicate DOM as a search index is generally risky because it can pollute the accessibility tree, duplicate IDs, and increase memory use. A data index is cleaner.

## Performance considerations

- Debounce only expensive searches; immediate substring search often feels better.
- Use `AbortController` to cancel prior asynchronous searches.
- Consider a Web Worker for large indexes.
- Avoid highlighting every offscreen match by forcing every virtual row to mount.
- Highlight mounted matches incrementally.
- Store stable item keys rather than only indexes because sorting and filtering may reorder records.
- Update indexes incrementally for edited, inserted, and deleted content.
- Avoid repeatedly flattening the entire DOM on every keystroke.
- Consider IndexedDB persistence for large reusable indexes.
- Measure memory use on mobile browsers.

## Suggested package shape

One possible package organization:

```text
@virtual-search/core
@virtual-search/dom
@virtual-search/highlight
@virtual-search/react
@virtual-search/tanstack-virtual
@virtual-search/react-window
@virtual-search/react-virtuoso
@virtual-search/webview
@virtual-search/ui
```

Alternatively, keep a single package with tree-shakeable entry points until the API stabilizes.

## Recommended first version

An effective initial scope would be:

1. Framework-neutral core controller.
2. Array-backed literal substring source with exact offsets.
3. Generic virtualizer adapter interface.
4. TanStack Virtual adapter.
5. CSS Custom Highlight renderer with a `<mark>` fallback.
6. Headless state plus one accessible reference search panel.
7. Ctrl/Cmd+F interception as an optional helper.
8. Mobile-first visible search trigger.
9. React bindings if React is the initial ecosystem.

Defer fuzzy/indexed search, browser extensions, and native WebView wrappers until exact Find-like navigation is reliable.

## Open design questions

- Does the library promise exact browser-like semantics or a more general content search experience?
- Are matches counted per occurrence or per record?
- How does an application map normalized/indexed text back to render-time character offsets?
- How should results spanning multiple styled DOM nodes be represented?
- Should mounted but non-active matches remain highlighted?
- How are records ordered when data comes from multiple virtual regions?
- What happens when a matching record is deleted or reordered during navigation?
- Should hidden application states be searched by default?
- How are shadow DOM and iframe boundaries handled?
- What minimum browser versions are acceptable for the CSS Custom Highlight API?
- Is the UI included, headless, or both?

## Overall conclusion

The ecosystem already has competent search engines, DOM highlighting libraries, and virtualizer scrolling APIs. The missing layer is a consistent occurrence model and navigation lifecycle connecting application data to temporarily rendered DOM.

That makes a new library defensible if it focuses on:

- Data-first searching.
- Exact occurrence offsets.
- Virtualizer adapters.
- Mount-aware navigation.
- Non-mutating highlighting where possible.
- Accessible desktop and mobile UI.
- Explicit integration points for native iOS and Android shells.

