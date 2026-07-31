import { useMemo, useRef, useState, useTransition } from "react";
import {
  SearchPanel,
  useFindShortcut,
  useVirtualSearch,
  VirtualSearchProvider,
} from "virtual-search/react";
import { createMainThreadExecutor } from "virtual-search";
import { createWorkerExecutor } from "virtual-search/worker";
import { getStressDataset, standardDataset } from "./data";
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
  const [useStressDataset, setUseStressDataset] = useState(false);
  const [isDatasetPending, startDatasetTransition] = useTransition();
  const dataset = useMemo(
    () => useStressDataset ? getStressDataset() : standardDataset,
    [useStressDataset],
  );

  return (
    <VirtualSearchProvider rootRef={rootRef} executor={searchExecutor}>
      <SearchControls />

      <main ref={rootRef}>
        <header className="hero">
          <div className="hero-kicker">
            <span>Virtual Search</span>
            <label className="dataset-toggle">
              <span className="dataset-toggle-label">
                {isDatasetPending
                  ? "Preparing dataset…"
                  : `${dataset.total.toLocaleString()} records`}
              </span>
              <input
                type="checkbox"
                checked={useStressDataset}
                disabled={isDatasetPending}
                onChange={event => {
                  const checked = event.target.checked;
                  startDatasetTransition(() => {
                    setUseStressDataset(checked);
                  });
                }}
                aria-label="Use 100,000 record stress-test dataset"
              />
              <span className="dataset-toggle-track" aria-hidden="true">
                <span className="dataset-toggle-thumb" />
              </span>
              <span className="dataset-toggle-value">100K</span>
            </label>
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

        <CustomerList items={dataset.customers} />

        <aside className="field-note">
          <span className="field-note-label">Field note / between regions</span>
          <p>
            A static Alice occurrence lives between both datasets. It proves
            that the coordinator does not merely append virtual results after
            ordinary page content.
          </p>
        </aside>

        <OrderList items={dataset.orders} />

        <footer>
          <span>{dataset.total.toLocaleString()} virtual records</span>
          <span>One ordered search surface</span>
          <span>End of document</span>
        </footer>
      </main>
    </VirtualSearchProvider>
  );
}
