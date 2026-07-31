import { describe, expect, it } from "vitest";
import { createWorkerExecutor } from "../src/worker";
import type {
  SearchDocument,
  SearchOccurrence,
} from "../src/types";
import type {
  WorkerRequest,
  WorkerResponse,
} from "../src/worker/protocol";

class FakeWorker {
  readonly messages: WorkerRequest[] = [];
  readonly listeners = new Set<(event: MessageEvent<WorkerResponse>) => void>();
  terminated = false;

  postMessage(message: WorkerRequest) {
    this.messages.push(message);
  }

  addEventListener(
    type: string,
    listener: (event: MessageEvent<WorkerResponse>) => void,
  ) {
    if (type === "message") this.listeners.add(listener);
  }

  removeEventListener(
    type: string,
    listener: (event: MessageEvent<WorkerResponse>) => void,
  ) {
    if (type === "message") this.listeners.delete(listener);
  }

  terminate() {
    this.terminated = true;
  }

  respond(response: WorkerResponse) {
    const event = { data: response } as MessageEvent<WorkerResponse>;
    this.listeners.forEach(listener => listener(event));
  }
}

const documents: SearchDocument[] = [{
  regionId: "customers",
  unitKey: "1",
  unitOrder: 0,
  documentOrder: 0,
  parts: [{ id: "name", text: "Alice" }],
}];

const occurrence: SearchOccurrence = {
  regionId: "customers",
  unitKey: "1",
  unitOrder: 0,
  documentOrder: 0,
  partId: "name",
  start: 0,
  end: 5,
  occurrence: 0,
};

describe("createWorkerExecutor", () => {
  it("keeps an unchanged corpus in the worker between queries", async () => {
    const worker = new FakeWorker();
    const executor = createWorkerExecutor({
      worker: worker as unknown as Worker,
    });

    const first = executor.search(
      documents,
      "alice",
      {},
      new AbortController().signal,
    );
    worker.respond({ type: "result", requestId: 1, matches: [occurrence] });
    await expect(first).resolves.toEqual([occurrence]);

    const second = executor.search(
      documents,
      "ali",
      {},
      new AbortController().signal,
    );
    worker.respond({ type: "result", requestId: 2, matches: [occurrence] });
    await second;

    expect(worker.messages.filter(message =>
      message.type === "set-corpus"
    )).toHaveLength(1);
    expect(worker.messages.filter(message =>
      message.type === "search"
    )).toHaveLength(2);
  });

  it("translates AbortSignal cancellation into a worker message", async () => {
    const worker = new FakeWorker();
    const executor = createWorkerExecutor({
      worker: worker as unknown as Worker,
    });
    const abort = new AbortController();

    const result = executor.search(documents, "alice", {}, abort.signal);
    abort.abort();

    await expect(result).resolves.toEqual([]);
    expect(worker.messages.at(-1)).toEqual({
      type: "cancel",
      requestId: 1,
    });
  });
});
