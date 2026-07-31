import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVirtualSearch } from "../src/controller";
import type { VirtualSearchRegion } from "../src/types";

beforeEach(() => {
  document.body.innerHTML = "";
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

describe("createVirtualSearch", () => {
  it("merges static DOM and multiple virtual regions in document order", async () => {
    document.body.innerHTML = `
      <main id="root">
        <p>Alice in static content</p>
        <div id="customers"></div>
        <p>Between Alice</p>
        <div id="orders"></div>
      </main>
    `;

    const root = document.querySelector("#root")!;
    const customersAnchor = document.querySelector("#customers")!;
    const ordersAnchor = document.querySelector("#orders")!;

    const region = (
      id: string,
      anchor: Element,
      keys: string[],
    ): VirtualSearchRegion => ({
      id,
      anchor: () => anchor,
      getUnits: () => keys.map(key => ({
        key,
        parts: [{ id: "text", text: `${key} Alice` }],
      })),
      async reveal(match) {
        const item = document.createElement("div");
        item.dataset.virtualSearchItem = match.unitKey;
        item.textContent = `${match.unitKey} Alice`;
        anchor.replaceChildren(item);
        return item;
      },
    });

    const search = createVirtualSearch({ root });
    search.registerRegion(region("customers", customersAnchor, ["C1", "C2"]));
    search.registerRegion(region("orders", ordersAnchor, ["O1"]));

    await search.setQuery("alice");

    expect(search.getState().matches.map(match => [
      match.regionId,
      match.unitKey,
    ])).toEqual([
      ["__dom__", "0"],
      ["customers", "C1"],
      ["customers", "C2"],
      ["__dom__", "1"],
      ["orders", "O1"],
    ]);
    expect(search.getState().activeIndex).toBe(0);

    await search.previous();
    expect(search.getState().activeIndex).toBe(4);

    await search.next();
    expect(search.getState().activeIndex).toBe(0);
  });

  it("reveals an unmounted virtual item before locating it", async () => {
    document.body.innerHTML = `<main><div id="list"></div></main>`;
    const root = document.querySelector("main")!;
    const anchor = document.querySelector("#list")!;
    const reveal = vi.fn(async match => {
      const item = document.createElement("div");
      item.dataset.virtualSearchItem = match.unitKey;
      item.textContent = "Needle";
      anchor.append(item);
      return item;
    });

    const search = createVirtualSearch({ root });
    search.registerRegion({
      id: "list",
      anchor: () => anchor,
      getUnits: () => [{
        key: "unmounted",
        parts: [{ id: "text", text: "Needle" }],
      }],
      reveal,
    });

    await search.setQuery("needle");

    expect(search.getState().matches).toHaveLength(1);
    expect(reveal).toHaveBeenCalledOnce();
    expect(search.getState().status).toBe("ready");
  });

  it("ignores results from stale asynchronous queries", async () => {
    document.body.innerHTML = `<main><div id="list"></div></main>`;
    const root = document.querySelector("main")!;
    const anchor = document.querySelector("#list")!;
    let releaseFirst!: () => void;

    const search = createVirtualSearch({ root });
    search.registerRegion({
      id: "list",
      anchor: () => anchor,
      async getUnits(signal) {
        if (!signal.aborted) {
          await new Promise<void>(resolve => {
            releaseFirst ??= resolve;
            setTimeout(resolve, 50);
          });
        }
        return [{
          key: "row",
          parts: [{ id: "text", text: "first second" }],
        }];
      },
      reveal: () => null,
    });

    const first = search.setQuery("first");
    const second = search.setQuery("second");
    releaseFirst();
    await Promise.all([first, second]);

    expect(search.getState().query).toBe("second");
    expect(search.getState().matches).toHaveLength(1);
  });

  it("refreshes an active query after static DOM content changes", async () => {
    document.body.innerHTML = `<main><p>Before</p></main>`;
    const root = document.querySelector("main")!;
    const paragraph = document.querySelector("p")!;
    const search = createVirtualSearch({ root });

    await search.setQuery("needle");
    expect(search.getState().matches).toHaveLength(0);

    paragraph.textContent = "A new needle";
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(search.getState().matches).toHaveLength(1);
  });
});
