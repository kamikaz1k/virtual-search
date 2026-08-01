# Virtual Search

Virtual Search is an early TypeScript library for replacing a page's
Cmd/Ctrl+F experience with native-like search across ordinary DOM and
unmounted virtualized records.

It provides:

- occurrence-based, document-order matching;
- a complete `X of Y` count that includes unmounted rows;
- mount-aware reveal, DOM range location, highlighting, and scrolling;
- framework-neutral core APIs;
- React and TanStack Virtual bindings;
- main-thread and persistent Web Worker executors;
- an accessible reference search panel.

The browser's own Find panel cannot be extended or queried by page JavaScript.
The shortcut override is therefore opt-in and uses an in-page search panel.

## Development

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm build
pnpm dev
```

`pnpm dev` prints the local URL (normally `http://localhost:5173`). Do not
open `apps/demo/dist/index.html` directly: module workers and generated assets
must be served over HTTP. To inspect a production build, run `pnpm build`
followed by `pnpm preview`.

The demo contains static content and 2,500 records split between two
independent virtualized lists, with a toggle for a 100,000-record stress
dataset. Search for `Alice`, or enable 100K and search for
`alice.chen.39999@example.test` to reveal the final customer.

The revealable-content specimens exercise ordinary DOM semantics as well:
search for `Orchid Protocol` to open a closed `<details>` element, or
`Cobalt Archive` to reveal content marked `hidden="until-found"`. The visible
phrase controls are form inputs, so they are not duplicate matches in the page
corpus.

## React setup

Install one provider around the page's searchable root:

```tsx
import {
  SearchPanel,
  useFindShortcut,
  VirtualSearchProvider,
} from "virtual-search/react";

function SearchControls() {
  useFindShortcut();
  return <SearchPanel />;
}

function App() {
  const rootRef = useRef<HTMLElement>(null);

  return (
    <VirtualSearchProvider rootRef={rootRef} resetActiveMatchOnOpen>
      <SearchControls />
      <main ref={rootRef}>
        <p>Ordinary DOM remains searchable.</p>
        <CustomerList />
        <OrderList />
      </main>
    </VirtualSearchProvider>
  );
}
```

`SearchPanel` is optional. `useVirtualSearch()` exposes headless state and
`open`, `close`, `setQuery`, `next`, `previous`, and `goTo` commands.

`resetActiveMatchOnOpen` keeps the current query but returns to its first
occurrence whenever search reopens. This mirrors the native restart behavior
while remaining opt-in; omit the prop to preserve the active `N of Y` position.

## Custom search UI

The demo uses the headless hook to provide its own input, result counter, and
navigation controls. A minimal custom panel looks like this:

```tsx
import {
  useSearchPanelViewport,
  useVirtualSearch,
} from "virtual-search/react";

function CustomSearch() {
  const search = useVirtualSearch();
  const panelRef = useRef<HTMLFormElement>(null);
  useSearchPanelViewport(panelRef, {
    anchor: "top",
    enabled: search.isOpen,
    padding: 10,
  });

  if (!search.isOpen) return null;

  return (
    <form
      ref={panelRef}
      role="search"
      data-virtual-search-panel=""
      aria-busy={search.status === "searching"}
      onSubmit={event => {
        event.preventDefault();
        void search.next();
      }}
    >
      <input
        type="search"
        aria-label="Search all page content"
        value={search.query}
        onChange={event => void search.setQuery(event.target.value)}
      />
      <output aria-live="polite">
        {search.status === "searching"
          ? "Searching…"
          : search.matches.length === 0
            ? "No results"
            : `${search.activeIndex + 1} of ${search.matches.length}`}
      </output>
      <button type="button" onClick={() => void search.previous()}>
        Previous
      </button>
      <button type="button" onClick={() => void search.next()}>
        Next
      </button>
      <button type="button" onClick={search.close}>
        Close
      </button>
    </form>
  );
}
```

