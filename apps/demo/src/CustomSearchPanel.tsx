import { type FormEvent, useEffect, useRef } from "react";
import {
  useSearchPanelViewport,
  useVirtualSearch,
} from "virtual-search/react";

function resultLabel(
  query: string,
  status: ReturnType<typeof useVirtualSearch>["status"],
  activeIndex: number,
  matchCount: number,
) {
  if (query.length === 0) return "Type to search every registry";
  if (status === "searching") return "Indexing matches…";
  if (matchCount === 0) return "No occurrences found";
  return `Occurrence ${activeIndex + 1} of ${matchCount}`;
}

export function CustomSearchPanel() {
  const search = useVirtualSearch();
  const panelRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useSearchPanelViewport(panelRef, {
    enabled: search.isOpen,
    padding: 10,
  });

  useEffect(() => {
    if (!search.isOpen) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [search.isOpen]);

  if (!search.isOpen) return null;

  const label = resultLabel(
    search.query,
    search.status,
    search.activeIndex,
    search.matches.length,
  );
  const hasMatches = search.matches.length > 0;
  const activeMatch = search.matches[search.activeIndex];

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void search.next();
  };

  return (
    <form
      ref={panelRef}
      role="search"
      className="command-search"
      data-virtual-search-panel=""
      data-search-status={search.status}
      data-active-region={activeMatch?.regionId}
      data-active-unit={activeMatch?.unitKey}
      aria-busy={search.status === "searching"}
      onSubmit={onSubmit}
    >
      <div className="command-search-heading">
        <span className="command-search-kicker">
          Custom UI · headless search API
        </span>
        <button
          className="command-search-close"
          type="button"
          onClick={search.close}
          aria-label="Close search"
        >
          Close <kbd>Esc</kbd>
        </button>
      </div>

      <div className="command-search-entry">
        <span className="command-search-glyph" aria-hidden="true">
          ↳
        </span>
        <label>
          <span className="virtual-search-visually-hidden">
            Search all page content
          </span>
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            value={search.query}
            placeholder="Search every visible and virtual record"
            aria-label="Search all page content"
            autoComplete="off"
            onChange={event => void search.setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.defaultPrevented) return;
              if (event.key === "Escape") {
                event.preventDefault();
                search.close();
              } else if (event.key === "Enter" && event.shiftKey) {
                event.preventDefault();
                void search.previous();
              }
            }}
          />
        </label>
      </div>

      <div className="command-search-meta">
        <output aria-live="polite" aria-atomic="true">
          {label}
        </output>
        <progress
          max={Math.max(search.matches.length, 1)}
          value={hasMatches ? search.activeIndex + 1 : 0}
          aria-label="Search result position"
        />
        <div className="command-search-actions">
          <button
            type="button"
            onClick={() => void search.previous()}
            disabled={!hasMatches}
            aria-label="Previous result"
          >
            <span aria-hidden="true">↑</span>
            Prev
          </button>
          <button
            type="button"
            onClick={() => void search.next()}
            disabled={!hasMatches}
            aria-label="Next result"
          >
            Next
            <span aria-hidden="true">↓</span>
          </button>
        </div>
      </div>
    </form>
  );
}
