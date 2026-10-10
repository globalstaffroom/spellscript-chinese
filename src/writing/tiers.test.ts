import { FINGER_LENIENCY_BONUS, TIERS, quizOptionsFor, showOutlineFor } from './tiers';

test('the three tiers match the spec table', () => {
  expect([TIERS.apprentice.labelZh, TIERS.practice.labelZh, TIERS.master.labelZh]).toEqual(['見習', '修行', '大師']);
  expect([showOutlineFor('apprentice'), showOutlineFor('practice'), showOutlineFor('master')]).toEqual([true, false, false]);
  expect([TIERS.apprentice.showHintAfterMisses, TIERS.practice.showHintAfterMisses, TIERS.master.showHintAfterMisses]).toEqual([1, 2, 3]);
  expect([TIERS.apprentice.maxMistakes, TIERS.practice.maxMistakes, TIERS.master.maxMistakes]).toEqual([6, 4, 2]);
  expect([TIERS.apprentice.acceptBackwardsStrokes, TIERS.practice.acceptBackwardsStrokes, TIERS.master.acceptBackwardsStrokes]).toEqual([true, true, false]);
  expect(TIERS.apprentice.leniency).toBeGreaterThan(TIERS.practice.leniency);
  expect(TIERS.practice.leniency).toBeGreaterThan(TIERS.master.leniency);
});

test('finger input adds a fixed tolerance allowance; pen and mouse do not', () => {
  expect(quizOptionsFor('practice', 'finger').leniency).toBeCloseTo(TIERS.practice.leniency + FINGER_LENIENCY_BONUS);
  expect(quizOptionsFor('practice', 'pen').leniency).toBe(TIERS.practice.leniency);
  expect(quizOptionsFor('practice', 'mouse').leniency).toBe(TIERS.practice.leniency);
});

test('Hanzi Writer is never allowed to mark a wrong stroke correct', () => {
  for (const t of ['apprentice', 'practice', 'master'] as const) {
    expect(quizOptionsFor(t, 'finger').markStrokeCorrectAfterMisses).toBe(false);
  }
});
