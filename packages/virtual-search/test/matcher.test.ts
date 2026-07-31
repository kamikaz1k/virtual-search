import { describe, expect, it } from "vitest";
import { findOccurrences } from "../src/matcher";
import type { SearchDocument } from "../src/types";

const documents: SearchDocument[] = [
  {
    regionId: "dom",
    unitKey: "before",
    unitOrder: 0,
    documentOrder: 0,
    parts: [{ id: "text", text: "Alice before the list" }],
  },
  {
    regionId: "customers",
    unitKey: "2",
    unitOrder: 1,
    documentOrder: 1,
    parts: [
      { id: "name", text: "Alice Alice" },
      { id: "email", text: "alice@example.com" },
    ],
  },
];

describe("findOccurrences", () => {
  it("returns every literal occurrence in document, unit, part, and offset order", () => {
    const matches = findOccurrences(documents, "alice");

    expect(matches.map(({ documentOrder, partId, start }) => [
      documentOrder,
      partId,
      start,
    ])).toEqual([
      [0, "text", 0],
      [1, "name", 0],
      [1, "name", 6],
      [1, "email", 0],
    ]);
  });

  it("is case insensitive and NFC-normalized by default", () => {
    const normalizedDocuments: SearchDocument[] = [{
      regionId: "r",
      unitKey: "u",
      unitOrder: 0,
      documentOrder: 0,
      parts: [{ id: "text", text: "CAFÉ Cafe\u0301" }],
    }];

    const matches = findOccurrences(normalizedDocuments, "café");

    expect(matches).toHaveLength(2);
    expect(matches.map(match => [match.start, match.end])).toEqual([
      [0, 4],
      [5, 10],
    ]);
  });

  it("does not return matches for an empty query", () => {
    expect(findOccurrences(documents, "")).toEqual([]);
  });

  it("does not match across named parts", () => {
    const split: SearchDocument[] = [{
      regionId: "r",
      unitKey: "u",
      unitOrder: 0,
      documentOrder: 0,
      parts: [
        { id: "a", text: "ali" },
        { id: "b", text: "ce" },
      ],
    }];

    expect(findOccurrences(split, "alice")).toEqual([]);
  });
});
