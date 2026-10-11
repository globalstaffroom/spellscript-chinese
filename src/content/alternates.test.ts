import { applyOrder, divergeAt, validateAlternates, type Alternates } from './alternates';

const data = { strokes: ['S0', 'S1', 'S2', 'S3'], medians: [[[0, 0]], [[1, 1]], [[2, 2]], [[3, 3]]] };

test('applyOrder reorders strokes and medians together, leaving the input untouched', () => {
  const out = applyOrder(data, [0, 1, 3, 2]);
  expect(out.strokes).toEqual(['S0', 'S1', 'S3', 'S2']);
  expect(out.medians).toEqual([[[0, 0]], [[1, 1]], [[3, 3]], [[2, 2]]]);
  expect(data.strokes).toEqual(['S0', 'S1', 'S2', 'S3']);
});

test('divergeAt is the first index that differs from the primary order, -1 if none', () => {
  expect(divergeAt([0, 1, 3, 2])).toBe(2);
  expect(divergeAt([1, 0, 2])).toBe(0);
  expect(divergeAt([0, 1, 2])).toBe(-1);
});

const counts = new Map([['方', 4]]);
const one = (orders: number[][], char = '方'): Alternates => ({ [char]: { orders, source: 's' } });

test('a valid alternate has no problems', () => {
  expect(validateAlternates(one([[0, 1, 3, 2]]), counts)).toEqual([]);
});

test('an alternate for a character the content does not use is a problem', () => {
  expect(validateAlternates(one([[1, 0]], '木'), counts)).toEqual(['木: alternate stroke order for a character not in the content']);
});

test('an order whose length is not the stroke count is a problem', () => {
  expect(validateAlternates(one([[0, 1, 2]]), counts)).toEqual(['方: alternate order 1 has 3 strokes but the character has 4']);
});

test('an order that repeats a stroke is a problem', () => {
  expect(validateAlternates(one([[0, 1, 1, 2]]), counts)).toEqual(['方: alternate order 1 is not a permutation of 0..3']);
});

test('an order with an out-of-range stroke is a problem', () => {
  expect(validateAlternates(one([[0, 1, 2, 4]]), counts)).toEqual(['方: alternate order 1 is not a permutation of 0..3']);
});

test('an order identical to the primary is a problem', () => {
  expect(validateAlternates(one([[0, 1, 2, 3]]), counts)).toEqual(['方: alternate order 1 is the same as the primary order']);
});
