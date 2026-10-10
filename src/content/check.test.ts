import { checkContent, type StrokeReport } from './check';
import type { Curriculum } from './types';

const cur: Curriculum = {
  id: 'c', publisher: 'p', grade: 2, semester: 1, book: 'b', edition: 'e', sourcePages: 's', note: 'n',
  lessons: [{ lesson: 1, title: 't', write: [
    { char: '年', radical: '干', strokesAfterRadical: 3, totalStrokes: 6, zhuyin: null },
    { char: '茄', radical: '艸', strokesAfterRadical: 5, totalStrokes: 9, zhuyin: null },
  ] }],
};
const report = (entries: StrokeReport['chars']): StrokeReport => ({ generatedAt: 'x', chars: entries });
const ok = (char: string, expected: number) => ({ char, expected, source: 'animcjk-zhHant' as const, rejected: [], overrideMismatch: false });

test('clean content has no problems', () => {
  expect(checkContent({ curricula: [cur], extras: [], report: report([ok('年', 6), ok('茄', 9)]), verified: {}, requireVerified: [] })).toEqual([]);
});

test('a character with no MOE-count data is a problem, naming what was rejected', () => {
  const r = report([ok('年', 6), { char: '茄', expected: 9, source: null, rejected: [{ source: 'hanzi-writer-data', count: 8 }], overrideMismatch: false }]);
  expect(checkContent({ curricula: [cur], extras: [], report: r, verified: {}, requireVerified: [] }))
    .toEqual(['茄: no stroke data with the MOE count 9 (rejected: hanzi-writer-data 8)']);
});

test('a stale report (character missing from it) is a problem', () => {
  expect(checkContent({ curricula: [cur], extras: [], report: report([ok('年', 6)]), verified: {}, requireVerified: [] }))
    .toEqual(['茄: not in content/strokes/report.json — run npm run build-strokes']);
});

test('an override with the wrong count is a problem', () => {
  const r = report([ok('年', 6), { char: '茄', expected: 9, source: null, rejected: [{ source: 'override', count: 8 }], overrideMismatch: true }]);
  expect(checkContent({ curricula: [cur], extras: [], report: r, verified: {}, requireVerified: [] }))
    .toContain('茄: override has 8 strokes but MOE says 9 — fix its compose recipe');
});

test('a required character that nobody has verified is a problem', () => {
  expect(checkContent({ curricula: [cur], extras: [], report: report([ok('年', 6), ok('茄', 9)]), verified: { 年: { by: 'founder', date: '2026-10-11' } }, requireVerified: ['年', '茄'] }))
    .toEqual(['茄: stroke order not yet verified against MOE 筆順']);
});

test('curriculum problems are reported', () => {
  const bad: Curriculum = { ...cur, lessons: [{ lesson: 1, title: 't', write: [{ char: '，', radical: '人', strokesAfterRadical: 0, totalStrokes: 1, zhuyin: null }] }] };
  expect(checkContent({ curricula: [bad], extras: [], report: report([]), verified: {}, requireVerified: [] })[0])
    .toBe('c lesson 1 「，」: not a single Han character');
});

test('a report built for a different count is stale', () => { expect(checkContent({ curricula: [cur], extras: [], report: report([ok('年', 5), ok('茄', 9)]), verified: {}, requireVerified: [] })).toHaveLength(1); });
