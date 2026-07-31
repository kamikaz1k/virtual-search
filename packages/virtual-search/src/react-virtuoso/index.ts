import type {
  VirtualizerAdapter,
  VirtualizerAlignment,
} from "../virtualizer";

type VirtuosoAlignment = Exclude<VirtualizerAlignment, "auto">;

export interface ReactVirtuosoHandle {
  scrollToIndex(location: {
    index: number;
    align?: VirtuosoAlignment;
    behavior?: "auto" | "smooth";
  }): void;
}

export type ReactVirtuosoSource =
  | ReactVirtuosoHandle
  | { readonly current: ReactVirtuosoHandle | null }
  | (() => ReactVirtuosoHandle | null);

function resolveHandle(source: ReactVirtuosoSource): ReactVirtuosoHandle {
  const handle = typeof source === "function"
    ? source()
    : "current" in source
      ? source.current
      : source;

  if (!handle) {
    throw new Error(
      "React Virtuoso ref is not mounted; pass the Virtuoso ref object, not ref.current",
    );
  }

  return handle;
}

export function reactVirtuosoAdapter(
  source: ReactVirtuosoSource,
): VirtualizerAdapter {
  return {
    scrollToIndex(index, options) {
      const handle = resolveHandle(source);
      handle.scrollToIndex({
        index,
        align: options.align === "auto" ? "center" : options.align,
        behavior: "auto",
      });
    },
  };
}
