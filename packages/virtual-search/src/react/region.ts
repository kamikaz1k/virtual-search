import {
  type HTMLAttributes,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import {
  ITEM_ATTRIBUTE,
  PART_ATTRIBUTE,
  REGION_ATTRIBUTE,
} from "../corpus";
import type { SearchTextPart, VirtualSearchRegion } from "../types";
import { useVirtualSearchController } from "./context";

export interface VirtualizerAdapter {
  scrollToIndex(
    index: number,
    options: { align: "center" | "start" | "end" | "auto" },
  ): void | Promise<void>;
}

interface BaseRegionOptions<Item> {
  id: string;
  anchorRef: RefObject<Element | null>;
  items: readonly Item[];
  getKey(item: Item): string;
  virtualizer: VirtualizerAdapter;
}

interface StringRegionOptions<Item> extends BaseRegionOptions<Item> {
  getText(item: Item): string;
  getSearchParts?: never;
}

interface PartsRegionOptions<Item> extends BaseRegionOptions<Item> {
  getText?: never;
  getSearchParts(item: Item): readonly SearchTextPart[];
}

export type VirtualSearchRegionOptions<Item> =
  | StringRegionOptions<Item>
  | PartsRegionOptions<Item>;

export interface VirtualSearchRegionBinding {
  regionProps: {
    [REGION_ATTRIBUTE]: string;
  };
  itemProps(key: string): HTMLAttributes<HTMLElement>;
  partProps(key: string, partId: string): HTMLAttributes<HTMLElement>;
}

function queryItem(anchor: Element, key: string): Element | null {
  const escape = (
    globalThis.CSS as { escape?: (input: string) => string } | undefined
  )?.escape;
  const escapedKey = escape
    ? escape(key)
    : key.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

  return anchor.querySelector(
    `[${ITEM_ATTRIBUTE}="${escapedKey}"]`,
  );
}

function nextFrame(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve();
      return;
    }

    requestAnimationFrame(() => resolve());
  });
}

async function waitForRenderedItem(
  anchor: Element,
  key: string,
  signal: AbortSignal,
): Promise<Element | null> {
  const mounted = queryItem(anchor, key);
  if (mounted) return mounted;

  return new Promise(resolve => {
    let settled = false;
    const finish = (element: Element | null) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      resolve(element);
    };
    const onAbort = () => finish(null);
    const observer = new MutationObserver(() => {
      const item = queryItem(anchor, key);
      if (item) finish(item);
    });
    const timeout = setTimeout(() => finish(queryItem(anchor, key)), 2_000);

    observer.observe(anchor, { childList: true, subtree: true });
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function useVirtualSearchRegion<Item>(
  options: VirtualSearchRegionOptions<Item>,
): VirtualSearchRegionBinding {
  const controller = useVirtualSearchController();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useLayoutEffect(() => {
    const region: VirtualSearchRegion = {
      id: options.id,
      anchor: () => optionsRef.current.anchorRef.current,
      getUnits: () => {
        const current = optionsRef.current;
        return current.items.map(item => ({
          key: current.getKey(item),
          parts: "getSearchParts" in current
            ? current.getSearchParts(item)
            : [{ id: "text", text: current.getText(item) }],
        }));
      },
      async reveal(occurrence, context) {
        const current = optionsRef.current;
        const index = current.items.findIndex(
          item => current.getKey(item) === occurrence.unitKey,
        );
        if (index === -1) return null;

        await current.virtualizer.scrollToIndex(index, {
          align: context.align,
        });
        if (context.signal.aborted) return null;

        const anchor = current.anchorRef.current;
        if (!anchor) return null;

        const item = await waitForRenderedItem(
          anchor,
          occurrence.unitKey,
          context.signal,
        );
        if (!item || context.signal.aborted) return null;

        await nextFrame(context.signal);
        await nextFrame(context.signal);
        return item;
      },
    };

    return controller.registerRegion(region);
  }, [controller, options.id]);

  useEffect(() => {
    void controller.invalidate(options.id);
  }, [controller, options.id, options.items]);

  return useMemo(() => ({
    regionProps: {
      [REGION_ATTRIBUTE]: options.id,
    },
    itemProps(key: string) {
      return {
        [ITEM_ATTRIBUTE]: key,
      } as HTMLAttributes<HTMLElement>;
    },
    partProps(key: string, partId: string) {
      void key;
      return {
        [PART_ATTRIBUTE]: partId,
      } as HTMLAttributes<HTMLElement>;
    },
  }), [options.id]);
}
