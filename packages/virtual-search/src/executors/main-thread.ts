import { findOccurrences } from "../matcher";
import type { SearchExecutor } from "../types";

export function createMainThreadExecutor(): SearchExecutor {
  return {
    async search(documents, query, options, signal) {
      if (signal.aborted) return [];

      await Promise.resolve();

      return findOccurrences(
        documents,
        query,
        options,
        () => signal.aborted,
      );
    },
  };
}
