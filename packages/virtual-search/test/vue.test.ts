import {
  createApp,
  defineComponent,
  h,
  nextTick,
  ref,
  type App,
} from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  provideVirtualSearch,
  SearchPanel,
  useFindShortcut,
  useVirtualSearchRegion,
  type VirtualSearchValue,
} from "../src/vue";

const mountedApps: App[] = [];
const mountedHosts: HTMLElement[] = [];

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

afterEach(() => {
  mountedApps.splice(0).forEach(app => app.unmount());
  mountedHosts.splice(0).forEach(host => host.remove());
});

function mount(component: ReturnType<typeof defineComponent>) {
  const host = document.createElement("div");
  document.body.append(host);
  const app = createApp(component);
  app.mount(host);
  mountedApps.push(app);
  mountedHosts.push(host);
  return host;
}

describe("Vue integration", () => {
  it("provides reactive search state for ordinary DOM", async () => {
    let search: VirtualSearchValue | undefined;
    mount(defineComponent({
      setup() {
        const root = ref<HTMLElement | null>(null);
        search = provideVirtualSearch({ root });
        return () => h("main", { ref: root }, "Needle in ordinary DOM");
      },
    }));

    await search?.setQuery("needle");

    expect(search?.matches).toHaveLength(1);
    expect(search?.activeIndex).toBe(0);
    expect(search?.status).toBe("ready");
  });

  it("opens and focuses the built-in panel through Cmd/Ctrl+F", async () => {
    let search: VirtualSearchValue | undefined;
    const host = mount(defineComponent({
      setup() {
        const root = ref<HTMLElement | null>(null);
        search = provideVirtualSearch({ root });
        useFindShortcut({ search });
        return () => h("div", [
          h(SearchPanel),
          h("main", { ref: root }, "Searchable"),
        ]);
      },
    }));

    document.dispatchEvent(new KeyboardEvent("keydown", {
      key: "f",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    }));
    await nextTick();
    await new Promise(resolve => requestAnimationFrame(resolve));

    const input = host.querySelector<HTMLInputElement>("input[type='search']");
    expect(search?.isOpen).toBe(true);
    expect(input).toBe(document.activeElement);
  });

  it("reveals and locates an unmounted virtual record", async () => {
    let search: VirtualSearchValue | undefined;
    const scrollToIndex = vi.fn();

    const Region = defineComponent({
      setup() {
        const anchor = ref<Element | null>(null);
        const items = ref([{ id: "row", text: "Virtual Needle" }]);
        const binding = useVirtualSearchRegion({
          id: "vue-region",
          anchorRef: anchor,
          items,
          getKey: item => item.id,
          getText: item => item.text,
          virtualizer: {
            scrollToIndex(index, options) {
              scrollToIndex(index, options);
              const item = document.createElement("div");
              for (const [name, value] of Object.entries(
                binding.itemAttrs("row"),
              )) {
                item.setAttribute(name, value);
              }
              item.textContent = "Virtual Needle";
              anchor.value?.append(item);
            },
          },
        });
        return () => h("div", { ref: anchor, ...binding.regionAttrs });
      },
    });

    mount(defineComponent({
      setup() {
        const root = ref<HTMLElement | null>(null);
        search = provideVirtualSearch({ root });
        return () => h("main", { ref: root }, [h(Region)]);
      },
    }));

    await search?.setQuery("needle");

    expect(scrollToIndex).toHaveBeenCalledWith(0, { align: "center" });
    expect(search?.matches).toHaveLength(1);
    expect(search?.status).toBe("ready");
  });
});
