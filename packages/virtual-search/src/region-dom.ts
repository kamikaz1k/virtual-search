import { ITEM_ATTRIBUTE } from "./corpus.js";

function queryItem(anchor: Element, key: string): Element | null {
  const escape = (
    globalThis.CSS as { escape?: (input: string) => string } | undefined
  )?.escape;
  const escapedKey = escape
    ? escape(key)
    : key.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

  return anchor.querySelector(
    `[${ITEM_ATTRIBUTE}="${escapedKey}"]`,
  );
}

export function nextFrame(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve();
      return;
    }

    requestAnimationFrame(() => resolve());
  });
}

export async function waitForRenderedItem(
  anchor: Element,
  key: string,
  signal: AbortSignal,
): Promise<Element | null> {
  const mounted = queryItem(anchor, key);
  if (mounted) return mounted;

  return new Promise(resolve => {
    let settled = false;
    const finish = (element: Element | null) => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      clearTimeout(timeout);
      signal.removeEventListener("abort", onAbort);
      resolve(element);
    };
    const onAbort = () => finish(null);
    const observer = new MutationObserver(() => {
      const item = queryItem(anchor, key);
      if (item) finish(item);
    });
    const timeout = setTimeout(() => finish(queryItem(anchor, key)), 2_000);

    observer.observe(anchor, { childList: true, subtree: true });
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
