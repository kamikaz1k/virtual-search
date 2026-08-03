import {
  inject,
  type InjectionKey,
  onScopeDispose,
  provide,
  readonly,
  shallowReactive,
  toValue,
  type MaybeRefOrGetter,
} from "vue";
import { createVirtualSearch } from "../controller.js";
import type {
  SearchState,
  VirtualSearchController,
  VirtualSearchOptions,
} from "../types.js";

export interface ProvideVirtualSearchOptions extends Omit<
  VirtualSearchOptions,
  "root"
> {
  root: MaybeRefOrGetter<Element | null>;
}

export interface VirtualSearchValue extends Readonly<SearchState> {
  readonly open: () => void;
  readonly close: () => void;
  readonly setQuery: (query: string) => Promise<void>;
  readonly next: () => Promise<void>;
  readonly previous: () => Promise<void>;
  readonly goTo: (index: number) => Promise<void>;
}

interface VirtualSearchInjection {
  controller: VirtualSearchController;
  search: VirtualSearchValue;
}

const virtualSearchKey = Symbol("VirtualSearch") as InjectionKey<
  VirtualSearchInjection
>;

export function provideVirtualSearch(
  options: ProvideVirtualSearchOptions,
): VirtualSearchValue {
  const controller = createVirtualSearch({
    ...options,
    root: () => toValue(options.root),
  });
  const mutable = shallowReactive({
    ...controller.getState(),
    open: controller.open,
    close: controller.close,
    setQuery: controller.setQuery,
    next: controller.next,
    previous: controller.previous,
    goTo: controller.goTo,
  });
  const search = readonly(mutable) as VirtualSearchValue;
  const unsubscribe = controller.subscribe(state => {
    Object.assign(mutable, state);
  });

  provide(virtualSearchKey, { controller, search });
  onScopeDispose(() => {
    unsubscribe();
    controller.dispose();
  });

  return search;
}

function useVirtualSearchInjection(): VirtualSearchInjection {
  const value = inject(virtualSearchKey);
  if (!value) {
    throw new Error(
      "Virtual Search composables must be used below provideVirtualSearch()",
    );
  }
  return value;
}

export function useVirtualSearchController(): VirtualSearchController {
  return useVirtualSearchInjection().controller;
}

export function useVirtualSearch(): VirtualSearchValue {
  return useVirtualSearchInjection().search;
}
