import { buildCorpus, occurrenceIdentity, type PreparedCorpus } from "./corpus";
import { SearchDiagnostics } from "./diagnostics";
import { createMainThreadExecutor } from "./executors/main-thread";
import {
  activeHighlightName,
  passiveHighlightName,
  SearchHighlighter,
} from "./highlighter";
import { VirtualSearchRevealError } from "./types";
import type {
  SearchOccurrence,
  SearchState,
  SearchStateListener,
  VirtualSearchController,
  VirtualSearchOptions,
  VirtualSearchRegion,
} from "./types";

const initialState: SearchState = {
  isOpen: false,
  query: "",
  status: "idle",
  matches: [],
  activeIndex: -1,
  error: null,
};

function sameOccurrence(a: SearchOccurrence, b: SearchOccurrence): boolean {
  return a.regionId === b.regionId
    && a.unitKey === b.unitKey
    && a.partId === b.partId
    && a.start === b.start
    && a.end === b.end;
}

function composedParent(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;

  const treeRoot = element.getRootNode();
  const ShadowRootConstructor = element.ownerDocument.defaultView?.ShadowRoot;
  return ShadowRootConstructor && treeRoot instanceof ShadowRootConstructor
    ? treeRoot.host
    : null;
}

function isComposedDescendantOf(
  element: Element,
  ancestor: Element,
): boolean {
  for (
    let current: Element | null = element;
    current;
    current = composedParent(current)
  ) {
    if (current === ancestor) return true;
  }
  return false;
}

function isRangeVisible(range: Range, root: Element): boolean {
  const matchedElement = range.startContainer instanceof Element
    ? range.startContainer
    : range.startContainer.parentElement;
  if (!matchedElement) return false;

  for (
    let element: Element | null = matchedElement;
    element;
    element = composedParent(element)
  ) {
    if (
      element.hasAttribute("hidden")
      || element.hasAttribute("inert")
    ) {
      return false;
    }

    const computedStyle = element.ownerDocument.defaultView
      ?.getComputedStyle(element);
    if (
      computedStyle?.display === "none"
      || computedStyle?.visibility === "hidden"
      || computedStyle?.contentVisibility === "hidden"
    ) {
      return false;
    }

    if (element.tagName === "DETAILS" && !element.hasAttribute("open")) {
      const summary = element.querySelector(":scope > summary");
      if (!summary || !isComposedDescendantOf(matchedElement, summary)) {
        return false;
      }
    }

    if (element === root) return true;
  }

  return false;
}

