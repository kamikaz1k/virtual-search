import {
  type MaybeRefOrGetter,
  onScopeDispose,
  toValue,
  type Ref,
  watch,
} from "vue";
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
      anchorRef: Readonly<Ref<Element | null>>;
      getAnchor?: never;
    }
  | {
      anchorRef?: never;
      getAnchor(): Element | null;
    };

interface RegionOptions<Item> {
  id: string;
  items: MaybeRefOrGetter<readonly Item[]>;
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
  regionAttrs: Readonly<Record<string, string>>;
  itemAttrs(key: string): Readonly<Record<string, string>>;
  partAttrs(key: string, partId: string): Readonly<Record<string, string>>;
}

function anchorFor<Item>(options: VirtualSearchRegionOptions<Item>) {
  return options.getAnchor
    ? options.getAnchor()
    : options.anchorRef.value;
}

export function useVirtualSearchRegion<Item>(
  options: VirtualSearchRegionOptions<Item>,
): VirtualSearchRegionBinding {
  const controller = useVirtualSearchController();
  const region: VirtualSearchRegion = {
    id: options.id,
    anchor: () => anchorFor(options),
    getUnits: () => {
      const items = toValue(options.items);
      return items.map(item => ({
        key: options.getKey(item),
        parts: "getSearchParts" in options
          ? options.getSearchParts(item)
          : [{ id: "text", text: options.getText(item) }],
      }));
    },
    async reveal(occurrence, context) {
      const items = toValue(options.items);
      const index = items.findIndex(
        item => options.getKey(item) === occurrence.unitKey,
      );
      if (index === -1) return null;

      await options.virtualizer.scrollToIndex(index, {
        align: context.align,
      });
      if (context.signal.aborted) return null;

      const anchor = anchorFor(options);
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

  const unregister = controller.registerRegion(region);
  const stopItemsWatch = watch(
    () => toValue(options.items),
    () => void controller.invalidate(options.id),
    { flush: "post" },
  );

  onScopeDispose(() => {
    stopItemsWatch();
    unregister();
  });

  return {
    regionAttrs: { [REGION_ATTRIBUTE]: options.id },
    itemAttrs(key: string) {
      return { [ITEM_ATTRIBUTE]: key };
    },
    partAttrs(key: string, partId: string) {
      void key;
      return { [PART_ATTRIBUTE]: partId };
    },
  };
}
