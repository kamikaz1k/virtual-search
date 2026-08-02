import {
  type MaybeRefOrGetter,
  onMounted,
  onUnmounted,
  toValue,
} from "vue";
import {
  useVirtualSearch,
  type VirtualSearchValue,
} from "./context";

export interface FindShortcutOptions {
  enabled?: MaybeRefOrGetter<boolean>;
  /** Pass the value returned by provideVirtualSearch() in the same setup. */
  search?: VirtualSearchValue;
}

export function useFindShortcut(options: FindShortcutOptions = {}): void {
  const { enabled = true } = options;
  const search = options.search ?? useVirtualSearch();

  const onKeyDown = (event: KeyboardEvent) => {
    if (!toValue(enabled)) return;

    if (
      event.key === "Escape"
      && search.isOpen
      && event.cancelable
    ) {
      event.preventDefault();
      search.close();
      return;
    }

    const modifier = event.metaKey || event.ctrlKey;
    if (!modifier || event.altKey) return;

    const key = event.key.toLowerCase();
    if (key === "f" && event.cancelable) {
      event.preventDefault();
      search.open();
      requestAnimationFrame(() => {
        const input = document.querySelector<HTMLInputElement>(
          "[data-virtual-search-panel] input[type='search']",
        );
        input?.focus();
        input?.select();
      });
      return;
    }

    if (key === "g" && search.isOpen && event.cancelable) {
      event.preventDefault();
      void (event.shiftKey ? search.previous() : search.next());
    }
  };

  onMounted(() => {
    document.addEventListener("keydown", onKeyDown, { capture: true });
  });
  onUnmounted(() => {
    document.removeEventListener("keydown", onKeyDown, { capture: true });
  });
}
