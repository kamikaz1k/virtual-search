const transparentColors = new Set([
  "transparent",
  "rgba(0, 0, 0, 0)",
  "rgba(0,0,0,0)",
]);

function originatingElement(range: Range): Element | null {
  return range.startContainer instanceof Element
    ? range.startContainer
    : range.startContainer.parentElement;
}

function shadowRootFor(element: Element): ShadowRoot | null {
  const root = element.getRootNode();
  const ShadowRootConstructor = element.ownerDocument.defaultView?.ShadowRoot;
  return ShadowRootConstructor && root instanceof ShadowRootConstructor
    ? root
    : null;
}

function appearsVisiblyStyled(element: Element, name: string): boolean | null {
  const view = element.ownerDocument.defaultView;
  if (!view) return null;

  try {
    const normal = view.getComputedStyle(element);
    const highlight = view.getComputedStyle(element, `::highlight(${name})`);
    if (highlight.length === 0) return null;

    return (
      !transparentColors.has(highlight.backgroundColor)
      || highlight.color !== normal.color
      || highlight.textDecorationLine !== normal.textDecorationLine
      || highlight.textShadow !== normal.textShadow
    );
  } catch {
    return null;
  }
}

function hostLabel(host: Element): string {
  const id = host.id ? `#${host.id}` : "";
  const classes = [...host.classList]
    .slice(0, 2)
    .map(name => `.${name}`)
    .join("");
  return `<${host.localName}${id}${classes}>`;
}

export class SearchDiagnostics {
  private readonly checked = new WeakMap<ShadowRoot, Set<string>>();

  constructor(private readonly missingHighlightStyles: boolean) {}

  checkHighlightRanges(
    ranges: readonly Range[],
    highlightName: string,
    regionId: string,
  ): void {
    if (!this.missingHighlightStyles) return;

    for (const range of ranges) {
      const element = originatingElement(range);
      if (!element) continue;
      const shadowRoot = shadowRootFor(element);
      if (!shadowRoot) continue;

      const warningKey = highlightName;
      const checked = this.checked.get(shadowRoot) ?? new Set<string>();
      if (checked.has(warningKey)) continue;
      const visiblyStyled = appearsVisiblyStyled(element, highlightName);
      if (visiblyStyled === null) continue;

      checked.add(warningKey);
      this.checked.set(shadowRoot, checked);
      if (visiblyStyled) continue;
      console.warn(
        `[virtual-search] A range in region "${regionId}" is inside the `
        + `shadow root hosted by ${hostLabel(shadowRoot.host)}, but `
        + `::highlight(${highlightName}) does not appear to have visible `
        + "styles. Add the Virtual Search highlight rules to the page or "
        + "component stylesheet, or disable this diagnostic "
        + "with diagnostics.missingHighlightStyles.",
      );
    }
  }
}
