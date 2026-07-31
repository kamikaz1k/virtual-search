import type {
  VirtualizerAdapter,
  VirtualizerAlignment,
} from "../virtualizer";

export interface ReactWindowV1ListHandle {
  scrollToItem(index: number, align?: VirtualizerAlignment | "smart"): void;
}

export interface ReactWindowV2ListHandle {
  scrollToRow(options: {
    index: number;
    align?: VirtualizerAlignment | "smart";
    behavior?: "auto" | "instant" | "smooth";
  }): void;
}

export type ReactWindowListHandle =
  | ReactWindowV1ListHandle
  | ReactWindowV2ListHandle;

export type ReactWindowListSource =
  | ReactWindowListHandle
  | { readonly current: ReactWindowListHandle | null }
  | (() => ReactWindowListHandle | null);

function resolveHandle(source: ReactWindowListSource): ReactWindowListHandle {
  const handle = typeof source === "function"
    ? source()
    : "current" in source
      ? source.current
      : source;

  if (!handle) {
    throw new Error(
      "React Window list ref is not mounted; pass the list ref object, not ref.current",
    );
  }

  return handle;
}

export function reactWindowAdapter(
  source: ReactWindowListSource,
): VirtualizerAdapter {
  return {
    scrollToIndex(index, options) {
      const handle = resolveHandle(source);

      if ("scrollToRow" in handle) {
        handle.scrollToRow({
          index,
          align: options.align,
          behavior: "auto",
        });
      } else {
        handle.scrollToItem(index, options.align);
      }
    },
  };
}
