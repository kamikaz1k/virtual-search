import { type RefObject, useEffect } from "react";
import {
  attachSearchPanelViewport,
  type SearchPanelViewportOptions,
} from "../search-panel-viewport.js";

export type {
  SearchPanelViewportAnchor,
  SearchPanelViewportOptions,
} from "../search-panel-viewport.js";

export function useSearchPanelViewport<ElementType extends HTMLElement>(
  panelRef: RefObject<ElementType | null>,
  options: SearchPanelViewportOptions = {},
): void {
  const {
    anchor = "preserve",
    enabled = true,
    padding = 8,
  } = options;

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    return attachSearchPanelViewport(panel, { anchor, enabled, padding });
  }, [anchor, enabled, padding, panelRef]);
}
