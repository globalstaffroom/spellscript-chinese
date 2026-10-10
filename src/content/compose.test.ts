import { compose, medianBox, transformPath } from './compose';
import type { StrokeJson } from './types';

const line = (x1: number, y1: number, x2: number, y2: number) => ({ d: `M ${x1} ${y1} L ${x2} ${y2} Z`, m: [[x1, y1], [x2, y2]] });
const char = (...ls: ReturnType<typeof line>[]): StrokeJson => ({ strokes: ls.map(l => l.d), medians: ls.map(l => l.m) });

test('medianBox spans all median points', () => {
  expect(medianBox([[[0, 10], [5, 20]], [[3, -4]]])).toEqual({ minX: 0, minY: -4, maxX: 5, maxY: 20 });
});

test('transformPath maps every coordinate pair and keeps commands', () => {
  expect(transformPath('M 1 2 Q 3 4 5 6 L 7,8 Z', (x, y) => [x * 10, y + 1])).toBe('M 10 3 Q 30 5 50 7 L 70 9 Z');
  expect(transformPath('M435,513C476,579 516,656 533,680Z', (x, y) => [x, y])).toBe('M 435 513 C 476 579 516 656 533 680 Z');
});

test('replaces the removed strokes with donor strokes scaled into their box, in order', () => {
  const base = char(line(0, 0, 100, 0), line(0, 50, 100, 50), line(500, 0, 500, 900));
  const donor = char(line(0, 0, 10, 0), line(0, 5, 10, 5), line(0, 10, 10, 10), line(99, 99, 99, 99));
  const out = compose(base, [{ op: { remove: [0, 1], insertAt: 0, donor: { char: 'x', strokes: [0, 1, 2] } }, donor }]);
  expect(out.strokes).toHaveLength(4);
  expect(out.medians[0]).toEqual([[0, 0], [100, 0]]);
  expect(out.medians[1]).toEqual([[0, 25], [100, 25]]);
  expect(out.medians[2]).toEqual([[0, 50], [100, 50]]);
  expect(out.medians[3]).toEqual([[500, 0], [500, 900]]);
  expect(out.strokes[1]).toBe('M 0 25 L 100 25 Z');
});

test('inserting after the last base stroke appends', () => {
  const base = char(line(0, 0, 10, 0));
  const donor = char(line(0, 0, 1, 1));
  const out = compose(base, [{ op: { remove: [], insertAt: 1, donor: { char: 'x', strokes: 'all' }, targetBox: { minX: 0, minY: 0, maxX: 100, maxY: 100 } }, donor }]);
  expect(out.medians).toEqual([[[0, 0], [10, 0]], [[0, 0], [100, 100]]]);
});

test('rejects an out-of-range stroke index', () => {
  const base = char(line(0, 0, 10, 0));
  expect(() => compose(base, [{ op: { remove: [3], insertAt: 0, donor: { char: 'x', strokes: 'all' } }, donor: base }])).toThrow(/out of range/);
});

test('rejects an op with nothing removed and no target box', () => {
  const base = char(line(0, 0, 10, 0));
  expect(() => compose(base, [{ op: { remove: [], insertAt: 0, donor: { char: 'x', strokes: 'all' } }, donor: base }])).toThrow(/targetBox/);
});

test('an insert lands before the kept base stroke at insertAt', () => {
  const base = char(line(0, 0, 10, 0), line(0, 100, 10, 100), line(0, 200, 10, 200));
  const donor = char(line(0, 0, 10, 0));
  const out = compose(base, [{ op: { remove: [2], insertAt: 1, donor: { char: 'x', strokes: 'all' } }, donor }]);
  expect(out.medians).toHaveLength(3);
  expect(out.medians[0]).toEqual([[0, 0], [10, 0]]);
  expect(out.medians[1]).toEqual([[0, 200], [10, 200]]);
  expect(out.medians[2]).toEqual([[0, 100], [10, 100]]);
});