Keep `data-virtual-search-panel` on the custom panel and use a
`<input type="search">` so `useFindShortcut()` can focus it after Cmd/Ctrl+F.
`useSearchPanelViewport()` is optional for custom panels; it keeps fixed search
UI inside the browser's visual viewport while the software keyboard is open.
The built-in `SearchPanel` enables this behavior automatically and defaults to
`viewportAnchor="top"`. Pass `viewportAnchor="preserve"` when your application
owns its anchor, or
`keepInVisualViewport={false}` only when an application provides its own
viewport management.

The hook also publishes
`--virtual-search-viewport-top`,
`--virtual-search-viewport-left`,
`--virtual-search-viewport-width`, and
`--virtual-search-viewport-height` on the panel for advanced layouts. Prefer
ordinary fixed-position anchors. A top anchor is the most reliable mobile
choice because the software keyboard changes the bottom edge of the visual
viewport. In `"top"` mode, CSS remains the sole owner of the panel's vertical
position so document scrolling cannot translate it away from the viewport.
`"preserve"` mode keeps the defensive vertical correction for application-owned
anchors. Both modes constrain oversized panels when less usable space remains.

## Native-like UX details

Several small behaviors make the experience feel much closer to browser Find.
They are easy to miss in a quick demo, but are deliberate parts of the
implementation:

| Detail | Why it matters | Responsibility |
| --- | --- | --- |
| The first result is the first occurrence in document order | Opening a new query starts where users expect native Find to start, even when that occurrence is inside an unmounted row | Core |
| Search can restart from the first match when reopened | `resetActiveMatchOnOpen` keeps the query but avoids returning users to a stale `N of Y` position | Core and React provider |
| Next and previous wrap across page boundaries | Navigation continues naturally from the last match to the first and back again | Core |
| Virtual rows mount before range lookup and scrolling | Search can reveal exact text in records that did not exist in the DOM when the query ran | Core and virtualizer adapter |
| Navigation waits for rendering and measurement to settle | Dynamic row sizing does not leave the active highlight or scroll position slightly displaced | React region binding |
| Superseded searches and navigation are cancelled | Fast typing cannot allow stale worker results to move selection or scroll the page later | Core and worker executor |
| Escape closes search and restores the previously focused element | Keyboard users return to the control they were using before opening Find | Core and React shortcut binding |
| Result counts use an ARIA live region and searching uses `aria-busy` | Assistive technology receives the same progress and `X of Y` feedback as sighted users | Search UI |
| CSS Custom Highlight ranges avoid inserting `<mark>` elements | Highlighting does not mutate or fight framework-owned DOM | Core highlighter |
| Shadow DOM ranges remain owned by the core highlighter | Integrations return the real range, so query changes and cancellation cannot leave adapter-owned highlights behind | Core and custom region adapter |
| Top-anchored search panels do not inherit visual-viewport scroll offsets | Result navigation can pan the document without translating the already-fixed controls out of view; application-owned anchors can opt into `"preserve"` correction | React `SearchPanel` and `useSearchPanelViewport()` |
| The mobile demo keeps search anchored to the top and removes decorative chrome | The panel remains stable while the iOS keyboard and browser toolbar animate, without relying on delayed bottom-viewport measurements | Demo custom UI |
| Safe-area insets and `viewport-fit=cover` are respected | The panel avoids notches and rounded screen edges without disabling pinch zoom | Demo custom UI |
| Mobile input text remains at least 16px and touch controls are enlarged | Focusing search does not trigger iOS text-field zoom, and navigation remains comfortable by touch | Demo custom UI |
| Extremely short viewports make the panel internally scrollable | Landscape phones and keyboard-constrained layouts keep every search action reachable | Demo custom UI |

The built-in `SearchPanel` applies the viewport guard automatically. The
[custom demo panel](apps/demo/src/CustomSearchPanel.tsx) demonstrates reusing
the exported hook with application-owned
[responsive styles](apps/demo/src/styles.css). The library intentionally does
not disable `user-scalable` or set a restrictive maximum zoom.

For mobile custom panels, prefer a permanent top anchor over switching position
when an input receives focus. Mobile Safari may report the keyboard-adjusted
bottom of the visual viewport only after its animation completes; a top anchor
does not need to infer the keyboard height and therefore remains predictable
during page scrolling and result navigation.

