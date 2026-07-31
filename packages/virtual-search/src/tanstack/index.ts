import type { Virtualizer } from "@tanstack/react-virtual";
import type { VirtualizerAdapter } from "../virtualizer";

export function tanstackVirtualAdapter<
  ScrollElement extends Element | Window,
  ItemElement extends Element,
>(
  virtualizer: Virtualizer<ScrollElement, ItemElement>,
): VirtualizerAdapter {
  return {
    scrollToIndex(index, options) {
      virtualizer.scrollToIndex(index, {
        align: options.align,
      });
    },
  };
}
