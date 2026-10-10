import { collectTargets } from './targets';
import type { Curriculum, ExtraChar } from './types';

const cur = (chars: [string, number][]): Curriculum => ({
  id: 'c', publisher: 'p', grade: 2, semester: 1, book: 'b', edition: 'e', sourcePages: 's', note: 'n',
  lessons: [{ lesson: 1, title: 't', write: chars.map(([char, totalStrokes]) => ({ char, radical: '人', strokesAfterRadical: 0, totalStrokes, zhuyin: null })) }],
});

test('merges curricula and extras into one character → MOE count map', () => {
  const extras: ExtraChar[] = [{ char: '士', totalStrokes: 3, why: 'x' }];
  const { targets, conflicts } = collectTargets([cur([['年', 6]]), cur([['花', 8]])], extras);
  expect([...targets]).toEqual([['年', 6], ['花', 8], ['士', 3]]);
  expect(conflicts).toEqual([]);
});

test('the same character with two different counts is a conflict', () => {
  const { conflicts } = collectTargets([cur([['年', 6]])], [{ char: '年', totalStrokes: 5, why: 'x' }]);
  expect(conflicts).toEqual(['年: 6 in one source, 5 in another']);
});
