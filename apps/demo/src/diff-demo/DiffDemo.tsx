import { type CodeViewOptions } from "@pierre/diffs";
import {
  CodeView,
  type CodeViewHandle,
} from "@pierre/diffs/react";
import { useMemo, useRef, useState } from "react";
import {
  useFindShortcut,
  useVirtualSearch,
  VirtualSearchProvider,
} from "virtual-search/react";
import { CustomSearchPanel } from "../CustomSearchPanel";
import { createDiffDemoData } from "./diffCorpus";
import { INLINE_DIFF } from "./fixture";
import { useCodeViewSearchRegion } from "./useCodeViewSearchRegion";
import "./styles.css";

const demoData = createDiffDemoData(INLINE_DIFF);
const virtualSearchItemAttribute = "data-virtual-search-item";

const codeViewSearchStyles = `
  ::highlight(virtual-search-match) {
    color: inherit;
    background-color: color-mix(in srgb, #f2c94c 34%, transparent);
  }

  ::highlight(virtual-search-active) {
    color: #f8fafc;
    background-color: color-mix(in srgb, #ffb224 72%, #7c2d12);
    text-decoration: underline 2px #ffd978;
    text-underline-offset: 2px;
  }

  [data-diffs-header="default"] {
    border-block: 1px solid #253042;
  }

  [data-diffs-header="default"][data-sticky] {
    box-shadow: 0 10px 24px rgba(3, 7, 18, 0.38);
  }
`;

function SearchControls() {
  const search = useVirtualSearch();
  useFindShortcut();

  return (
    <>
      <button
        className="diff-search-trigger"
        type="button"
        onClick={search.open}
      >
        <SearchIcon />
        <span>Search this diff</span>
        <kbd>⌘ F</kbd>
      </button>
      <CustomSearchPanel
        kicker="Virtual diff search · 2,196 indexed lines"
        placeholder='Try “signalRelay”'
        emptyLabel="Type to search every file in this diff"
        inputLabel="Search all diff content"
      />
    </>
  );
}

