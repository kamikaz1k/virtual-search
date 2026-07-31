import {
  createContext,
  type PropsWithChildren,
  type RefObject,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import { createVirtualSearch } from "../controller";
import type {
  SearchState,
  VirtualSearchController,
  VirtualSearchOptions,
} from "../types";

const VirtualSearchContext = createContext<VirtualSearchController | null>(null);

export interface VirtualSearchProviderProps extends PropsWithChildren {
  rootRef: RefObject<Element | null>;
  executor?: VirtualSearchOptions["executor"];
  resetActiveMatchOnOpen?: boolean;
  searchOptions?: VirtualSearchOptions["searchOptions"];
  scrollMargin?: number;
}

export function VirtualSearchProvider({
  children,
  rootRef,
  executor,
  resetActiveMatchOnOpen,
  searchOptions,
  scrollMargin,
}: VirtualSearchProviderProps) {
  const controllerRef = useRef<VirtualSearchController | null>(null);
  const lifecycleRef = useRef(0);

  if (!controllerRef.current) {
    controllerRef.current = createVirtualSearch({
      root: () => rootRef.current,
      ...(executor ? { executor } : {}),
      ...(resetActiveMatchOnOpen === undefined
        ? {}
        : { resetActiveMatchOnOpen }),
      ...(searchOptions ? { searchOptions } : {}),
      ...(scrollMargin === undefined ? {} : { scrollMargin }),
    });
  }

  useEffect(() => {
    const controller = controllerRef.current;
    lifecycleRef.current += 1;
    const lifecycle = lifecycleRef.current;

    return () => {
      queueMicrotask(() => {
        if (lifecycleRef.current === lifecycle) controller?.dispose();
      });
    };
  }, []);

  return (
    <VirtualSearchContext.Provider value={controllerRef.current}>
      {children}
    </VirtualSearchContext.Provider>
  );
}

export function useVirtualSearchController(): VirtualSearchController {
  const controller = useContext(VirtualSearchContext);
  if (!controller) {
    throw new Error(
      "Virtual Search hooks must be used inside VirtualSearchProvider",
    );
  }
  return controller;
}

export interface VirtualSearchValue extends SearchState {
  open(): void;
  close(): void;
  setQuery(query: string): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  goTo(index: number): Promise<void>;
}

export function useVirtualSearch(): VirtualSearchValue {
  const controller = useVirtualSearchController();
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState,
  );

  return {
    ...state,
    open: controller.open,
    close: controller.close,
    setQuery: controller.setQuery,
    next: controller.next,
    previous: controller.previous,
    goTo: controller.goTo,
  };
}
