import type { CodeViewHandle } from "@pierre/diffs/react";
import { useLayoutEffect, type RefObject } from "react";
import { useVirtualSearchController } from "virtual-search/react";
import type { SearchOccurrence } from "virtual-search";
import {
  decodeDiffUnitKey,
  type DiffSearchLine,
  type DiffSearchUnit,
  type DiffSide,
} from "./diffCorpus";

function nextFrame(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve();
      return;
    }
    requestAnimationFrame(() => resolve());
  });
}

function findMountedHost(
  anchor: Element,
  itemId: string,
): HTMLElement | null {
  for (const host of anchor.querySelectorAll<HTMLElement>("diffs-container")) {
    if (host.dataset.virtualSearchCodeViewItem === itemId) return host;
  }
  return null;
}

async function waitForMountedLine(
  anchor: Element,
  line: DiffSearchLine,
  signal: AbortSignal,
): Promise<HTMLElement | null> {
  for (let attempt = 0; attempt < 360 && !signal.aborted; attempt += 1) {
    const host = findMountedHost(anchor, line.itemId);
    const row = host
      ? findLineElement(host, line.side, line.lineNumber)
      : null;
    if (row) return row;
    await nextFrame(signal);
  }
  return null;
}

function findLineElement(
  host: HTMLElement,
  side: DiffSide,
  lineNumber: number,
): HTMLElement | null {
  const shadow = host.shadowRoot;
  if (!shadow) return null;

  const candidates = shadow.querySelectorAll<HTMLElement>(
    `[data-content] [data-line="${lineNumber}"]`,
  );

  if (candidates.length === 1) return candidates[0] ?? null;

  const expectedType = side === "deletions"
    ? "change-deletion"
    : "change-addition";

  for (const candidate of candidates) {
    if (candidate.dataset.lineType === expectedType) return candidate;
  }

  for (const candidate of candidates) {
    if (
      side === "additions"
      && candidate.dataset.lineType !== "change-deletion"
    ) {
      return candidate;
    }
  }

  return null;
}

function rangeForOccurrence(
  element: Element,
  occurrence: SearchOccurrence,
): Range | null {
  const walker = element.ownerDocument.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
  );
  let position = 0;
  let startNode: Text | null = null;
  let startOffset = 0;
  let endNode: Text | null = null;
  let endOffset = 0;
  let node = walker.nextNode();

  while (node) {
    const textNode = node as Text;
    const nextPosition = position + textNode.data.length;

    if (!startNode && occurrence.start >= position && occurrence.start < nextPosition) {
      startNode = textNode;
      startOffset = occurrence.start - position;
    }
    if (occurrence.end > position && occurrence.end <= nextPosition) {
      endNode = textNode;
      endOffset = occurrence.end - position;
      break;
    }

    position = nextPosition;
    node = walker.nextNode();
  }

  if (!startNode || !endNode) return null;
  const range = element.ownerDocument.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

export function useCodeViewSearchRegion({
  anchorRef,
  units,
  viewerRef,
}: {
  anchorRef: RefObject<HTMLDivElement | null>;
  units: readonly DiffSearchUnit[];
  viewerRef: RefObject<CodeViewHandle<undefined> | null>;
}) {
  const controller = useVirtualSearchController();

  useLayoutEffect(() => {
    const unitsByKey = new Map(units.map(unit => [unit.key, unit]));

    return controller.registerRegion({
      id: "diff-code",
      anchor: () => anchorRef.current,
      getUnits: () => units,
      async reveal(occurrence, context) {
        const unit = unitsByKey.get(occurrence.unitKey);
        const target = decodeDiffUnitKey(occurrence.partId);
        const anchor = anchorRef.current;
        const viewer = viewerRef.current;
        if (!unit || !target || !anchor || !viewer) return null;
        const line = unit.lines.find(candidate =>
          candidate.side === target.side
          && candidate.lineNumber === target.lineNumber
        );
        if (!line) return null;

        viewer.scrollTo({
          type: "line",
          id: line.itemId,
          lineNumber: line.lineNumber,
          side: line.side,
          align: context.align === "auto" ? "nearest" : context.align,
          behavior: "instant",
        });

        const renderedLine = await waitForMountedLine(
          anchor,
          line,
          context.signal,
        );
        if (context.signal.aborted) return null;
        return renderedLine;
      },
      locate(occurrence, renderedItem) {
        const target = decodeDiffUnitKey(occurrence.partId);
        if (!target || !(renderedItem instanceof HTMLElement)) return [];
        const line = findLineElement(
          renderedItem,
          target.side,
          target.lineNumber,
        );
        if (!line) return [];
        const range = rangeForOccurrence(line, occurrence);
        return range ? [range] : [];
      },
    });
  }, [anchorRef, controller, units, viewerRef]);
}
