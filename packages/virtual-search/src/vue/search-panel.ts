import {
  defineComponent,
  h,
  nextTick,
  type PropType,
  shallowRef,
  watch,
} from "vue";
import { useVirtualSearch } from "./context.js";
import {
  type SearchPanelViewportAnchor,
  useSearchPanelViewport,
} from "./search-panel-viewport.js";

export const SearchPanel = defineComponent({
  name: "VirtualSearchPanel",
  props: {
    keepInVisualViewport: {
      type: Boolean,
      default: true,
    },
    placeholder: {
      type: String,
      default: "Find on page",
    },
    viewportAnchor: {
      type: String as PropType<SearchPanelViewportAnchor>,
      default: "top",
    },
    viewportPadding: {
      type: Number,
      default: 8,
    },
  },
  setup(props, { attrs }) {
    const search = useVirtualSearch();
    const panelRef = shallowRef<HTMLFormElement | null>(null);
    const inputRef = shallowRef<HTMLInputElement | null>(null);

    useSearchPanelViewport(panelRef, {
      anchor: () => props.viewportAnchor,
      enabled: () => search.isOpen && props.keepInVisualViewport,
      padding: () => props.viewportPadding,
    });

    watch(
      () => search.isOpen,
      async isOpen => {
        if (!isOpen) return;
        await nextTick();
        inputRef.value?.focus();
        inputRef.value?.select();
      },
      { flush: "post" },
    );

    return () => {
      if (!search.isOpen) return null;

      const activeMatch = search.matches[search.activeIndex];
      const resultLabel = search.query.length === 0
        ? "Enter a search term"
        : search.status === "searching"
          ? "Searching…"
          : search.matches.length === 0
            ? "No results"
            : `${search.activeIndex + 1} of ${search.matches.length}`;

      return h("form", {
        ...attrs,
        ref: panelRef,
        role: "search",
        "data-virtual-search-panel": "",
        "data-search-status": search.status,
        "data-active-region": activeMatch?.regionId,
        "data-active-unit": activeMatch?.unitKey,
        "aria-busy": search.status === "searching",
        onSubmit: (event: Event) => {
          event.preventDefault();
          void search.next();
        },
      }, [
        h("label", [
          h("span", { class: "virtual-search-visually-hidden" }, props.placeholder),
          h("input", {
            ref: inputRef,
            type: "search",
            inputmode: "search",
            value: search.query,
            placeholder: props.placeholder,
            "aria-label": props.placeholder,
            onInput: (event: Event) => {
              if (event.target instanceof HTMLInputElement) {
                void search.setQuery(event.target.value);
              }
            },
            onKeydown: (event: KeyboardEvent) => {
              if (event.defaultPrevented) return;
              if (event.key === "Escape") {
                event.preventDefault();
                search.close();
              } else if (event.key === "Enter" && event.shiftKey) {
                event.preventDefault();
                void search.previous();
              }
            },
          }),
        ]),
        h("output", { "aria-live": "polite", "aria-atomic": "true" }, resultLabel),
        h("button", {
          type: "button",
          disabled: search.matches.length === 0,
          "aria-label": "Previous result",
          onClick: () => void search.previous(),
        }, "↑"),
        h("button", {
          type: "button",
          disabled: search.matches.length === 0,
          "aria-label": "Next result",
          onClick: () => void search.next(),
        }, "↓"),
        h("button", {
          type: "button",
          "aria-label": "Close search",
          onClick: search.close,
        }, "×"),
      ]);
    };
  },
});
