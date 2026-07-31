import type {
  SearchDocument,
  SearchOccurrence,
  SearchOptions,
} from "./types";

interface NormalizedSource {
  text: string;
  identityOffsets: boolean;
  starts: number[];
  ends: number[];
}

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

function transform(value: string, options: SearchOptions): string {
  const normalized = options.normalize === false
    ? value
    : value.normalize(options.normalize ?? "NFC");

  return options.caseSensitive ? normalized : normalized.toLowerCase();
}

/**
 * Transform searchable text while retaining a map back to source UTF-16
 * offsets. Normalization and case folding can change string length, so offsets
 * in the transformed string cannot safely be used as DOM offsets directly.
 */
function normalizeSource(
  value: string,
  options: SearchOptions,
): NormalizedSource {
  const transformedValue = transform(value, options);
  if (transformedValue.length === value.length) {
    return {
      text: transformedValue,
      identityOffsets: true,
      starts: [],
      ends: [],
    };
  }

  const output: NormalizedSource = {
    text: "",
    identityOffsets: false,
    starts: [],
    ends: [],
  };

  for (const segment of graphemeSegmenter.segment(value)) {
    const transformed = transform(segment.segment, options);
    const sourceStart = segment.index;
    const sourceEnd = sourceStart + segment.segment.length;

    output.text += transformed;

    for (let index = 0; index < transformed.length; index += 1) {
      output.starts.push(sourceStart);
      output.ends.push(sourceEnd);
    }
  }

  return output;
}

export function findOccurrences(
  documents: readonly SearchDocument[],
  query: string,
  options: SearchOptions = {},
  shouldAbort: () => boolean = () => false,
): SearchOccurrence[] {
  if (query.length === 0) return [];

  const needle = transform(query, options);
  if (needle.length === 0) return [];

  const matches: SearchOccurrence[] = [];

  for (const document of documents) {
    if (shouldAbort()) break;

    for (const part of document.parts) {
      const source = normalizeSource(part.text, options);
      const haystack = source.text;
      let from = 0;
      let occurrence = 0;

      while (from <= haystack.length - needle.length) {
        const start = haystack.indexOf(needle, from);
        if (start === -1) break;
        const transformedEnd = start + needle.length;
        const sourceStart = source.identityOffsets
          ? start
          : source.starts[start];
        const sourceEnd = source.identityOffsets
          ? transformedEnd
          : source.ends[transformedEnd - 1];

        if (sourceStart === undefined || sourceEnd === undefined) break;

        matches.push({
          regionId: document.regionId,
          unitKey: document.unitKey,
          unitOrder: document.unitOrder,
          documentOrder: document.documentOrder,
          partId: part.id,
          start: sourceStart,
          end: sourceEnd,
          occurrence,
        });

        occurrence += 1;
        from = start + Math.max(needle.length, 1);
      }
    }
  }

  return matches;
}
