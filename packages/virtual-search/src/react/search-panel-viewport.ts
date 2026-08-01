import { type RefObject, useEffect } from "react";

export interface SearchPanelViewportOptions {
  anchor?: SearchPanelViewportAnchor;
  enabled?: boolean;
  padding?: number;
}

export type SearchPanelViewportAnchor = "preserve" | "top";

const VIEWPORT_SETTLE_MS = 500;

const managedProperties = [
  "translate",
  "max-width",
  "max-height",
  "overflow",
  "overscroll-behavior",
  "top",
  "bottom",
] as const;

const viewportProperties = [
  "--virtual-search-viewport-top",
  "--virtual-search-viewport-left",
  "--virtual-search-viewport-width",
  "--virtual-search-viewport-height",
] as const;

interface InlineProperty {
  name: string;
  value: string;
  priority: string;
}

function captureProperties(
  style: CSSStyleDeclaration,
  names: readonly string[],
): InlineProperty[] {
  return names.map(name => ({
    name,
    value: style.getPropertyValue(name),
    priority: style.getPropertyPriority(name),
  }));
}

function restoreProperties(
  style: CSSStyleDeclaration,
  properties: readonly InlineProperty[],
) {
  for (const property of properties) {
    if (property.value) {
      style.setProperty(property.name, property.value, property.priority);
    } else {
      style.removeProperty(property.name);
    }
  }
}

export function useSearchPanelViewport<ElementType extends HTMLElement>(
  panelRef: RefObject<ElementType | null>,
  {
    anchor = "preserve",
    enabled = true,
    padding = 8,
  }: SearchPanelViewportOptions = {},
): void {
  useEffect(() => {
    const panel = panelRef.current;
    const viewport = globalThis.visualViewport;
    if (!enabled || !panel || !viewport) return;

    const style = panel.style;
    const originalManaged = captureProperties(style, managedProperties);
    const originalViewport = captureProperties(style, viewportProperties);
    const inset = Math.max(0, padding);
    let frame = 0;
    let settleUntil = 0;

    const sync = () => {
      frame = 0;
      restoreProperties(style, originalManaged);

      style.setProperty(
        "--virtual-search-viewport-top",
        `${viewport.offsetTop}px`,
      );
      style.setProperty(
        "--virtual-search-viewport-left",
        `${viewport.offsetLeft}px`,
      );
      style.setProperty(
        "--virtual-search-viewport-width",
        `${viewport.width}px`,
      );
      style.setProperty(
        "--virtual-search-viewport-height",
        `${viewport.height}px`,
      );

      if (anchor === "top") {
        style.top = `max(calc(var(--virtual-search-viewport-top) + ${inset}px), env(safe-area-inset-top))`;
        style.bottom = "auto";
      }

      if (getComputedStyle(panel).position !== "fixed") return;

      const availableWidth = Math.max(0, viewport.width - inset * 2);
      const availableHeight = Math.max(0, viewport.height - inset * 2);
      let rect = panel.getBoundingClientRect();

      if (rect.width > availableWidth) {
        style.maxWidth = `${availableWidth}px`;
        style.overflow = "auto";
        style.overscrollBehavior = "contain";
      }
      if (rect.height > availableHeight) {
        style.maxHeight = `${availableHeight}px`;
        style.overflow = "auto";
        style.overscrollBehavior = "contain";
      }

      rect = panel.getBoundingClientRect();
      const minLeft = viewport.offsetLeft + inset;
      const maxRight = viewport.offsetLeft + viewport.width - inset;
      let x = 0;
      let y = 0;

      if (rect.left < minLeft) x = minLeft - rect.left;
      if (rect.right + x > maxRight) x += maxRight - (rect.right + x);

      if (anchor === "preserve") {
        const minTop = viewport.offsetTop + inset;
        const maxBottom = viewport.offsetTop + viewport.height - inset;
        if (rect.top < minTop) y = minTop - rect.top;
        if (rect.bottom + y > maxBottom) {
          y += maxBottom - (rect.bottom + y);
        }
      }

      if (x !== 0 || y !== 0) {
        style.translate = `${x}px ${y}px`;
      }

      if (performance.now() < settleUntil) {
        frame = requestAnimationFrame(sync);
      }
    };

    const scheduleSync = () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };

    const scheduleSettledSync = () => {
      settleUntil = performance.now() + VIEWPORT_SETTLE_MS;
      scheduleSync();
    };

    sync();
    viewport.addEventListener("resize", scheduleSettledSync);
    viewport.addEventListener("scroll", scheduleSettledSync);
    viewport.addEventListener("scrollend", scheduleSync);
    globalThis.addEventListener("scroll", scheduleSettledSync, {
      passive: true,
    });
    panel.addEventListener("focusin", scheduleSettledSync);
    panel.addEventListener("focusout", scheduleSettledSync);
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(scheduleSettledSync);
    resizeObserver?.observe(panel);

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", scheduleSettledSync);
      viewport.removeEventListener("scroll", scheduleSettledSync);
      viewport.removeEventListener("scrollend", scheduleSync);
      globalThis.removeEventListener("scroll", scheduleSettledSync);
      panel.removeEventListener("focusin", scheduleSettledSync);
      panel.removeEventListener("focusout", scheduleSettledSync);
      resizeObserver?.disconnect();
      restoreProperties(style, originalManaged);
      restoreProperties(style, originalViewport);
    };
  }, [anchor, enabled, padding, panelRef]);
}
