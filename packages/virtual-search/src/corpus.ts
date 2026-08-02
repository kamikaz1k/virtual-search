import {
  createRangeFromTextMap,
  DomTextBuilder,
  textMapForElement,
  type DomTextMap,
} from "./dom-text";
import type {
  LocateContext,
  SearchDocument,
  SearchOccurrence,
  SearchUnit,
  VirtualSearchRegion,
} from "./types";

export const REGION_ATTRIBUTE = "data-virtual-search-region";
export const ITEM_ATTRIBUTE = "data-virtual-search-item";
export const PART_ATTRIBUTE = "data-virtual-search-part";

const excludedTags = new Set([
  "SCRIPT",
  "STYLE",
  "TEMPLATE",
  "NOSCRIPT",
  "SELECT",
  "OPTION",
]);

const searchableInputTypes = new Set([
  "email",
  "search",
  "tel",
  "text",
  "url",
]);

const inputValueKeys = new WeakMap<Element, string>();
let nextInputValueKey = 0;

const blockTags = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "BR", "DD", "DIV", "DL",
  "DT", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2",
  "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P",
  "PRE", "SECTION", "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR",
  "UL",
]);

export interface PreparedDocument extends SearchDocument {
  reveal(
    occurrence: SearchOccurrence,
    signal: AbortSignal,
  ): Promise<Element | null>;
  locateMounted(
    occurrence: SearchOccurrence,
    signal: AbortSignal,
  ): Promise<readonly Range[]>;
  locateInputValue?(
    occurrence: SearchOccurrence,
  ): InputValueMatch | null;
}

export interface InputValueMatch {
  element: HTMLInputElement | HTMLTextAreaElement;
  start: number;
  end: number;
}

export interface PreparedCorpus {
  documents: readonly PreparedDocument[];
  byIdentity: ReadonlyMap<string, PreparedDocument>;
}

export function occurrenceIdentity(
  occurrence: Pick<SearchOccurrence, "regionId" | "unitKey">,
): string {
  return JSON.stringify([occurrence.regionId, occurrence.unitKey]);
}

function isExcluded(element: Element): boolean {
  if (excludedTags.has(element.tagName)) return true;
  const hiddenUntilFound = element.getAttribute("hidden") === "until-found";
  if (
    (element.hasAttribute("hidden") && !hiddenUntilFound)
    || element.hasAttribute("inert")
  ) {
    return true;
  }

  const style = (element as HTMLElement).style;
  if (style?.display === "none" || style?.visibility === "hidden") return true;

  const computedStyle = element.ownerDocument.defaultView
    ?.getComputedStyle(element);
  if (
    (computedStyle?.display === "none" && !hiddenUntilFound)
    || computedStyle?.visibility === "hidden"
    || (
      computedStyle?.contentVisibility === "hidden"
      && !hiddenUntilFound
    )
  ) {
    return true;
  }

  return false;
}