function DiffWorkspace({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const viewerRef = useRef<CodeViewHandle<undefined>>(null);
  const [selectedFile, setSelectedFile] = useState(demoData.files[0]?.id ?? "");
  const search = useVirtualSearch();
  const activeSearchFile = search.matches[search.activeIndex]?.unitKey;

  useCodeViewSearchRegion({
    anchorRef: scrollRef,
    units: demoData.units,
    viewerRef,
  });

  const options = useMemo<CodeViewOptions<undefined>>(
    () => ({
      theme: "github-dark",
      themeType: "dark",
      diffStyle: "unified",
      diffIndicators: "bars",
      overflow: "scroll",
      stickyHeaders: true,
      lineHoverHighlight: "number",
      hunkSeparators: "line-info-basic",
      unsafeCSS: codeViewSearchStyles,
      onPostRender(node, _instance, phase, context) {
        const host = context.element ?? node;
        if (phase === "unmount") {
          if (host.getAttribute(virtualSearchItemAttribute) === context.item.id) {
            host.removeAttribute(virtualSearchItemAttribute);
          }
          delete host.dataset.virtualSearchCodeViewItem;
          return;
        }
        host.setAttribute(virtualSearchItemAttribute, context.item.id);
        host.dataset.virtualSearchCodeViewItem = context.item.id;
      },
    }),
    [],
  );

  const selectFile = (itemId: string) => {
    setSelectedFile(itemId);
    viewerRef.current?.scrollTo({
      type: "item",
      id: itemId,
      align: "start",
      behavior: "instant",
    });
  };

  return (
    <div className="diff-workspace">
      <aside className="diff-sidebar" aria-label="Changed files">
        <div className="diff-sidebar-heading">
          <span>Files changed</span>
          <span>{demoData.files.length}</span>
        </div>
        <div className="diff-filter" aria-hidden="true">
          <SearchIcon />
          <span>Filter files</span>
          <kbd>⌥ F</kbd>
        </div>
        <nav className="diff-file-list" aria-label="Diff files">
          {demoData.files.map((file, index) => (
            <button
              key={file.id}
              type="button"
              className={
                (activeSearchFile ?? selectedFile) === file.id
                  ? "is-selected"
                  : undefined
              }
              onClick={() => selectFile(file.id)}
            >
              <span className="diff-file-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="diff-file-copy">
                <span className="diff-file-name">
                  {file.name.split("/").at(-1)}
                </span>
                <span className="diff-file-path">
                  {file.name.includes("/")
                    ? file.name.slice(0, file.name.lastIndexOf("/"))
                    : "root"}
                </span>
              </span>
              <span className="diff-file-stats">
                <span>+{file.additions}</span>
                <span>−{file.deletions}</span>
              </span>
            </button>
          ))}
        </nav>
        <div className="diff-sidebar-foot">
          <span className="diff-live-dot" />
          All data bundled locally
        </div>
      </aside>

      <section className="diff-review" aria-label="Virtualized code diff">
        <div className="diff-review-toolbar">
          <div>
            <span className="diff-review-eyebrow">Review surface</span>
            <strong>{demoData.units.length} virtualized files</strong>
          </div>
          <div className="diff-review-legend">
            <span><i className="is-addition" /> Added</span>
            <span><i className="is-deletion" /> Removed</span>
          </div>
        </div>
        <CodeView
          ref={viewerRef}
          containerRef={scrollRef}
          className="diff-code-view"
          initialItems={demoData.items}
          options={options}
          disableWorkerPool
        />
      </section>
    </div>
  );
}

export function DiffDemo() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const recordsHref = import.meta.env.BASE_URL;

  return (
    <VirtualSearchProvider
      rootRef={scrollRef}
      scrollMargin={80}
    >
      <div className="diff-demo">
        <header className="diff-topbar">
          <a className="diff-brand" href={recordsHref} aria-label="Virtual Search">
            <span className="diff-brand-mark">VS</span>
            <span>
              Virtual Search
              <small>Integration specimen 02</small>
            </span>
          </a>
          <div className="diff-repo-path">
            <span>vertex-labs</span>
            <span>/</span>
            <strong>runtime</strong>
            <span className="diff-pr-pill">PR #1842</span>
          </div>
          <a className="diff-demo-switch" href={recordsHref}>
            Records demo <span aria-hidden="true">↗</span>
          </a>
        </header>

        <section className="diff-summary">
          <div className="diff-summary-copy">
            <span className="diff-overline">Pull request · ready for review</span>
            <h1>Make every virtual frame searchable</h1>
            <p>
              A DiffsHub-style CodeView rendering thousands of inline patch
              lines. Search reaches code that has never entered the DOM.
            </p>
          </div>
          <div className="diff-summary-meta">
            <div>
              <span>Files</span>
              <strong>{demoData.files.length}</strong>
            </div>
            <div>
              <span>Indexed lines</span>
              <strong>{demoData.units.reduce((sum, unit) => sum + unit.parts.length, 0).toLocaleString()}</strong>
            </div>
            <div className="diff-additions">
              <span>Additions</span>
              <strong>+{demoData.additions}</strong>
            </div>
            <div className="diff-deletions">
              <span>Deletions</span>
              <strong>−{demoData.deletions}</strong>
            </div>
          </div>
          <div className="diff-search-prompt">
            <span className="diff-prompt-number">01</span>
            <p>
              Press <kbd>⌘ F</kbd> and search for <code>signalRelay</code>.
              Six matches are distributed across this virtualized review.
            </p>
          </div>
        </section>

        <DiffWorkspace scrollRef={scrollRef} />
        <SearchControls />
      </div>
    </VirtualSearchProvider>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m13 13 4 4" />
    </svg>
  );
}
