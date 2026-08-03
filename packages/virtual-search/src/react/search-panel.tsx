import { type FormEvent, useEffect, useRef } from "react";
import { useVirtualSearch } from "./context.js";
import {
  type SearchPanelViewportAnchor,
  useSearchPanelViewport,
} from "./search-panel-viewport.js";

export interface SearchPanelProps {
  className?: string;
  keepInVisualViewport?: boolean;
  placeholder?: string;
  viewportAnchor?: SearchPanelViewportAnchor;
  viewportPadding?: number;
}

export function SearchPanel({
  className,
  keepInVisualViewport = true,
  placeholder = "Find on page",
  viewportAnchor = "top",
  viewportPadding = 8,
}: SearchPanelProps) {
  const search = useVirtualSearch();
  const panelRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useSearchPanelViewport(panelRef, {
    anchor: viewportAnchor,
    enabled: search.isOpen && keepInVisualViewport,
    padding: viewportPadding,
  });

  useEffect(() => {
    if (search.isOpen) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [search.isOpen]);

  if (!search.isOpen) return null;

  const resultLabel = search.query.length === 0
    ? "Enter a search term"
    : search.status === "searching"
      ? "Searching…"
      : search.matches.length === 0
        ? "No results"
        : `${search.activeIndex + 1} of ${search.matches.length}`;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void search.next();
  };

  return (
    <form
      ref={panelRef}
      role="search"
      className={className}
      data-virtual-search-panel=""
      data-search-status={search.status}
      data-active-region={search.matches[search.activeIndex]?.regionId}
      data-active-unit={search.matches[search.activeIndex]?.unitKey}
      aria-busy={search.status === "searching"}
      onSubmit={onSubmit}
    >
      <label>
        <span className="virtual-search-visually-hidden">{placeholder}</span>
        <input
          ref={inputRef}
          type="search"
          inputMode="search"
          value={search.query}
          placeholder={placeholder}
          aria-label={placeholder}
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

      <output aria-live="polite" aria-atomic="true">
        {resultLabel}
      </output>

      <button
        type="button"
        onClick={() => void search.previous()}
        disabled={search.matches.length === 0}
        aria-label="Previous result"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={() => void search.next()}
        disabled={search.matches.length === 0}
        aria-label="Next result"
      >
        ↓
      </button>
      <button type="button" onClick={search.close} aria-label="Close search">
        ×
      </button>
    </form>
  );
}
