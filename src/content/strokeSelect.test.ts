import { selectStrokeData } from './strokeSelect';
import type { StrokeJson } from './types';

const data = (n: number): StrokeJson => ({
  strokes: Array.from({ length: n }, (_, i) => `M ${i} 0 L ${i} 10 Z`),
  medians: Array.from({ length: n }, (_, i) => [[i, 0], [i, 10]]),
});

test('prefers AnimCJK Taiwan data when its count matches MOE', () => {
  const s = selectStrokeData('花', 8, { 'animcjk-zhHant': data(8), 'hanzi-writer-data': data(8) });
  expect(s.chosen?.source).toBe('animcjk-zhHant');
});

test('falls back to hanzi-writer-data only when its count matches', () => {
  const s = selectStrokeData('追', 9, { 'animcjk-zhHant': data(10), 'hanzi-writer-data': data(9) });
  expect(s.chosen?.source).toBe('hanzi-writer-data');
  expect(s.rejected).toEqual([{ source: 'animcjk-zhHant', count: 10 }]);
});

test('chooses nothing when no source matches MOE', () => {
  const s = selectStrokeData('茄', 9, { 'hanzi-writer-data': data(8) });
  expect(s.chosen).toBeNull();
  expect(s.rejected).toEqual([{ source: 'hanzi-writer-data', count: 8 }]);
});

test('a hand-made override with the wrong count fails loudly and does not fall back', () => {
  const s = selectStrokeData('茄', 9, { override: data(8), 'animcjk-zhHant': data(9) });
  expect(s.chosen).toBeNull();
  expect(s.overrideMismatch).toBe(true);
});

test('an override with the right count wins over everything', () => {
  const s = selectStrokeData('茄', 9, { override: data(9), 'animcjk-zhHant': data(9) });
  expect(s.chosen?.source).toBe('override');
});

test('strokes and medians must both match the count', () => {
  const broken = { strokes: data(9).strokes, medians: data(8).medians };
  expect(selectStrokeData('茄', 9, { 'animcjk-zhHant': broken }).chosen).toBeNull();
});
