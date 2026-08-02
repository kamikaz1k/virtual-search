import { describe, expect, it } from "vitest";
import {
  createDiffDemoData,
  decodeDiffUnitKey,
  encodeDiffUnitKey,
} from "./diffCorpus";

const TEST_DIFF = `diff --git a/src/runtime.ts b/src/runtime.ts
--- a/src/runtime.ts
+++ b/src/runtime.ts
@@ -1,2 +1,3 @@
 const allocator = createAllocator();
-runLegacy();
+runCurrent();
+allocator.reset();
diff --git a/src/worker.rs b/src/worker.rs
--- /dev/null
+++ b/src/worker.rs
@@ -0,0 +1,2 @@
+use crate::allocator;
+pub fn start() {}
`;

describe("diff demo corpus", () => {
  it("keeps file, side, and line targeting stable", () => {
    const partId = encodeDiffUnitKey("deletions", 53);
    expect(decodeDiffUnitKey(partId)).toEqual({
      side: "deletions",
      lineNumber: 53,
    });
  });

  it("indexes every rendered patch line in file order", () => {
    const data = createDiffDemoData(TEST_DIFF);

    expect(data.files).toHaveLength(2);
    expect(data.units).toHaveLength(2);
    expect(data.files.map(file => file.name)).toEqual([
      "src/runtime.ts",
      "src/worker.rs",
    ]);
    expect(data.units.reduce((sum, unit) => sum + unit.parts.length, 0))
      .toBe(6);
    expect(data.additions).toBe(4);
    expect(data.deletions).toBe(1);
  });

  it("places the guided query across distant virtualized files", () => {
    const data = createDiffDemoData(TEST_DIFF);
    const matchingFiles = data.units
      .filter(unit =>
        unit.parts.some(part => part.text.toLowerCase().includes("allocator"))
      )
      .map(unit => unit.itemId);

    expect(matchingFiles).toEqual([
      "src/runtime.ts",
      "src/worker.rs",
    ]);
    expect(
      data.units.flatMap(unit => unit.parts)
        .filter(part => part.text.toLowerCase().includes("allocator")),
    ).toHaveLength(3);
  });
});
