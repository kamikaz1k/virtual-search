import {
  type MaybeRefOrGetter,
  toValue,
  type Ref,
  watchPostEffect,
} from "vue";
import {
  attachSearchPanelViewport,
  type SearchPanelViewportAnchor,
} from "../search-panel-viewport";

export type { SearchPanelViewportAnchor } from "../search-panel-viewport";

export interface SearchPanelViewportOptions {
  anchor?: MaybeRefOrGetter<SearchPanelViewportAnchor>;
  enabled?: MaybeRefOrGetter<boolean>;
  padding?: MaybeRefOrGetter<number>;
}

export function useSearchPanelViewport<ElementType extends HTMLElement>(
  panelRef: Readonly<Ref<ElementType | null>>,
  {
    anchor = "preserve",
    enabled = true,
    padding = 8,
  }: SearchPanelViewportOptions = {},
): void {
  watchPostEffect(onCleanup => {
    const panel = panelRef.value;
    if (!panel) return;
    onCleanup(attachSearchPanelViewport(panel, {
      anchor: toValue(anchor),
      enabled: toValue(enabled),
      padding: toValue(padding),
    }));
  });
}
