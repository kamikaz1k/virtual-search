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
import { nextFrame, waitForRenderedItem } from "../region-dom";
import type { SearchTextPart, VirtualSearchRegion } from "../types";
import type { VirtualizerAdapter } from "../virtualizer";
import { useVirtualSearchController } from "./context";

type RegionAnchor =
  | {
      anchorRef: RefObject<Element | null>;
      getAnchor?: never;
    }
  | {
      anchorRef?: never;
      getAnchor(): Element | null;
    };

interface RegionOptions<Item> {
  id: string;
  items: readonly Item[];
  getKey(item: Item): string;
  virtualizer: VirtualizerAdapter;
}

type BaseRegionOptions<Item> = RegionOptions<Item> & RegionAnchor;

type StringRegionOptions<Item> = BaseRegionOptions<Item> & {
  getText(item: Item): string;
  getSearchParts?: never;
};

type PartsRegionOptions<Item> = BaseRegionOptions<Item> & {
  getText?: never;
  getSearchParts(item: Item): readonly SearchTextPart[];
};

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

function anchorFor<Item>(options: VirtualSearchRegionOptions<Item>) {
  return options.getAnchor
    ? options.getAnchor()
    : options.anchorRef.current;
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
      anchor: () => anchorFor(optionsRef.current),
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

        const anchor = anchorFor(current);
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
