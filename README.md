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
independent virtualized lists. Search for `Alice`, or for
`alice.chen.999@example.test` to reveal a row near the end of the first list.

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
    <VirtualSearchProvider rootRef={rootRef}>
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

See [the v1 contract](docs/V1_CONTRACT.md) and
[the research notes](RESEARCH.md) for scope and design rationale.
