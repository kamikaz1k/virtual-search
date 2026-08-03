import { findOccurrences } from "../matcher.js";
import type { SearchExecutor } from "../types.js";

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
