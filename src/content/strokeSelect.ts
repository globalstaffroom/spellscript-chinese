import type { StrokeJson } from './types';

export type StrokeSourceName = 'override' | 'animcjk-zhHant' | 'hanzi-writer-data';

export type Selection = {
  char: string;
  expected: number;
  chosen: { source: StrokeSourceName; data: StrokeJson } | null;
  rejected: { source: StrokeSourceName; count: number }[];
  overrideMismatch: boolean;
};

const ORDER: StrokeSourceName[] = ['override', 'animcjk-zhHant', 'hanzi-writer-data'];

export function selectStrokeData(
  char: string,
  expected: number,
  candidates: Partial<Record<StrokeSourceName, StrokeJson>>,
): Selection {
  const rejected: Selection['rejected'] = [];
  for (const source of ORDER) {
    const d = candidates[source];
    if (!d) continue;
    if (d.strokes.length === expected && d.medians.length === expected) {
      return {
        char,
        expected,
        chosen: { source, data: { strokes: d.strokes, medians: d.medians } },
        rejected,
        overrideMismatch: false,
      };
    }
    rejected.push({ source, count: d.strokes.length });
    // A person made this file on purpose; a wrong count means the recipe is wrong. Never paper over it with mainland data.
    if (source === 'override') {
      return { char, expected, chosen: null, rejected, overrideMismatch: true };
    }
  }
  return { char, expected, chosen: null, rejected, overrideMismatch: false };
}
