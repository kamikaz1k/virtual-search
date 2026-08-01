const fileNames = [
  "src/runtime/scheduler.ts",
  "src/runtime/signal-relay.ts",
  "src/runtime/worker-pool.ts",
  "src/http/router.ts",
  "src/http/request-context.ts",
  "src/cache/segment-store.ts",
  "src/observability/trace-buffer.ts",
  "src/cli/inspect.ts",
  "src/config/schema.ts",
  "test/runtime/scheduler.test.ts",
  "test/runtime/signal-relay.test.ts",
  "docs/architecture/virtual-runtime.md",
] as const;

const SIGNAL_LINES = new Map([
  [1, new Set([24, 112])],
  [4, new Set([78])],
  [6, new Set([143])],
  [8, new Set([46])],
  [10, new Set([159])],
]);

function sourceLine(fileIndex: number, lineNumber: number): string {
  const signalLines = SIGNAL_LINES.get(fileIndex);

  if (signalLines?.has(lineNumber)) {
    return `  signalRelay.publish("frame-ready", { shard: ${fileIndex}, sequence: ${lineNumber} });`;
  }

  if (lineNumber % 41 === 0) {
    return `  const checkpoint${lineNumber} = await runtime.flushPartition(${fileIndex});`;
  }

  if (lineNumber % 17 === 0) {
    return `  metrics.observe("virtual_window", ${lineNumber});`;
  }

  if (lineNumber % 11 === 0) {
    return `  await scheduler.yieldToShard(${lineNumber % 7});`;
  }

  return `  frame[${lineNumber}] = reconcileSegment(source, ${lineNumber}, options);`;
}

function buildFilePatch(name: string, fileIndex: number): string {
  const lineCount = 180;
  const lines = [
    `diff --git a/${name} b/${name}`,
    `index ${String(fileIndex + 17).padStart(7, "0")}..${String(fileIndex + 91).padStart(7, "0")} 100644`,
    `--- a/${name}`,
    `+++ b/${name}`,
    `@@ -1,${lineCount} +1,${lineCount} @@`,
  ];

  for (let lineNumber = 1; lineNumber <= lineCount; lineNumber += 1) {
    const nextLine = sourceLine(fileIndex, lineNumber);

    if (lineNumber % 53 === 0) {
      lines.push(
        `-  frame[${lineNumber}] = reconcileSegment(source, ${lineNumber}, legacyOptions);`,
        `+${nextLine}`,
      );
    } else {
      lines.push(` ${nextLine}`);
    }
  }

  return lines.join("\n");
}

export const INLINE_DIFF = `${fileNames
  .map(buildFilePatch)
  .join("\n")}\n`;

export const INLINE_DIFF_FILE_NAMES = fileNames;
