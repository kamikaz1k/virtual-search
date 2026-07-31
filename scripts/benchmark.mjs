import { findOccurrences } from "../packages/virtual-search/dist/index.js";

function createDocuments(count) {
  return Array.from({ length: count }, (_, index) => ({
    regionId: "benchmark",
    unitKey: String(index),
    unitOrder: index,
    documentOrder: index,
    parts: [{
      id: "text",
      text: index % 97 === 0
        ? `Record ${index}: Alice is searchable`
        : `Record ${index}: ordinary searchable content`,
    }],
  }));
}

function run(count, query) {
  const documents = createDocuments(count);
  const start = performance.now();
  const matches = findOccurrences(documents, query);
  const duration = performance.now() - start;

  return {
    documents: count,
    characters: documents.reduce(
      (total, document) => total + document.parts[0].text.length,
      0,
    ),
    matches: matches.length,
    milliseconds: Number(duration.toFixed(1)),
  };
}

console.table([
  run(10_000, "alice"),
  run(100_000, "alice"),
]);
