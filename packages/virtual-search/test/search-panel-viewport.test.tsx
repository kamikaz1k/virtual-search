import { useRef } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useVirtualSearchController,
  VirtualSearchProvider,
} from "../src/react/context";
import { SearchPanel } from "../src/react/search-panel";
import type { SearchPanelViewportAnchor } from "../src/react/search-panel-viewport";
import type { VirtualSearchController } from "../src/types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, "visualViewport");
  document.querySelector("[data-viewport-test-style]")?.remove();
});

function PanelTestApp({
  onController,
  viewportAnchor,
}: {
  onController(controller: VirtualSearchController): void;
  viewportAnchor?: SearchPanelViewportAnchor;
}) {
  const controller = useVirtualSearchController();
  onController(controller);

  return (
    <SearchPanel
      className="fixed-panel"
      {...(viewportAnchor === undefined ? {} : { viewportAnchor })}
    />
  );
}

function TestProvider({
  onController,
  viewportAnchor,
}: {
  onController(controller: VirtualSearchController): void;
  viewportAnchor?: SearchPanelViewportAnchor;
}) {
  const rootRef = useRef<HTMLElement>(null);

  return (
    <VirtualSearchProvider rootRef={rootRef}>
      <PanelTestApp
        onController={onController}
        {...(viewportAnchor === undefined ? {} : { viewportAnchor })}
      />
      <main ref={rootRef} />
    </VirtualSearchProvider>
  );
}

describe("SearchPanel visual viewport behavior", () => {
  it("does not translate a top-anchored panel during document scrolling", async () => {
    const viewport = Object.assign(new EventTarget(), {
      height: 300,
      offsetLeft: 0,
      offsetTop: 100,
      width: 320,
    });
    Object.defineProperty(globalThis, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    const style = document.createElement("style");
    style.dataset.viewportTestStyle = "";
    style.textContent = ".fixed-panel { position: fixed; }";
    document.head.append(style);

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 10,
      y: 10,
      top: 10,
      right: 310,
      bottom: 130,
      left: 10,
      width: 300,
      height: 120,
      toJSON: () => ({}),
    });

    let controller: VirtualSearchController | undefined;
    const rendered = render(
      <TestProvider
        onController={value => {
          controller = value;
        }}
      />,
    );

    await act(async () => {
      controller?.open();
    });

    const panel = rendered.getByRole("search");
    expect(panel.style.getPropertyValue("--virtual-search-viewport-top"))
      .toBe("100px");
    expect(panel.style.getPropertyValue("--virtual-search-viewport-height"))
      .toBe("300px");
    expect(panel.style.top).toBe("max(8px, env(safe-area-inset-top))");
    expect(panel.style.bottom).toBe("auto");
    expect(panel.style.translate).toBe("");

    viewport.offsetTop = 240;
    act(() => globalThis.dispatchEvent(new Event("scroll")));

    await new Promise(resolve => requestAnimationFrame(resolve));
    expect(panel.style.translate).toBe("");
  });

  it("rechecks the panel position when the document scrolls", async () => {
    const viewport = Object.assign(new EventTarget(), {
      height: 300,
      offsetLeft: 0,
      offsetTop: 100,
      width: 320,
    });
    Object.defineProperty(globalThis, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    const style = document.createElement("style");
    style.dataset.viewportTestStyle = "";
    style.textContent = ".fixed-panel { position: fixed; }";
    document.head.append(style);

    let panelTop = 10;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(() => ({
        x: 10,
        y: panelTop,
        top: panelTop,
        right: 310,
        bottom: panelTop + 120,
        left: 10,
        width: 300,
        height: 120,
        toJSON: () => ({}),
      }));

    let controller: VirtualSearchController | undefined;
    const rendered = render(
      <TestProvider
        onController={value => {
          controller = value;
        }}
        viewportAnchor="preserve"
      />,
    );

    await act(async () => {
      controller?.open();
    });

    const panel = rendered.getByRole("search");
    expect(panel.style.translate).toBe("0px 98px");

    panelTop = 350;
    act(() => globalThis.dispatchEvent(new Event("scroll")));

    await waitFor(() => expect(panel.style.translate).toBe("0px -78px"));
  });
});
