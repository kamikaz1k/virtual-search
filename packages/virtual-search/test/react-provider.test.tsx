import { StrictMode, useRef } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useVirtualSearchController,
  VirtualSearchProvider,
} from "../src/react/context";
import { useVirtualSearchRegion } from "../src/react/region";
import type { VirtualSearchController } from "../src/types";

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Range.prototype.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    right: 10,
    bottom: 10,
    left: 0,
    width: 10,
    height: 10,
    toJSON: () => ({}),
  });
});

afterEach(cleanup);

function RegionRegistration({
  anchorRef,
  anchorMode = "ref",
  onController,
  scrollToIndex,
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  anchorMode?: "ref" | "getter";
  onController(controller: VirtualSearchController): void;
  scrollToIndex(): void;
}) {
  const controller = useVirtualSearchController();
  onController(controller);
  const anchor = anchorMode === "getter"
    ? { getAnchor: () => anchorRef.current }
    : { anchorRef };
  useVirtualSearchRegion({
    id: "strict-region",
    ...anchor,
    items: [{ id: "row", text: "Needle" }],
    getKey: item => item.id,
    getText: item => item.text,
    virtualizer: { scrollToIndex },
  });
  return null;
}

function TestApp({
  anchorMode,
  onController,
  scrollToIndex,
}: {
  anchorMode?: "ref" | "getter";
  onController(controller: VirtualSearchController): void;
  scrollToIndex(): void;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  return (
    <VirtualSearchProvider rootRef={rootRef}>
      <RegionRegistration
        anchorRef={anchorRef}
        {...(anchorMode ? { anchorMode } : {})}
        onController={onController}
        scrollToIndex={scrollToIndex}
      />
      <main ref={rootRef}>
        <div ref={anchorRef} />
      </main>
    </VirtualSearchProvider>
  );
}

describe("VirtualSearchProvider", () => {
  it("does not dispose the controller during Strict Mode effect replay", async () => {
    let controller: VirtualSearchController | undefined;
    const scrollToIndex = vi.fn(() => {
      const anchor = document.querySelector("main > div");
      if (!anchor) return;
      const item = document.createElement("div");
      item.dataset.virtualSearchItem = "row";
      item.textContent = "Needle";
      anchor.append(item);
    });

    render(
      <StrictMode>
        <TestApp
          onController={value => {
            controller = value;
          }}
          scrollToIndex={scrollToIndex}
        />
      </StrictMode>,
    );

    await act(async () => {
      await controller?.setQuery("needle");
    });

    expect(scrollToIndex).toHaveBeenCalledOnce();
    expect(controller?.getState().status).toBe("ready");
  });

  it("supports a lazy anchor getter", async () => {
    let controller: VirtualSearchController | undefined;
    const scrollToIndex = vi.fn(() => {
      const anchor = document.querySelector("main > div");
      if (!anchor) return;
      const item = document.createElement("div");
      item.dataset.virtualSearchItem = "row";
      item.textContent = "Needle";
      anchor.append(item);
    });

    render(
      <TestApp
        anchorMode="getter"
        onController={value => {
          controller = value;
        }}
        scrollToIndex={scrollToIndex}
      />,
    );

    await act(async () => {
      await controller?.setQuery("needle");
    });

    expect(scrollToIndex).toHaveBeenCalledOnce();
    expect(controller?.getState().matches).toHaveLength(1);
  });
});
