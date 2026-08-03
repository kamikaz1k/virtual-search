import type {
  SearchDocument,
  SearchExecutor,
  SearchOccurrence,
} from "../types.js";
import type { WorkerRequest, WorkerResponse } from "./protocol.js";

export interface WorkerSearchExecutorOptions {
  worker: Worker;
}

interface PendingSearch {
  resolve(matches: readonly SearchOccurrence[]): void;
  reject(error: Error): void;
  removeAbortListener(): void;
}

function serializableDocuments(
  documents: readonly SearchDocument[],
): SearchDocument[] {
  return documents.map(document => ({
    regionId: document.regionId,
    unitKey: document.unitKey,
    unitOrder: document.unitOrder,
    documentOrder: document.documentOrder,
    parts: document.parts.map(part => ({
      id: part.id,
      text: part.text,
    })),
  }));
}

function corpusChanged(
  previous: readonly SearchDocument[],
  next: readonly SearchDocument[],
): boolean {
  if (previous.length !== next.length) return true;

  return next.some((document, index) => {
    const oldDocument = previous[index];
    if (!oldDocument) return true;
    if (
      oldDocument.regionId !== document.regionId
      || oldDocument.unitKey !== document.unitKey
      || oldDocument.unitOrder !== document.unitOrder
      || oldDocument.documentOrder !== document.documentOrder
      || oldDocument.parts.length !== document.parts.length
    ) {
      return true;
    }

    return document.parts.some((part, partIndex) => {
      const oldPart = oldDocument.parts[partIndex];
      return !oldPart || oldPart.id !== part.id || oldPart.text !== part.text;
    });
  });
}

export function createWorkerExecutor({
  worker,
}: WorkerSearchExecutorOptions): SearchExecutor {
  const pending = new Map<number, PendingSearch>();
  let requestId = 0;
  let corpus: readonly SearchDocument[] = [];
  let disposed = false;

  const onMessage = (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    const request = pending.get(response.requestId);
    if (!request) return;

    pending.delete(response.requestId);
    request.removeAbortListener();

    if (response.type === "error") {
      request.reject(new Error(response.message));
    } else {
      request.resolve(response.matches);
    }
  };

  worker.addEventListener("message", onMessage);

  return {
    search(documents, query, options, signal) {
      if (disposed || signal.aborted) return Promise.resolve([]);

      if (corpusChanged(corpus, documents)) {
        corpus = serializableDocuments(documents);
        worker.postMessage({
          type: "set-corpus",
          documents: corpus,
        } satisfies WorkerRequest);
      }

      requestId += 1;
      const currentRequestId = requestId;

      return new Promise((resolve, reject) => {
        const onAbort = () => {
          worker.postMessage({
            type: "cancel",
            requestId: currentRequestId,
          } satisfies WorkerRequest);
          pending.delete(currentRequestId);
          resolve([]);
        };

        pending.set(currentRequestId, {
          resolve,
          reject,
          removeAbortListener: () =>
            signal.removeEventListener("abort", onAbort),
        });

        signal.addEventListener("abort", onAbort, { once: true });
        worker.postMessage({
          type: "search",
          requestId: currentRequestId,
          query,
          options,
        } satisfies WorkerRequest);
      });
    },
    dispose() {
      disposed = true;
      worker.removeEventListener("message", onMessage);
      worker.postMessage({ type: "dispose" } satisfies WorkerRequest);
      worker.terminate();
      for (const request of pending.values()) {
        request.removeAbortListener();
        request.resolve([]);
      }
      pending.clear();
      corpus = [];
    },
  };
}
