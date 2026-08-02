import type { InputValueMatch } from "./corpus";
import type { InputValueHighlightingOptions } from "./types";

interface PaintedInputValueMatch extends InputValueMatch {
  active: boolean;
}

const passiveColor = "rgba(255, 214, 10, 0.48)";
const activeColor = "rgba(255, 149, 0, 0.68)";

function assignStyles(
  element: HTMLElement,
  styles: Partial<CSSStyleDeclaration>,
): void {
  Object.assign(element.style, styles);
}

function appendHighlightedValue(
  container: HTMLElement,
  value: string,
  matches: readonly PaintedInputValueMatch[],
): void {
  let offset = 0;
  for (const match of [...matches].sort((a, b) => a.start - b.start)) {
    if (match.start < offset) continue;
    container.append(value.slice(offset, match.start));
    const highlight = container.ownerDocument.createElement("span");
    highlight.dataset.virtualSearchInputHighlight = match.active
      ? "active"
      : "match";
    highlight.textContent = value.slice(match.start, match.end);
    assignStyles(highlight, {
      background: match.active ? activeColor : passiveColor,
      borderRadius: "2px",
      boxDecorationBreak: "clone",
      color: "transparent",
    });
    container.append(highlight);
    offset = match.end;
  }
  container.append(value.slice(offset));
}

function createWholeControlFallback(
  document: Document,
  rect: DOMRect,
  active: boolean,
  borderRadius: string,
): HTMLElement {
  const fallback = document.createElement("div");
  fallback.dataset.virtualSearchInputHighlightFallback = active
    ? "active"
    : "match";
  assignStyles(fallback, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    boxSizing: "border-box",
    border: `2px solid ${active ? activeColor : passiveColor}`,
    borderRadius,
  });
  return fallback;
}

function createMirror(
  element: HTMLInputElement | HTMLTextAreaElement,
  matches: readonly PaintedInputValueMatch[],
): HTMLElement | null {
  const document = element.ownerDocument;
  const view = document.defaultView;
  if (!view) return null;

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;

  const computed = view.getComputedStyle(element);
  const active = matches.some(match => match.active);
  if (computed.transform && computed.transform !== "none") {
    return createWholeControlFallback(
      document,
      rect,
      active,
      computed.borderRadius,
    );
  }

  const mirror = document.createElement("div");
  mirror.dataset.virtualSearchInputMirror = element.tagName.toLowerCase();
  assignStyles(mirror, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    boxSizing: "border-box",
    overflow: "hidden",
    paddingTop: computed.paddingTop,
    paddingRight: computed.paddingRight,
    paddingBottom: computed.paddingBottom,
    paddingLeft: computed.paddingLeft,
    borderTopWidth: computed.borderTopWidth,
    borderRightWidth: computed.borderRightWidth,
    borderBottomWidth: computed.borderBottomWidth,
    borderLeftWidth: computed.borderLeftWidth,
    borderStyle: "solid",
    borderColor: "transparent",
    borderRadius: computed.borderRadius,
    color: "transparent",
    font: computed.font,
    fontKerning: computed.fontKerning,
    fontStretch: computed.fontStretch,
    fontVariant: computed.fontVariant,
    letterSpacing: computed.letterSpacing,
    lineHeight: computed.lineHeight,
    textAlign: computed.textAlign,
    textIndent: computed.textIndent,
    textTransform: computed.textTransform,
    direction: computed.direction,
  });

  const content = document.createElement("div");
  assignStyles(content, {
    position: "relative",
    color: "transparent",
    background: "transparent",
    transform: `translate(${-element.scrollLeft}px, ${-element.scrollTop}px)`,
    transformOrigin: "top left",
  });

  if (element.tagName === "TEXTAREA") {
    assignStyles(content, {
      width: "100%",
      minHeight: "100%",
      whiteSpace: computed.whiteSpace,
      overflowWrap: computed.overflowWrap,
      wordBreak: computed.wordBreak,
      tabSize: computed.tabSize,
    });
  } else {
    assignStyles(mirror, {
      display: "flex",
      alignItems: "center",
    });
    assignStyles(content, {
      minWidth: "100%",
      width: "max-content",
      whiteSpace: "pre",
    });
  }

  appendHighlightedValue(content, element.value, matches);
  mirror.append(content);
  return mirror;
}