export function createVirtualSearch(
  options: VirtualSearchOptions,
): VirtualSearchController {
  const executor = options.executor ?? createMainThreadExecutor();
  const highlighter = new SearchHighlighter();
  const diagnostics = new SearchDiagnostics(
    options.diagnostics?.missingHighlightStyles !== false,
  );
  const listeners = new Set<SearchStateListener>();
  const regions = new Map<string, VirtualSearchRegion>();

  let state = initialState;
  let corpus: PreparedCorpus = { documents: [], byIdentity: new Map() };
  let searchAbort: AbortController | null = null;
  let navigationAbort: AbortController | null = null;
  let focusBeforeOpen: Element | null = null;
  let disposed = false;
  let mutationObserver: MutationObserver | null = null;
  let observedRoot: Element | null = null;
  let mutationRefreshQueued = false;

  const root = () => typeof options.root === "function"
    ? options.root()
    : options.root;

  const emit = (patch: Partial<SearchState>) => {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener(state));
  };

  const mutationIsInsideVirtualRegion = (mutation: MutationRecord) => {
    const target = mutation.target instanceof Element
      ? mutation.target
      : mutation.target.parentElement;

    return target
      ? [...regions.values()].some(region => {
          const anchor = region.anchor();
          return anchor ? anchor.contains(target) : false;
        })
      : false;
  };

  const ensureMutationObserver = () => {
    const searchRoot = root();
    if (!searchRoot || observedRoot === searchRoot) return;

    mutationObserver?.disconnect();
    observedRoot = searchRoot;
    mutationObserver = new MutationObserver(mutations => {
      const relevantMutations = mutations.filter(mutation => !(
        mutation.type === "attributes"
        && mutation.attributeName === "hidden"
        && mutation.oldValue === "until-found"
        && mutation.target instanceof Element
        && !mutation.target.hasAttribute("hidden")
      ));

      if (
        disposed
        || state.query.length === 0
        || relevantMutations.length === 0
        || relevantMutations.every(mutationIsInsideVirtualRegion)
        || mutationRefreshQueued
      ) {
        return;
      }

      mutationRefreshQueued = true;
      queueMicrotask(() => {
        mutationRefreshQueued = false;
        if (state.query.length > 0 && !disposed) {
          const preferred = state.matches[state.activeIndex];
          void runQuery(state.query, preferred);
        }
      });
    });
    mutationObserver.observe(searchRoot, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ["hidden", "inert", "style", "class"],
    });
  };

  const mountedRanges = async (
    matches: readonly SearchOccurrence[],
    signal: AbortSignal,
  ): Promise<Range[]> => {
    const ranges: Range[] = [];

    for (const match of matches) {
      if (signal.aborted) break;
      const document = corpus.byIdentity.get(occurrenceIdentity(match));
      if (!document) continue;
      const located = await document.locateMounted(match, signal);
      diagnostics.checkHighlightRanges(
        located,
        passiveHighlightName,
        match.regionId,
      );
      ranges.push(...located);
    }

    return ranges;
  };

  const scrollRangeIntoView = (range: Range) => {
    const element = range.startContainer.parentElement;
    if (!element) return;

    const rect = range.getBoundingClientRect();
    const margin = options.scrollMargin ?? 24;
    const outsideViewport = rect.top < margin
      || rect.bottom > globalThis.innerHeight - margin;

    if (outsideViewport) {
      element.scrollIntoView({ block: "center", inline: "nearest" });
    }
  };

  const goTo = async (requestedIndex: number) => {
    if (disposed || state.matches.length === 0) return;

    navigationAbort?.abort();
    const abort = new AbortController();
    navigationAbort = abort;

    const count = state.matches.length;
    const index = ((requestedIndex % count) + count) % count;
    const occurrence = state.matches[index];
    if (!occurrence) return;

    emit({ activeIndex: index, status: "navigating", error: null });

    try {
      const document = corpus.byIdentity.get(occurrenceIdentity(occurrence));
      if (!document) return;

      const rendered = await document.reveal(occurrence, abort.signal);
      if (abort.signal.aborted) return;
      if (!rendered) throw new VirtualSearchRevealError(occurrence);

      const activeRanges = await document.locateMounted(
        occurrence,
        abort.signal,
      );
      if (abort.signal.aborted) return;
      diagnostics.checkHighlightRanges(
        activeRanges,
        activeHighlightName,
        occurrence.regionId,
      );
      const searchRoot = root();
      if (
        !searchRoot
        || activeRanges.length === 0
        || activeRanges.some(range => !isRangeVisible(range, searchRoot))
      ) {
        throw new VirtualSearchRevealError(occurrence);
      }

      const passiveMatches = state.matches.filter((_, matchIndex) =>
        matchIndex !== index
      );
      const passiveRanges = await mountedRanges(
        passiveMatches,
        abort.signal,
      );
      if (abort.signal.aborted) return;

      highlighter.apply(passiveRanges, activeRanges);
      const activeRange = activeRanges[0];
      if (activeRange) scrollRangeIntoView(activeRange);
      emit({ status: "ready" });
    } catch (error) {
      if (!abort.signal.aborted) emit({ status: "error", error });
    }
  };

  const runQuery = async (
    query: string,
    preferred?: SearchOccurrence,
  ) => {
    ensureMutationObserver();
    searchAbort?.abort();
    navigationAbort?.abort();
    const abort = new AbortController();
    searchAbort = abort;

    highlighter.clear();
    emit({
      query,
      status: query.length === 0 ? "idle" : "searching",
      matches: [],
      activeIndex: -1,
      error: null,
    });

    if (query.length === 0) return;

    const searchRoot = root();
    if (!searchRoot) {
      emit({
        status: "error",
        error: new Error("Virtual Search root is not available"),
      });
      return;
    }

    try {
      const nextCorpus = await buildCorpus(
        searchRoot,
        [...regions.values()],
        abort.signal,
      );
      if (abort.signal.aborted) return;

      const matches = await executor.search(
        nextCorpus.documents,
        query,
        options.searchOptions ?? {},
        abort.signal,
      );
      if (abort.signal.aborted) return;

      corpus = nextCorpus;
      let activeIndex = matches.length === 0 ? -1 : 0;
      if (preferred) {
        const preservedIndex = matches.findIndex(match =>
          sameOccurrence(match, preferred)
        );
        if (preservedIndex !== -1) activeIndex = preservedIndex;
      }

      emit({
        matches,
        activeIndex,
        status: "ready",
      });

      if (activeIndex !== -1) await goTo(activeIndex);
    } catch (error) {
      if (!abort.signal.aborted) emit({ status: "error", error });
    }
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    registerRegion(region) {
      if (region.id === "__dom__") {
        throw new Error('Search region id "__dom__" is reserved');
      }
      if (regions.has(region.id)) {
        throw new Error(`Search region "${region.id}" is already registered`);
      }

      regions.set(region.id, region);
      return () => {
        regions.delete(region.id);
      };
    },
    async invalidate() {
      if (state.query.length === 0) return;
      const preferred = state.matches[state.activeIndex];
      await runQuery(state.query, preferred);
    },
    open() {
      if (!state.isOpen) focusBeforeOpen = document.activeElement;
      ensureMutationObserver();
      emit({ isOpen: true });
    },
    close() {
      navigationAbort?.abort();
      highlighter.clear();
      emit({ isOpen: false });
      if (focusBeforeOpen instanceof HTMLElement) focusBeforeOpen.focus();
    },
    setQuery: query => runQuery(query),
    next: () => goTo(state.activeIndex + 1),
    previous: () => goTo(state.activeIndex - 1),
    goTo,
    dispose() {
      disposed = true;
      searchAbort?.abort();
      navigationAbort?.abort();
      highlighter.clear();
      mutationObserver?.disconnect();
      executor.dispose?.();
      listeners.clear();
      regions.clear();
    },
  };
}
