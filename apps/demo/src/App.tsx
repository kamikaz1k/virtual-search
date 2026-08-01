import {
  lazy,
  Suspense,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  useFindShortcut,
  useVirtualSearch,
  VirtualSearchProvider,
} from "virtual-search/react";
import { createMainThreadExecutor } from "virtual-search";
import { createWorkerExecutor } from "virtual-search/worker";
import { CustomSearchPanel } from "./CustomSearchPanel";
import { getStressDataset, standardDataset } from "./data";
import { CustomerList, OrderList } from "./VirtualList";

const DiffDemo = lazy(() =>
  import("./diff-demo/DiffDemo").then(module => ({
    default: module.DiffDemo,
  }))
);

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
      <CustomSearchPanel />
    </>
  );
}

function RevealableContentDemo() {
  const hiddenUntilFoundRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    hiddenUntilFoundRef.current?.setAttribute("hidden", "until-found");
  }, []);

  return (
    <section className="reveal-lab" aria-labelledby="reveal-lab-title">
      <header className="reveal-lab-heading">
        <div>
          <span className="eyebrow">Semantic reveal / ordinary DOM</span>
          <h2 id="reveal-lab-title">Find it. Open it.</h2>
        </div>
        <p>
          These phrases begin inside collapsed content. Searching for either
          one reveals its container before highlighting and scrolling.
        </p>
      </header>

      <div className="reveal-lab-grid">
        <article className="reveal-specimen">
          <div className="reveal-specimen-meta">
            <span>01</span>
            <code>&lt;details&gt;</code>
          </div>
          <label className="reveal-search-term">
            <span>Try this exact search</span>
            <input
              type="text"
              readOnly
              value="Orchid Protocol"
              aria-label="Search phrase: Orchid Protocol"
              onFocus={event => event.currentTarget.select()}
            />
          </label>
          <details className="reveal-details">
            <summary>
              <span>Open archived protocol</span>
              <span className="reveal-details-state" aria-hidden="true" />
            </summary>
            <div className="reveal-details-body">
              <p>
                The <strong>Orchid Protocol</strong> is searchable while this
                disclosure is closed. Selecting the match opens the native
                element before the active range is highlighted.
              </p>
            </div>
          </details>
        </article>

        <article className="reveal-specimen reveal-specimen-until-found">
          <div className="reveal-specimen-meta">
            <span>02</span>
            <code>hidden=&quot;until-found&quot;</code>
          </div>
          <label className="reveal-search-term">
            <span>Try this exact search</span>
            <input
              type="text"
              readOnly
              value="Cobalt Archive"
              aria-label="Search phrase: Cobalt Archive"
              onFocus={event => event.currentTarget.select()}
            />
          </label>
          <div className="reveal-until-found-stage">
            <p className="reveal-until-found-placeholder">
              The result below has no rendered text until search reveals it.
            </p>
            <div
              ref={hiddenUntilFoundRef}
              className="reveal-until-found-content"
            >
              <p>
                The <strong>Cobalt Archive</strong> was revealed through the
                standard <code>beforematch</code> sequence, then highlighted
                in its final rendered position.
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function RecordsDemo() {
  const rootRef = useRef<HTMLElement>(null);
  const [useStressDataset, setUseStressDataset] = useState(false);
  const [isDatasetPending, startDatasetTransition] = useTransition();
  const dataset = useMemo(
    () => useStressDataset ? getStressDataset() : standardDataset,
    [useStressDataset],
  );

  return (
    <VirtualSearchProvider
      rootRef={rootRef}
      executor={searchExecutor}
      resetActiveMatchOnOpen
    >
      <SearchControls />

      <main ref={rootRef}>
        <header className="hero">
          <div className="hero-kicker">
            <span>Virtual Search</span>
            <a className="demo-route-link" href={`${import.meta.env.BASE_URL}diff`}>
              Open diff viewer demo <span aria-hidden="true">↗</span>
            </a>
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

        <RevealableContentDemo />

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

export function App() {
  const normalizedPath = globalThis.location?.pathname.replace(/\/+$/, "");
  const isDiffDemo = normalizedPath?.endsWith("/diff") ?? false;
  return isDiffDemo
    ? (
      <Suspense fallback={<div className="demo-loading">Loading diff surface…</div>}>
        <DiffDemo />
      </Suspense>
    )
    : <RecordsDemo />;
}
