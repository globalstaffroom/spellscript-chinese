import { summarizeCalibration } from './calibrationSummary';
import type { AttemptRecord } from '../writing/attempt';

const a = (o: Partial<AttemptRecord>): AttemptRecord => ({
  id: 'x', profileId: 'p', char: '木', expectedChar: null, word: null, context: 'calibration', tier: 'practice', leniencyInput: 'finger',
  inputs: ['finger'], outlineVisible: false, hintShown: false, strokes: [], totalMistakes: 0, result: 'passed', checker: 'c', startedAt: 0, endedAt: 1, ...o,
});
const s = (accepted: boolean) => ({ strokeNum: 0, accepted, backwards: false, mistakesOnStroke: accepted ? 0 : 1, drawn: [], raw: null, hintShownAfter: false });

test('rejection rate is rejected strokes over all evaluated strokes, per tier and input', () => {
  const sum = summarizeCalibration([
    a({ tier: 'practice', strokes: [s(true), s(false), s(true), s(true)] }),
    a({ tier: 'practice', strokes: [s(true), s(true)], inputs: ['pen'] }),
    a({ tier: 'master', result: 'failed', strokes: [s(false), s(false)] }),
  ]);
  expect(sum.byTier.practice).toMatchObject({ attempts: 2, passed: 2, passedFirstTry: 1, strokesEvaluated: 6, strokesRejected: 1 });
  expect(sum.byTier.practice.rejectionRate).toBeCloseTo(1 / 6);
  expect(sum.byTier.master).toMatchObject({ attempts: 1, passed: 0, strokesRejected: 2 });
  expect(sum.byInput.pen?.strokesEvaluated).toBe(2);
});

test('a tier with no attempts reports zero, not NaN', () => {
  expect(summarizeCalibration([]).byTier.apprentice.rejectionRate).toBe(0);
});

test('look-alike attempts count false accepts and are kept out of the rejection figures', () => {
  const sum = summarizeCalibration([
    a({ context: 'lookalike', char: '土', expectedChar: '士', result: 'passed' }),
    a({ context: 'lookalike', char: '人', expectedChar: '入', result: 'failed' }),
  ]);
  expect(sum.lookalikes).toEqual([
    { asked: '土', written: '士', tier: 'practice', falseAccept: true },
    { asked: '人', written: '入', tier: 'practice', falseAccept: false },
  ]);
  expect(sum.byTier.practice.attempts).toBe(0);
});

test('abandoned attempts are listed but not counted as passes or failures', () => {
  const sum = summarizeCalibration([a({ result: 'abandoned', strokes: [s(true)] })]);
  expect(sum.abandoned).toBe(1);
  expect(sum.byTier.practice.attempts).toBe(0);
});
