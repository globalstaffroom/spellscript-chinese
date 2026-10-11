import type { StrokeJson } from './types';

/**
 * Second official MOE stroke orders (筆順學習網「有另一種寫法」), as permutations of the primary stroke indices:
 * `orders[j][i]` is the primary stroke drawn i-th in alternate j. Same stroke shapes, different order.
 */
export type Alternates = Record<string, { orders: number[][]; source: string }>;

/** The stroke data with strokes and medians reordered so stroke i is primary stroke order[i]. */
export function applyOrder(data: StrokeJson, order: number[]): StrokeJson {
  return { strokes: order.map(i => data.strokes[i]!), medians: order.map(i => data.medians[i]!) };
}

/** The first position where the order leaves the primary order (-1 if it never does). */
export function divergeAt(order: number[]): number {
  return order.findIndex((s, i) => s !== i);
}

export function validateAlternates(a: Alternates, counts: Map<string, number>): string[] {
  const problems: string[] = [];
  for (const [char, { orders }] of Object.entries(a)) {
    const n = counts.get(char);
    if (n === undefined) { problems.push(`${char}: alternate stroke order for a character not in the content`); continue; }
    orders.forEach((order, j) => {
      const label = `${char}: alternate order ${j + 1}`;
      if (order.length !== n) { problems.push(`${label} has ${order.length} strokes but the character has ${n}`); return; }
      const seen = new Set(order);
      if (seen.size !== n || order.some(s => !Number.isInteger(s) || s < 0 || s >= n)) {
        problems.push(`${label} is not a permutation of 0..${n - 1}`);
        return;
      }
      if (divergeAt(order) === -1) problems.push(`${label} is the same as the primary order`);
    });
  }
  return problems;
}
