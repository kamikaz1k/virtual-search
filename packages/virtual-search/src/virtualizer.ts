export type VirtualizerAlignment = "center" | "start" | "end" | "auto";

export interface VirtualizerScrollOptions {
  align: VirtualizerAlignment;
}

export interface VirtualizerAdapter {
  scrollToIndex(
    index: number,
    options: VirtualizerScrollOptions,
  ): void | Promise<void>;
}

export type VirtualizerScrollCallback = (
  index: number,
  options: VirtualizerScrollOptions,
) => void | Promise<void>;

export function callbackVirtualizerAdapter(
  scrollToIndex: VirtualizerScrollCallback,
): VirtualizerAdapter {
  return { scrollToIndex };
}