export class InputValueHighlighter {
  private readonly options: InputValueHighlightingOptions | undefined;
  private host: HTMLElement | null = null;
  private passive: readonly InputValueMatch[] = [];
  private active: readonly InputValueMatch[] = [];
  private listeningWindow: Window | null = null;
  private frame: number | null = null;

  constructor(options?: InputValueHighlightingOptions) {
    this.options = options;
  }

  apply(
    passive: readonly InputValueMatch[],
    active: readonly InputValueMatch[],
  ): void {
    this.passive = passive;
    this.active = active;
    if (this.options?.mode !== "overlay") return;
    this.render();
  }

  clear(): void {
    this.passive = [];
    this.active = [];
    this.host?.remove();
    this.host = null;
    if (this.frame !== null && this.listeningWindow) {
      this.listeningWindow.cancelAnimationFrame(this.frame);
    }
    this.frame = null;
    this.stopListening();
  }

  private readonly scheduleRender = () => {
    if (!this.listeningWindow || this.frame !== null) return;
    this.frame = this.listeningWindow.requestAnimationFrame(() => {
      this.frame = null;
      this.render();
    });
  };

  private startListening(view: Window): void {
    if (this.listeningWindow === view) return;
    this.stopListening();
    this.listeningWindow = view;
    view.addEventListener("scroll", this.scheduleRender, true);
    view.addEventListener("resize", this.scheduleRender);
    view.visualViewport?.addEventListener("resize", this.scheduleRender);
    view.visualViewport?.addEventListener("scroll", this.scheduleRender);
    view.document.fonts?.addEventListener("loadingdone", this.scheduleRender);
  }

  private stopListening(): void {
    const view = this.listeningWindow;
    if (!view) return;
    view.removeEventListener("scroll", this.scheduleRender, true);
    view.removeEventListener("resize", this.scheduleRender);
    view.visualViewport?.removeEventListener("resize", this.scheduleRender);
    view.visualViewport?.removeEventListener("scroll", this.scheduleRender);
    view.document.fonts?.removeEventListener(
      "loadingdone",
      this.scheduleRender,
    );
    this.listeningWindow = null;
  }

  private render(): void {
    const first = this.active[0] ?? this.passive[0];
    if (!first) {
      this.clear();
      return;
    }

    const document = first.element.ownerDocument;
    const view = document.defaultView;
    if (!view || !document.body) return;
    this.startListening(view);

    this.host?.remove();
    const host = document.createElement("div");
    host.dataset.virtualSearchInputOverlay = "";
    host.setAttribute("aria-hidden", "true");
    assignStyles(host, {
      position: "fixed",
      inset: "0",
      width: "0",
      height: "0",
      overflow: "visible",
      pointerEvents: "none",
      zIndex: String(this.options?.zIndex ?? 2147483000),
    });

    const grouped = new Map<
      HTMLInputElement | HTMLTextAreaElement,
      PaintedInputValueMatch[]
    >();
    const add = (match: InputValueMatch, active: boolean) => {
      const matches = grouped.get(match.element) ?? [];
      matches.push({ ...match, active });
      grouped.set(match.element, matches);
    };
    this.passive.forEach(match => add(match, false));
    this.active.forEach(match => add(match, true));

    for (const [element, matches] of grouped) {
      if (!element.isConnected) continue;
      const mirror = createMirror(element, matches);
      if (mirror) host.append(mirror);
    }

    document.body.append(host);
    this.host = host;
  }
}
