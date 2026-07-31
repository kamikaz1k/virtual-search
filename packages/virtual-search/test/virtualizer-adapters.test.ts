import { describe, expect, it, vi } from "vitest";
import { reactVirtuosoAdapter } from "../src/react-virtuoso";
import { reactWindowAdapter } from "../src/react-window";
import { callbackVirtualizerAdapter } from "../src/virtualizer";

describe("virtualizer adapters", () => {
  it("passes navigation through a callback adapter", async () => {
    const scrollToIndex = vi.fn();
    const adapter = callbackVirtualizerAdapter(scrollToIndex);

    await adapter.scrollToIndex(12, { align: "center" });

    expect(scrollToIndex).toHaveBeenCalledWith(12, { align: "center" });
  });

  it("supports React Window v1 list handles", () => {
    const scrollToItem = vi.fn();
    const adapter = reactWindowAdapter({ scrollToItem });

    adapter.scrollToIndex(24, { align: "end" });

    expect(scrollToItem).toHaveBeenCalledWith(24, "end");
  });

  it("supports React Window v2 refs and resolves them lazily", () => {
    const scrollToRow = vi.fn();
    const ref: { current: { scrollToRow: typeof scrollToRow } | null } = {
      current: null,
    };
    const adapter = reactWindowAdapter(ref);
    ref.current = { scrollToRow };

    adapter.scrollToIndex(36, { align: "center" });

    expect(scrollToRow).toHaveBeenCalledWith({
      index: 36,
      align: "center",
      behavior: "auto",
    });
  });

  it("supports React Virtuoso refs", () => {
    const scrollToIndex = vi.fn();
    const adapter = reactVirtuosoAdapter({
      current: { scrollToIndex },
    });

    adapter.scrollToIndex(48, { align: "start" });

    expect(scrollToIndex).toHaveBeenCalledWith({
      index: 48,
      align: "start",
      behavior: "auto",
    });
  });

  it("maps generic auto alignment to Virtuoso center alignment", () => {
    const scrollToIndex = vi.fn();
    const adapter = reactVirtuosoAdapter({ scrollToIndex });

    adapter.scrollToIndex(60, { align: "auto" });

    expect(scrollToIndex).toHaveBeenCalledWith({
      index: 60,
      align: "center",
      behavior: "auto",
    });
  });

  it("reports an actionable error for an unmounted ref", () => {
    const adapter = reactWindowAdapter({ current: null });

    expect(() => adapter.scrollToIndex(0, { align: "center" })).toThrow(
      "pass the list ref object, not ref.current",
    );
  });
});