## Considerations

Ongoing iOS keyboard and visual-viewport research, failed approaches, device
reproductions, and the validation matrix live in
[VIEWPORT_RESEARCH.md](VIEWPORT_RESEARCH.md).

### Responsive and otherwise invisible content

Native Find searches the page as it exists in the current presentation.
Content removed from the DOM or hidden with `display: none`, `visibility:
hidden`, the regular `hidden` attribute, or `content-visibility: hidden` is not
normally a result. Content skipped by virtualization is different: although it
is not currently mounted, it represents content that would be visible after
scrolling to its row and should remain searchable.

Keep a virtual region's authoritative search parts aligned with the current
responsive layout. For example, if a mobile breakpoint removes an email
column, omit the email part from `getSearchParts` at that breakpoint and call
`invalidate(regionId)` when the breakpoint changes. This prevents invisible
navigation steps and keeps the `X of Y` count truthful. Visually hidden or
off-screen techniques that leave content rendered may still be searchable,
just as they may be with native Find.

### Content that Find is expected to reveal

Browsers have special Find behavior for revealable content. A native search
can open a closed `<details>` element, and `hidden="until-found"` is designed
to reveal itself through the browser's ancestor-revealing algorithm and
`beforematch` event.

Virtual Search reproduces these two ordinary-DOM behaviors. Selecting a match
opens each closed `<details>` ancestor. For `hidden="until-found"`, it
dispatches `beforematch`, removes the `hidden` attribute, and then highlights
and scrolls to the text. The dispatched event follows the native ordering but
is synthetic, so its `isTrusted` property is `false`.

Application-owned tabs, accordions, and collapsed panels should reveal
themselves through the virtual region's existing `reveal(occurrence, context)`
hook. The hook runs for every active virtual match, including rows that are
already mounted, and receives the matching `partId` on the occurrence. Resolve
it only after the matching content is rendered. If the hook returns but the
matching range is still absent or hidden, navigation reports a
`VirtualSearchRevealError` instead of silently displaying an invisible active
result.

This keeps one navigation extension point, but makes its contract broader:
`reveal` is responsible for any mounting, scrolling, tab selection, or
expansion required to expose the occurrence. Existing integrations whose
custom `reveal` implementation assumed it would only run for unmounted rows
should make that operation idempotent.

## Registering a TanStack Virtual list

```tsx
const virtualizer = useVirtualizer({
  count: customers.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 56,
});

const search = useVirtualSearchRegion({
  id: "customers",
  anchorRef: scrollRef,
  items: customers,
  getKey: customer => customer.id,
  getSearchParts: customer => [
    { id: "name", text: customer.name },
    { id: "email", text: customer.email },
  ],
  virtualizer: tanstackVirtualAdapter(virtualizer),
});
```

Apply the returned attributes to the region, rows, and searchable text parts:

```tsx
<div ref={scrollRef} {...search.regionProps}>
  {virtualizer.getVirtualItems().map(virtualRow => {
    const customer = customers[virtualRow.index];

    return (
      <div
        key={customer.id}
        {...search.itemProps(customer.id)}
        ref={virtualizer.measureElement}
      >
        <strong {...search.partProps(customer.id, "name")}>
          {customer.name}
        </strong>
        <span {...search.partProps(customer.id, "email")}>
          {customer.email}
        </span>
      </div>
    );
  })}
</div>
```

For simple rows, replace `getSearchParts` with `getText`. The rendered row's
text must then exactly correspond to that authoritative string.

## Other virtualizers

Adapters are included for both current and legacy React Window APIs, React
Virtuoso, and callback-driven virtualizers. They have no runtime dependency on
those packages.

### React Window

React Window v2 exposes `scrollToRow()` and its root element through
`ListImperativeAPI`. Pass the ref object itself so it is resolved after mount:

