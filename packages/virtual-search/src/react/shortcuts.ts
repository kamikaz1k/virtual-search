import { useEffect } from "react";
import { useVirtualSearchController } from "./context.js";

export interface FindShortcutOptions {
  enabled?: boolean;
}

export function useFindShortcut({
  enabled = true,
}: FindShortcutOptions = {}): void {
  const controller = useVirtualSearchController();

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "Escape"
        && controller.getState().isOpen
        && event.cancelable
      ) {
        event.preventDefault();
        controller.close();
        return;
      }

      const modifier = event.metaKey || event.ctrlKey;
      if (!modifier || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "f" && event.cancelable) {
        event.preventDefault();
        controller.open();
        requestAnimationFrame(() => {
          const input = document.querySelector<HTMLInputElement>(
            "[data-virtual-search-panel] input[type='search']",
          );
          input?.focus();
          input?.select();
        });
        return;
      }

      if (key === "g" && controller.getState().isOpen && event.cancelable) {
        event.preventDefault();
        void (event.shiftKey ? controller.previous() : controller.next());
      }
    };

    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [controller, enabled]);
}
