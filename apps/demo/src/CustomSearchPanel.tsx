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
  emptyLabel: string,
) {
  if (query.length === 0) return emptyLabel;
  if (status === "searching") return "Indexing matches…";
  if (matchCount === 0) return "No occurrences found";
  return `Occurrence ${activeIndex + 1} of ${matchCount}`;
}

export function CustomSearchPanel({
  emptyLabel = "Type to search every registry",
  inputLabel = "Search all page content",
  kicker = "Custom UI · headless search API",
  placeholder = "Search every visible and virtual record",
}: {
  emptyLabel?: string;
  inputLabel?: string;
  kicker?: string;
  placeholder?: string;
} = {}) {
  const search = useVirtualSearch();
  const panelRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useSearchPanelViewport(panelRef, {
    anchor: "top",
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
    emptyLabel,
  );
  const hasMatches = search.matches.length > 0;
  const activeMatch = search.matches[search.activeIndex];
  const errorMessage = search.error instanceof Error
    ? search.error.message
    : search.error == null
      ? undefined
      : String(search.error);

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
      data-search-error={errorMessage}
      aria-busy={search.status === "searching"}
      onSubmit={onSubmit}
    >
      <div className="command-search-heading">
        <span className="command-search-kicker">
          {kicker}
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
            {inputLabel}
          </span>
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            value={search.query}
            placeholder={placeholder}
            aria-label={inputLabel}
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
