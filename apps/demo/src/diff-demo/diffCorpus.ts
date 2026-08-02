import { parsePatchFiles, type CodeViewItem } from "@pierre/diffs";
import type { SearchTextPart } from "virtual-search";

export type DiffSide = "additions" | "deletions";

export interface DiffSearchLine {
  partId: string;
  itemId: string;
  lineNumber: number;
  side: DiffSide;
  text: string;
}

export interface DiffSearchUnit {
  key: string;
  itemId: string;
  lines: readonly DiffSearchLine[];
  parts: readonly SearchTextPart[];
}

export interface DiffDemoData {
  additions: number;
  deletions: number;
  files: readonly DiffDemoFile[];
  items: readonly CodeViewItem[];
  units: readonly DiffSearchUnit[];
}

export interface DiffDemoFile {
  id: string;
  name: string;
  additions: number;
  deletions: number;
}

interface MutableFile {
  id: string;
  name: string;
  additions: number;
  deletions: number;
}

export function encodeDiffUnitKey(
  side: DiffSide,
  lineNumber: number,
): string {
  return JSON.stringify([side, lineNumber]);
}

export function decodeDiffUnitKey(key: string): {
  side: DiffSide;
  lineNumber: number;
} | null {
  try {
    const value: unknown = JSON.parse(key);
    if (
      !Array.isArray(value)
      || value.length !== 2
      || (value[0] !== "additions" && value[0] !== "deletions")
      || typeof value[1] !== "number"
    ) {
      return null;
    }

    return {
      side: value[0],
      lineNumber: value[1],
    };
  } catch {
    return null;
  }
}

export function createDiffDemoData(patch: string): DiffDemoData {
  const parsed = parsePatchFiles(patch, "virtual-search-demo", true);
  const fileDiffs = parsed.flatMap(entry => entry.files);
  const items: CodeViewItem[] = fileDiffs.map(fileDiff => ({
    id: fileDiff.name,
    type: "diff",
    fileDiff,
  }));
  const linesByFile = new Map<string, DiffSearchLine[]>(
    fileDiffs.map(fileDiff => [fileDiff.name, []]),
  );
  const fileStats = new Map<string, MutableFile>(
    fileDiffs.map(fileDiff => [
      fileDiff.name,
      {
        id: fileDiff.name,
        name: fileDiff.name,
        additions: 0,
        deletions: 0,
      },
    ]),
  );

  let currentFile: MutableFile | undefined;
  let oldLine = 0;
  let newLine = 0;

  for (const rawLine of patch.split("\n")) {
    const fileHeader = /^diff --git a\/(.+) b\/(.+)$/.exec(rawLine);
    if (fileHeader) {
      currentFile = fileStats.get(fileHeader[2]!);
      continue;
    }

    const hunkHeader = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(
      rawLine,
    );
    if (hunkHeader) {
      oldLine = Number(hunkHeader[1]);
      newLine = Number(hunkHeader[2]);
      continue;
    }

    const isFileMarker = /^(?:\+\+\+|---) (?:[ab]\/|\/dev\/null|\")/
      .test(rawLine);
    if (!currentFile || isFileMarker) {
      continue;
    }

    const prefix = rawLine[0];
    const text = rawLine.slice(1);

    if (prefix === "+") {
      currentFile.additions += 1;
      linesByFile.get(currentFile.id)?.push({
        partId: encodeDiffUnitKey("additions", newLine),
        itemId: currentFile.id,
        lineNumber: newLine,
        side: "additions",
        text,
      });
      newLine += 1;
    } else if (prefix === "-") {
      currentFile.deletions += 1;
      linesByFile.get(currentFile.id)?.push({
        partId: encodeDiffUnitKey("deletions", oldLine),
        itemId: currentFile.id,
        lineNumber: oldLine,
        side: "deletions",
        text,
      });
      oldLine += 1;
    } else if (prefix === " ") {
      linesByFile.get(currentFile.id)?.push({
        partId: encodeDiffUnitKey("additions", newLine),
        itemId: currentFile.id,
        lineNumber: newLine,
        side: "additions",
        text,
      });
      oldLine += 1;
      newLine += 1;
    }
  }

  const files = [...fileStats.values()];
  const units: DiffSearchUnit[] = files.map(file => {
    const lines = linesByFile.get(file.id) ?? [];
    return {
      key: file.id,
      itemId: file.id,
      lines,
      parts: lines.map(line => ({ id: line.partId, text: line.text })),
    };
  });

  return {
    additions: files.reduce((sum, file) => sum + file.additions, 0),
    deletions: files.reduce((sum, file) => sum + file.deletions, 0),
    files,
    items,
    units,
  };
}
