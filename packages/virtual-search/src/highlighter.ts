const passiveHighlightName = "virtual-search-match";
const activeHighlightName = "virtual-search-active";

interface HighlightRegistryLike {
  set(name: string, highlight: Highlight): void;
  delete(name: string): boolean;
}

function registry(): HighlightRegistryLike | null {
  const css = globalThis.CSS as typeof CSS & {
    highlights?: HighlightRegistryLike;
  };
  return css?.highlights ?? null;
}

export class SearchHighlighter {
  apply(passive: readonly Range[], active: readonly Range[]): void {
    const highlights = registry();
    if (!highlights || typeof Highlight === "undefined") return;

    highlights.set(passiveHighlightName, new Highlight(...passive));
    highlights.set(activeHighlightName, new Highlight(...active));
  }

  clear(): void {
    const highlights = registry();
    highlights?.delete(passiveHighlightName);
    highlights?.delete(activeHighlightName);
  }
}
