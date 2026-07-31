/// <reference lib="webworker" />

import { findOccurrences } from "../matcher";
import type { SearchDocument, SearchOccurrence } from "../types";
import type { WorkerRequest, WorkerResponse } from "./protocol";

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
let corpus: readonly SearchDocument[] = [];
const cancelled = new Set<number>();

function post(response: WorkerResponse): void {
  workerScope.postMessage(response);
}

function yieldToMessages(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

async function search(request: Extract<WorkerRequest, { type: "search" }>) {
  const matches: SearchOccurrence[] = [];
  const chunkSize = 250;
  const documents = corpus;

  for (let index = 0; index < documents.length; index += chunkSize) {
    if (cancelled.has(request.requestId)) {
      cancelled.delete(request.requestId);
      return;
    }

    matches.push(
      ...findOccurrences(
        documents.slice(index, index + chunkSize),
        request.query,
        request.options,
        () => cancelled.has(request.requestId),
      ),
    );

    await yieldToMessages();
  }

  if (!cancelled.delete(request.requestId)) {
    post({
      type: "result",
      requestId: request.requestId,
      matches,
    });
  }
}

workerScope.addEventListener("message", event => {
  const request = event.data as WorkerRequest;

  switch (request.type) {
    case "set-corpus":
      corpus = request.documents;
      break;
    case "cancel":
      cancelled.add(request.requestId);
      break;
    case "search":
      void search(request).catch((error: unknown) => {
        post({
          type: "error",
          requestId: request.requestId,
          message: error instanceof Error ? error.message : String(error),
        });
      });
      break;
    case "dispose":
      corpus = [];
      cancelled.clear();
      workerScope.close();
      break;
  }
});
