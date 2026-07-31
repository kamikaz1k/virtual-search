import { StrictMode, useRef } from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

function RegionRegistration({
  anchorRef,
  onController,
  scrollToIndex,
}: {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  onController(controller: VirtualSearchController): void;
  scrollToIndex(): void;
}) {
  const controller = useVirtualSearchController();
  onController(controller);
  useVirtualSearchRegion({
    id: "strict-region",
    anchorRef,
    items: [{ id: "row", text: "Needle" }],
    getKey: item => item.id,
    getText: item => item.text,
    virtualizer: { scrollToIndex },
  });
  return null;
}

function TestApp({
  onController,
  scrollToIndex,
}: {
  onController(controller: VirtualSearchController): void;
  scrollToIndex(): void;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  return (
    <VirtualSearchProvider rootRef={rootRef}>
      <RegionRegistration
        anchorRef={anchorRef}
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
});
