import { CHECKER_VERSION, finishAttempt, isOverMistakeLimit, recordStroke, startAttempt, type StrokeEvent } from './attempt';
import type { RawStroke } from './rawStrokes';

const init = { id: 'a1', profileId: 'p1', char: '木', expectedChar: null, word: null, context: 'calibration' as const, tier: 'practice' as const, leniencyInput: 'finger' as const, outlineVisible: false, now: 100 };
const ev = (o: Partial<StrokeEvent>): StrokeEvent => ({ strokeNum: 0, isCorrect: true, isBackwards: false, mistakesOnStroke: 0, totalMistakes: 0, drawn: [{ x: 1, y: 1 }], ...o });
const raw = (input: RawStroke['input']): RawStroke => ({ input, points: [{ x: 0, y: 0, t: 0 }, { x: 1, y: 1, t: 5 }] });

test('a clean pass records every stroke and the inputs used', () => {
  let s = startAttempt(init);
  s = recordStroke(s, ev({ strokeNum: 0 }), raw('pen'));
  s = recordStroke(s, ev({ strokeNum: 1 }), raw('finger'));
  const r = finishAttempt(s, 'passed', 900);
  expect(r.strokes.map(x => x.accepted)).toEqual([true, true]);
  expect(r.inputs).toEqual(['pen', 'finger']);
  expect(r.hintShown).toBe(false);
  expect(r.totalMistakes).toBe(0);
  expect(r.checker).toBe(CHECKER_VERSION);
  expect([r.startedAt, r.endedAt, r.result]).toEqual([100, 900, 'passed']);
});

test('a hint is recorded once mistakes on a stroke reach the tier threshold (修行: 2)', () => {
  let s = startAttempt(init);
  s = recordStroke(s, ev({ isCorrect: false, mistakesOnStroke: 1, totalMistakes: 1 }), raw('finger'));
  expect(s.hintShown).toBe(false);
  s = recordStroke(s, ev({ isCorrect: false, mistakesOnStroke: 2, totalMistakes: 2 }), raw('finger'));
  expect(s.hintShown).toBe(true);
  expect(s.strokes[1]?.hintShownAfter).toBe(true);
});

test('the attempt is over the limit when total mistakes reach the tier maximum (修行: 4)', () => {
  let s = startAttempt(init);
  for (let m = 1; m <= 3; m++) s = recordStroke(s, ev({ isCorrect: false, mistakesOnStroke: m, totalMistakes: m }), null);
  expect(isOverMistakeLimit(s)).toBe(false);
  s = recordStroke(s, ev({ isCorrect: false, mistakesOnStroke: 4, totalMistakes: 4 }), null);
  expect(isOverMistakeLimit(s)).toBe(true);
});

test('a backwards stroke accepted at 修行 is kept and flagged', () => {
  const s = recordStroke(startAttempt(init), ev({ isCorrect: true, isBackwards: true }), raw('pen'));
  expect(s.strokes[0]).toMatchObject({ accepted: true, backwards: true });
});

test('a missing raw stroke is recorded as null, not invented', () => {
  const s = recordStroke(startAttempt(init), ev({}), null);
  expect(s.strokes[0]?.raw).toBeNull();
  expect(finishAttempt(s, 'passed', 1).inputs).toEqual([]);
});
