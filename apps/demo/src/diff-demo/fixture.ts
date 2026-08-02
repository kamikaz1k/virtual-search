export const FULL_DIFF_METADATA = {
  additions: 1_009_257,
  bytes: 43_415_617,
  deletions: 4_024,
  files: 2_188,
  lines: 1_029_638,
  sha256: "d94d35c1f6f033981d812cdaa61980bb26ecf645b197c94f9a1bf3af092779b3",
} as const;

export const FULL_DIFF_URL =
  `${import.meta.env.BASE_URL}oven-sh-bun-pr-30412.diff`;

export async function loadFullDiff(signal?: AbortSignal): Promise<string> {
  const response = await fetch(
    FULL_DIFF_URL,
    signal ? { signal } : undefined,
  );
  if (!response.ok) {
    throw new Error(`Could not load the full PR diff (${response.status}).`);
  }

  return response.text();
}