function escapeAttribute(value: string): string {
  const escape = (
    globalThis.CSS as { escape?: (input: string) => string } | undefined
  )?.escape;
  return escape
    ? escape(value)
    : value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function findRenderedItem(region: VirtualSearchRegion, key: string): Element | null {
  const anchor = region.anchor();
  if (!anchor) return null;

  return anchor.querySelector(
    `[${ITEM_ATTRIBUTE}="${escapeAttribute(key)}"]`,
  );
}

async function locateVirtualOccurrence(
  region: VirtualSearchRegion,
  occurrence: SearchOccurrence,
  renderedItem: Element,
  signal: AbortSignal,
): Promise<readonly Range[]> {
  const context: LocateContext = { signal };
  if (region.locate) {
    return region.locate(occurrence, renderedItem, context);
  }

  const part = renderedItem.querySelector(
    `[${PART_ATTRIBUTE}="${escapeAttribute(occurrence.partId)}"]`,
  ) ?? (occurrence.partId === "text" ? renderedItem : null);

  if (!part) return [];

  const range = createRangeFromTextMap(
    textMapForElement(part),
    occurrence.start,
    occurrence.end,
  );

  return range ? [range] : [];
}

function createVirtualDocument(
  region: VirtualSearchRegion,
  unit: SearchUnit,
  unitOrder: number,
  documentOrder: number,
): PreparedDocument {
  return {
    regionId: region.id,
    unitKey: unit.key,
    unitOrder,
    documentOrder,
    parts: unit.parts,
    async reveal(occurrence, signal) {
      return region.reveal(occurrence, {
        signal,
        align: "center",
      });
    },
    async locateMounted(occurrence, signal) {
      const mounted = findRenderedItem(region, unit.key);
      if (!mounted) return [];
      return locateVirtualOccurrence(region, occurrence, mounted, signal);
    },
  };
}

function createDomDocument(
  map: DomTextMap,
  segment: number,
  documentOrder: number,
): PreparedDocument {
  return {
    regionId: "__dom__",
    unitKey: String(segment),
    unitOrder: segment,
    documentOrder,
    parts: [{ id: "text", text: map.text }],
    async reveal(occurrence, signal) {
      const range = createRangeFromTextMap(
        map,
        occurrence.start,
        occurrence.end,
      );
      if (!range) return null;

      const matchedElement = range.startContainer instanceof Element
        ? range.startContainer
        : range.startContainer.parentElement;
      if (!matchedElement) return null;
      return revealElementAncestors(matchedElement, signal);
    },
    async locateMounted(occurrence) {
      const range = createRangeFromTextMap(map, occurrence.start, occurrence.end);
      return range ? [range] : [];
    },
  };
}

function revealElementAncestors(
  matchedElement: Element,
  signal: AbortSignal,
): Element | null {
  const ancestors: Element[] = [];
  for (
    let ancestor: Element | null = matchedElement;
    ancestor;
    ancestor = ancestor.parentElement
  ) {
    ancestors.push(ancestor);
  }

  for (const ancestor of ancestors.reverse()) {
    if (signal.aborted) return null;
    if (ancestor.tagName === "DETAILS" && !ancestor.hasAttribute("open")) {
      const summary = ancestor.querySelector(":scope > summary");
      if (!summary?.contains(matchedElement)) ancestor.setAttribute("open", "");
    }
    if (ancestor.getAttribute("hidden") === "until-found") {
      const EventConstructor = ancestor.ownerDocument.defaultView?.Event
        ?? Event;
      ancestor.dispatchEvent(new EventConstructor("beforematch"));
      if (signal.aborted) return null;
      ancestor.removeAttribute("hidden");
    }
  }
  return matchedElement;
}

export function isSearchableInputValue(
  element: Element,
): element is HTMLInputElement | HTMLTextAreaElement {
  if (element.closest("[data-virtual-search-panel]")) return false;
  if (element.tagName === "TEXTAREA") return true;
  if (element.tagName !== "INPUT") return false;
  return searchableInputTypes.has((element as HTMLInputElement).type);
}

function inputValueKey(element: Element): string {
  const existing = inputValueKeys.get(element);
  if (existing) return existing;
  const key = `input:${nextInputValueKey}`;
  nextInputValueKey += 1;
  inputValueKeys.set(element, key);
  return key;
}

function createInputValueDocument(
  element: HTMLInputElement | HTMLTextAreaElement,
  unitOrder: number,
  documentOrder: number,
): PreparedDocument {
  return {
    regionId: "__dom__",
    unitKey: inputValueKey(element),
    unitOrder,
    documentOrder,
    parts: [{ id: "value", text: element.value }],
    async reveal(_occurrence, signal) {
      return element.isConnected
        ? revealElementAncestors(element, signal)
        : null;
    },
    async locateMounted() {
      return [];
    },
    locateInputValue(occurrence) {
      if (
        !element.isConnected
        || occurrence.start < 0
        || occurrence.end > element.value.length
      ) {
        return null;
      }
      return {
        element,
        start: occurrence.start,
        end: occurrence.end,
      };
    },
  };
}

export async function buildCorpus(
  root: Element,
  regions: readonly VirtualSearchRegion[],
  signal: AbortSignal,
): Promise<PreparedCorpus> {
  const anchoredRegions = new Map<Element, VirtualSearchRegion>();

  for (const region of regions) {
    const anchor = region.anchor();
    if (!anchor || !root.contains(anchor)) continue;

    if (anchoredRegions.has(anchor)) {
      throw new Error("Only one virtual search region may use an anchor");
    }

    for (const existingAnchor of anchoredRegions.keys()) {
      if (existingAnchor.contains(anchor) || anchor.contains(existingAnchor)) {
        throw new Error("Nested virtual search regions are not supported");
      }
    }

    anchoredRegions.set(anchor, region);
  }

  const unitsByRegion = new Map<string, readonly SearchUnit[]>();
  await Promise.all(
    [...anchoredRegions.values()].map(async region => {
      const units = await region.getUnits(signal);
      if (!signal.aborted) unitsByRegion.set(region.id, units);
    }),
  );

  if (signal.aborted) {
    return { documents: [], byIdentity: new Map() };
  }

  const documents: PreparedDocument[] = [];
  const domBuilder = new DomTextBuilder();
  let domSegment = 0;
  let inputValueOrder = 0;
  let documentOrder = 0;

  const flushDom = () => {
    if (domBuilder.length === 0) return;
    const map = domBuilder.take();
    if (map.spans.length === 0 || map.text.trim().length === 0) return;

    documents.push(createDomDocument(map, domSegment, documentOrder));
    domSegment += 1;
    documentOrder += 1;
  };

  const visit = (node: Node) => {
    if (signal.aborted) return;

    if (node.nodeType === Node.TEXT_NODE) {
      domBuilder.appendText(node as Text);
      return;
    }

    if (!(node instanceof Element)) return;

    const region = anchoredRegions.get(node);
    if (region) {
      flushDom();
      const units = unitsByRegion.get(region.id) ?? [];
      const unitKeys = new Set<string>();
      units.forEach((unit, unitOrder) => {
        if (unitKeys.has(unit.key)) {
          throw new Error(
            `Search region "${region.id}" contains duplicate unit key "${unit.key}"`,
          );
        }
        unitKeys.add(unit.key);

        const partIds = new Set<string>();
        for (const part of unit.parts) {
          if (partIds.has(part.id)) {
            throw new Error(
              `Search unit "${unit.key}" contains duplicate part id "${part.id}"`,
            );
          }
          partIds.add(part.id);
        }

        documents.push(
          createVirtualDocument(region, unit, unitOrder, documentOrder),
        );
        documentOrder += 1;
      });
      return;
    }

    if (
      node !== root
      && isSearchableInputValue(node)
      && !isExcluded(node)
    ) {
      flushDom();
      if (node.value.length > 0) {
        documents.push(
          createInputValueDocument(node, inputValueOrder, documentOrder),
        );
        inputValueOrder += 1;
        documentOrder += 1;
      }
      return;
    }

    if (node !== root && isExcluded(node)) return;

    const isBlock = blockTags.has(node.tagName);
    if (isBlock) domBuilder.appendSeparator();
    for (const child of node.childNodes) visit(child);
    if (isBlock) domBuilder.appendSeparator();
  };

  visit(root);
  flushDom();

  return {
    documents,
    byIdentity: new Map(
      documents.map(document => [
        occurrenceIdentity(document),
        document,
      ]),
    ),
  };
}