```tsx
import { List, useListRef } from "react-window";
import { useVirtualSearchRegion } from "virtual-search/react";
import { reactWindowAdapter } from "virtual-search/react-window";

const listRef = useListRef();
const search = useVirtualSearchRegion({
  id: "customers",
  getAnchor: () => listRef.current?.element ?? null,
  items: customers,
  getKey: customer => customer.id,
  getText: customer => customer.name,
  virtualizer: reactWindowAdapter(listRef),
});

<List
  listRef={listRef}
  rowCount={customers.length}
  /* Spread search.regionProps on the List and search.itemProps(key) on rows. */
/>;
```

The same adapter detects React Window v1 handles and calls
`scrollToItem(index, align)`. With v1, pass the list's `outerRef` as
`anchorRef`.

### React Virtuoso

```tsx
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { useVirtualSearchRegion } from "virtual-search/react";
import { reactVirtuosoAdapter } from "virtual-search/react-virtuoso";

const virtuosoRef = useRef<VirtuosoHandle>(null);
const scrollerRef = useRef<Element>(null);
const search = useVirtualSearchRegion({
  id: "orders",
  anchorRef: scrollerRef,
  items: orders,
  getKey: order => order.id,
  getText: order => order.reference,
  virtualizer: reactVirtuosoAdapter(virtuosoRef),
});

<Virtuoso
  ref={virtuosoRef}
  scrollerRef={element => {
    scrollerRef.current = element instanceof Element ? element : null;
  }}
  data={orders}
  {...search.regionProps}
  itemContent={(_, order) => (
    <div {...search.itemProps(order.id)}>{order.reference}</div>
  )}
/>;
```

### Callback adapter

```tsx
import { callbackVirtualizerAdapter } from "virtual-search";

const virtualizer = callbackVirtualizerAdapter(
  (index, { align }) => myVirtualizer.reveal(index, align),
);
```

The raw `VirtualizerAdapter` interface is also exported for application-specific
integrations.

## Worker execution

Create an application-owned worker entry:

```ts
// search.worker.ts
import "virtual-search/worker/runtime";
```

Then pass its persistent executor to the provider or core controller:

```tsx
import { createWorkerExecutor } from "virtual-search/worker";

const executor = createWorkerExecutor({
  worker: new Worker(new URL("./search.worker.ts", import.meta.url), {
    type: "module",
  }),
});

<VirtualSearchProvider rootRef={rootRef} executor={executor}>
  {/* ... */}
</VirtualSearchProvider>
```

The executor synchronizes the corpus only when searchable text or ordering
changes. Queries send only the query and options. Cancellation is translated
from `AbortSignal` into cooperative worker messages.

## Highlight styles

Applications control native CSS highlights:

```css
::highlight(virtual-search-match) {
  background: rgb(255 210 0 / 35%);
}

::highlight(virtual-search-active) {
  background: #ffcf00;
  text-decoration: underline;
}
```

Search and navigation remain functional when the CSS Custom Highlight API is
unavailable, but v1 intentionally does not mutate framework-owned DOM with a
`<mark>` fallback.

### Shadow DOM highlights

A custom region's `locate()` hook may return ranges inside a shadow root. The
core traverses through the shadow host for visibility validation and owns those
ranges through the same `virtual-search-match` and `virtual-search-active`
highlights used for ordinary DOM content. Do not create a second integration-
owned highlight in `reveal()`.

Highlight pseudo-elements have their own inheritance model. A page-level rule
can therefore provide the visible style through the shadow host, while a rule
in the component stylesheet can customize it more precisely. Virtual Search
does not assume which strategy the application uses and never inserts or
removes styles from an application-owned document or shadow root. When a
returned shadow range does not appear to have visible computed styles from
either source, it emits one actionable console warning for that region and
highlight name.

The diagnostic uses computed highlight styles as a best-effort check. Disable
it when an application intentionally provides an invisible highlight or owns a
styling mechanism the browser cannot expose through `getComputedStyle()`:

```tsx
<VirtualSearchProvider
  rootRef={rootRef}
  diagnostics={{ missingHighlightStyles: false }}
>
  {/* ... */}
</VirtualSearchProvider>
```

The core controller accepts the same `diagnostics` option. Disabling the
warning does not change search, range ownership, or highlighting behavior.

See [the v1 contract](docs/V1_CONTRACT.md) and
[the research notes](RESEARCH.md) for scope and design rationale.
