import { useRef } from "react";
import {
  SearchPanel,
  useFindShortcut,
  useVirtualSearch,
  VirtualSearchProvider,
} from "virtual-search/react";
import { createMainThreadExecutor } from "virtual-search";
import { createWorkerExecutor } from "virtual-search/worker";
import { customers, orders } from "./data";
import { CustomerList, OrderList } from "./VirtualList";

function createDemoExecutor() {
  if (typeof Worker === "undefined") return createMainThreadExecutor();

  try {
    return createWorkerExecutor({
      worker: new Worker(new URL("./search.worker.ts", import.meta.url), {
        type: "module",
      }),
    });
  } catch (error) {
    console.warn(
      "Virtual Search worker could not start; using the main thread.",
      error,
    );
    return createMainThreadExecutor();
  }
}

const searchExecutor = createDemoExecutor();

function SearchControls() {
  const search = useVirtualSearch();
  useFindShortcut();

  return (
    <>
      <button className="open-search" type="button" onClick={search.open}>
        <span>Find anywhere</span>
        <kbd>⌘ F</kbd>
      </button>
      <SearchPanel className="search-panel" />
    </>
  );
}

export function App() {
  const rootRef = useRef<HTMLElement>(null);

  return (
    <VirtualSearchProvider rootRef={rootRef} executor={searchExecutor}>
      <SearchControls />

      <main ref={rootRef}>
        <header className="hero">
          <div className="hero-kicker">
            <span>Virtual Search</span>
            <span>Field test 001</span>
          </div>
          <h1>
            Find what the
            <em> DOM cannot see.</em>
          </h1>
          <p className="hero-copy">
            Alice appears here, deep inside two independent virtual lists, and
            again in the field note between them. Search follows this page’s
            actual reading order—even when a matching row has never mounted.
          </p>
          <div className="instruction">
            <span className="instruction-number">01</span>
            Press <kbd>⌘ F</kbd> or use “Find anywhere,” then search for
            <strong> Alice</strong>.
          </div>
        </header>

        <CustomerList items={customers} />

        <aside className="field-note">
          <span className="field-note-label">Field note / between regions</span>
          <p>
            A static Alice occurrence lives between both datasets. It proves
            that the coordinator does not merely append virtual results after
            ordinary page content.
          </p>
        </aside>

        <OrderList items={orders} />

        <footer>
          <span>2,500 virtual records</span>
          <span>One ordered search surface</span>
          <span>End of document</span>
        </footer>
      </main>
    </VirtualSearchProvider>
  );
}
