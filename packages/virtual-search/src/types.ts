export interface SearchTextPart {
  id: string;
  text: string;
}

export interface SearchUnit {
  key: string;
  parts: readonly SearchTextPart[];
}

export interface SearchDocument {
  regionId: string;
  unitKey: string;
  unitOrder: number;
  documentOrder: number;
  parts: readonly SearchTextPart[];
}

export interface SearchOptions {
  caseSensitive?: boolean;
  normalize?: "NFC" | false;
}

export interface SearchOccurrence {
  regionId: string;
  unitKey: string;
  unitOrder: number;
  documentOrder: number;
  partId: string;
  start: number;
  end: number;
  occurrence: number;
}

export class VirtualSearchRevealError extends Error {
  readonly occurrence: SearchOccurrence;

  constructor(occurrence: SearchOccurrence) {
    super(
      `Search match could not be revealed: region "${occurrence.regionId}", `
      + `unit "${occurrence.unitKey}", part "${occurrence.partId}"`,
    );
    this.name = "VirtualSearchRevealError";
    this.occurrence = occurrence;
  }
}

export interface SearchExecutor {
  search(
    documents: readonly SearchDocument[],
    query: string,
    options: SearchOptions,
    signal: AbortSignal,
  ): Promise<readonly SearchOccurrence[]>;
  dispose?(): void;
}

export interface RevealContext {
  signal: AbortSignal;
  align: "center" | "start" | "end" | "auto";
}

export interface LocateContext {
  signal: AbortSignal;
}

export interface VirtualSearchRegion {
  id: string;
  anchor: () => Element | null;
  getUnits: (signal: AbortSignal) =>
    | readonly SearchUnit[]
    | Promise<readonly SearchUnit[]>;
  reveal: (
    occurrence: SearchOccurrence,
    context: RevealContext,
  ) => Element | null | Promise<Element | null>;
  locate?: (
    occurrence: SearchOccurrence,
    renderedItem: Element,
    context: LocateContext,
  ) => readonly Range[] | Promise<readonly Range[]>;
}

export interface SearchState {
  isOpen: boolean;
  query: string;
  status: "idle" | "searching" | "navigating" | "ready" | "error";
  matches: readonly SearchOccurrence[];
  activeIndex: number;
  error: unknown;
}

export type SearchStateListener = (state: SearchState) => void;

export interface VirtualSearchDiagnosticsOptions {
  /**
   * Warn when a range inside a shadow root does not appear to have visible
   * `::highlight()` styles. The diagnostic never modifies the shadow root.
   * @default true
   */
  missingHighlightStyles?: boolean;
}

export interface InputValueHighlightingOptions {
  /** Paint matching substrings with an inert mirror over the text control. */
  mode: "overlay";
  /**
   * Stacking order for the owned overlay host. Keep the Find panel above it.
   * @default 2147483000
   */
  zIndex?: number;
}

export interface VirtualSearchOptions {
  root: Element | (() => Element | null);
  diagnostics?: VirtualSearchDiagnosticsOptions;
  executor?: SearchExecutor;
  inputValueHighlighting?: InputValueHighlightingOptions;
  /**
   * @deprecated Opening the find panel no longer navigates or resets the
   * active match. Change the query or call a navigation method instead.
   */
  resetActiveMatchOnOpen?: boolean;
  searchOptions?: SearchOptions;
  scrollMargin?: number;
}

export interface VirtualSearchController {
  getState(): SearchState;
  subscribe(listener: SearchStateListener): () => void;
  registerRegion(region: VirtualSearchRegion): () => void;
  invalidate(regionId?: string): Promise<void>;
  open(): void;
  close(): void;
  setQuery(query: string): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  goTo(index: number): Promise<void>;
  dispose(): void;
}
