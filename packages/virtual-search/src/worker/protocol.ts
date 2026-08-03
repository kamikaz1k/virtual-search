import type {
  SearchDocument,
  SearchOccurrence,
  SearchOptions,
} from "../types.js";

export type WorkerRequest =
  | {
      type: "set-corpus";
      documents: readonly SearchDocument[];
    }
  | {
      type: "search";
      requestId: number;
      query: string;
      options: SearchOptions;
    }
  | {
      type: "cancel";
      requestId: number;
    }
  | {
      type: "dispose";
    };

export type WorkerResponse =
  | {
      type: "result";
      requestId: number;
      matches: readonly SearchOccurrence[];
    }
  | {
      type: "error";
      requestId: number;
      message: string;
    };
