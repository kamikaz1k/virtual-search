import { describe, expect, it } from "vitest";
import {
  createDiffDemoData,
  decodeDiffUnitKey,
  encodeDiffUnitKey,
} from "./diffCorpus";
import { INLINE_DIFF } from "./fixture";

describe("diff demo corpus", () => {
  it("keeps file, side, and line targeting stable", () => {
    const partId = encodeDiffUnitKey("deletions", 53);
    expect(decodeDiffUnitKey(partId)).toEqual({
      side: "deletions",
      lineNumber: 53,
    });
  });

  it("indexes every rendered patch line in file order", () => {
    const data = createDiffDemoData(INLINE_DIFF);

    expect(data.files).toHaveLength(12);
    expect(data.units).toHaveLength(12);
    expect(data.units.reduce((sum, unit) => sum + unit.parts.length, 0))
      .toBe(2_196);
    expect(data.additions).toBe(36);
    expect(data.deletions).toBe(36);
  });

  it("places the guided query across distant virtualized files", () => {
    const data = createDiffDemoData(INLINE_DIFF);
    const matchingFiles = data.units
      .filter(unit =>
        unit.parts.some(part => part.text.includes("signalRelay"))
      )
      .map(unit => unit.itemId);

    expect(matchingFiles).toEqual([
      "src/runtime/signal-relay.ts",
      "src/http/request-context.ts",
      "src/observability/trace-buffer.ts",
      "src/config/schema.ts",
      "test/runtime/signal-relay.test.ts",
    ]);
    expect(
      data.units.flatMap(unit => unit.parts)
        .filter(part => part.text.includes("signalRelay")),
    ).toHaveLength(6);
  });
});
