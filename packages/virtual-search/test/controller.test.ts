import { beforeEach, describe, expect, it, vi } from "vitest";
import { createVirtualSearch } from "../src/controller";
import {
  VirtualSearchRevealError,
  type VirtualSearchRegion,
} from "../src/types";

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

  it("can restart at the first match when search reopens", async () => {
    document.body.innerHTML = `
      <main id="root">
        <p>Needle one</p>
        <p>Needle two</p>
        <p>Needle three</p>
      </main>
    `;
    const root = document.querySelector("#root")!;
    const search = createVirtualSearch({
      root,
      resetActiveMatchOnOpen: true,
    });

    await search.setQuery("needle");
    await search.goTo(2);
    expect(search.getState().activeIndex).toBe(2);

    search.close();
    search.open();
    await Promise.resolve();
    await Promise.resolve();

    expect(search.getState().query).toBe("needle");
    expect(search.getState().activeIndex).toBe(0);
  });

  it("preserves the active match on reopen by default", async () => {
    document.body.innerHTML = `
      <main id="root">
        <p>Needle one</p>
        <p>Needle two</p>
      </main>
    `;
    const root = document.querySelector("#root")!;
    const search = createVirtualSearch({ root });

    await search.setQuery("needle");
    await search.goTo(1);
    search.close();
    search.open();
    await Promise.resolve();
    await Promise.resolve();

    expect(search.getState().activeIndex).toBe(1);
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

  it("calls a virtual region reveal hook when the item is already mounted", async () => {
    document.body.innerHTML = `
      <main>
        <div id="list">
          <div data-virtual-search-item="mounted">Needle</div>
        </div>
      </main>
    `;
    const root = document.querySelector("main")!;
    const anchor = document.querySelector("#list")!;
    const item = document.querySelector("[data-virtual-search-item]")!;
    const reveal = vi.fn(() => item);

    const search = createVirtualSearch({ root });
    search.registerRegion({
      id: "list",
      anchor: () => anchor,
      getUnits: () => [{
        key: "mounted",
        parts: [{ id: "text", text: "Needle" }],
      }],
      reveal,
    });

    await search.setQuery("needle");

    expect(reveal).toHaveBeenCalledOnce();
    expect(search.getState().status).toBe("ready");
  });

  it("opens closed details before highlighting a DOM match", async () => {
    document.body.innerHTML = `
      <main>
        <details>
          <summary>More</summary>
          <p>Revealable needle</p>
        </details>
      </main>
    `;
    const root = document.querySelector("main")!;
    const details = document.querySelector("details")!;
    const search = createVirtualSearch({ root });

    await search.setQuery("needle");

    expect(search.getState().matches).toHaveLength(1);
    expect(details.open).toBe(true);
    expect(search.getState().status).toBe("ready");
  });

  it("reveals hidden-until-found DOM content in native event order", async () => {
    document.body.innerHTML = `
      <main>
        <section hidden="until-found">Revealable needle</section>
      </main>
    `;
    const root = document.querySelector("main")!;
    const section = document.querySelector("section")!;
    const revealOrder: string[] = [];
    section.addEventListener("beforematch", () => {
      revealOrder.push(
        section.getAttribute("hidden") === "until-found"
          ? "event-before-removal"
          : "event-after-removal",
      );
    });
    const search = createVirtualSearch({ root });

    await search.setQuery("needle");
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(search.getState().matches).toHaveLength(1);
    expect(revealOrder).toEqual(["event-before-removal"]);
    expect(section.hasAttribute("hidden")).toBe(false);
    expect(search.getState().status).toBe("ready");
  });

  it("keeps regular hidden DOM content out of the corpus", async () => {
    document.body.innerHTML = `
      <main>
        <p hidden>Invisible needle</p>
      </main>
    `;
    const root = document.querySelector("main")!;
    const search = createVirtualSearch({ root });

    await search.setQuery("needle");

    expect(search.getState().matches).toHaveLength(0);
  });

  it("reports a typed error when a region does not reveal its match", async () => {
    document.body.innerHTML = `
      <main>
        <div id="list">
          <div data-virtual-search-item="mounted" style="display: none">
            Needle
          </div>
        </div>
      </main>
    `;
    const root = document.querySelector("main")!;
    const anchor = document.querySelector("#list")!;
    const item = document.querySelector("[data-virtual-search-item]")!;
    const search = createVirtualSearch({ root });
    search.registerRegion({
      id: "list",
      anchor: () => anchor,
      getUnits: () => [{
        key: "mounted",
        parts: [{ id: "text", text: "Needle" }],
      }],
      reveal: () => item,
    });

    await search.setQuery("needle");

    expect(search.getState().status).toBe("error");
    expect(search.getState().error).toBeInstanceOf(VirtualSearchRevealError);
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
