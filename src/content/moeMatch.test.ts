import {
  alignToBox, assign, bruteForce, extractMoeXml, forwardCost, hasVersion2, hungarian, matchStrokes, normaliseMoe, normaliseOurs,
  parseMoeXml, reversedCost, type Track,
} from './moeMatch';

// All geometry here is synthetic. No MOE data is used in tests (it is CC BY-NC-ND and never committed).

test('normaliseOurs maps the 1024 box with y up (baseline -124) to a unit square with y down', () => {
  const [t] = normaliseOurs([[[512, 900], [300, 400], [1024, -124]]]);
  expect(t!.start).toEqual([0.5, 0]);
  expect(t!.end).toEqual([1, 1]);
});

test('normaliseMoe maps the 2048 box (y already down) to a unit square, first and last track points', () => {
  const [t] = normaliseMoe([[[1024, 0], [10, 10], [2048, 2048]]]);
  expect(t!.start).toEqual([0.5, 0]);
  expect(t!.end).toEqual([1, 1]);
});

test('forward and reversed costs are the summed start/end distances', () => {
  const a: Track = { start: [0, 0], end: [1, 0] }, b: Track = { start: [1, 0], end: [0, 0] };
  expect(forwardCost(a, b)).toBe(2);
  expect(reversedCost(a, b)).toBe(0);
});

const total = (cost: number[][], a: number[]) => a.reduce((s, c, r) => s + cost[r]![c]!, 0);

test('bruteForce finds the optimum where the greedy row-by-row choice is wrong', () => {
  // Greedy takes row 0 → col 0 (1), forcing row 1 → col 1 (100): 101. Optimum is 2 + 3 = 5.
  const cost = [[1, 2], [3, 100]];
  expect(bruteForce(cost)).toEqual([1, 0]);
});

test('hungarian agrees with brute force on random matrices of size 1..8', () => {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let n = 1; n <= 8; n++) {
    for (let k = 0; k < 20; k++) {
      const cost = Array.from({ length: n }, () => Array.from({ length: n }, () => Math.round(rand() * 1000) / 1000));
      const h = hungarian(cost);
      expect(new Set(h).size).toBe(n);
      expect(total(cost, h)).toBeCloseTo(total(cost, bruteForce(cost)), 9);
    }
  }
});

test('assign recovers a hidden permutation for n > 8 (Hungarian path)', () => {
  const perm = [3, 0, 9, 1, 7, 2, 11, 5, 4, 10, 6, 8];
  const cost = perm.map((p, r) => perm.map((_, c) => (c === p ? 0 : 1 + ((r * 7 + c * 3) % 5))));
  expect(assign(cost)).toEqual(perm);
});

// A synthetic 4-stroke character: two horizontals, a vertical, a diagonal.
const moe: Track[] = [
  { start: [0.2, 0.2], end: [0.8, 0.2] },
  { start: [0.2, 0.5], end: [0.8, 0.5] },
  { start: [0.5, 0.1], end: [0.5, 0.9] },
  { start: [0.8, 0.6], end: [0.2, 0.9] },
];
const nudge = (t: Track, d = 0.02): Track => ({ start: [t.start[0] + d, t.start[1] - d], end: [t.end[0] - d, t.end[1] + d] });

test('match: same strokes, same order, same direction', () => {
  const r = matchStrokes(moe.map(t => nudge(t)), moe);
  expect(r.outcome).toBe('match');
  expect(r.order).toEqual([0, 1, 2, 3]);
});

test('reorder: same strokes in a different order gives the MOE order as our indices', () => {
  const ours = [moe[0]!, moe[2]!, moe[1]!, moe[3]!].map(t => nudge(t));
  const r = matchStrokes(ours, moe);
  expect(r.outcome).toBe('reorder');
  expect(r.order).toEqual([0, 2, 1, 3]);
});

test('reversed: one stroke drawn the other way', () => {
  const ours = moe.map((t, i) => (i === 3 ? { start: t.end, end: t.start } : nudge(t)));
  const r = matchStrokes(ours, moe);
  expect(r.outcome).toBe('reversed');
  expect(r.reversedAt).toEqual([3]);
});

test('nomatch: a stroke far from every MOE stroke', () => {
  const ours = moe.map((t, i) => (i === 3 ? { start: [0.9, 0.9], end: [0.95, 0.1] } as Track : t));
  const r = matchStrokes(ours, moe);
  expect(r.outcome).toBe('nomatch');
});

test('nomatch (ambiguous): a different optimal order when our own order also fits is not claimed as a reorder', () => {
  // Two nearly coincident strokes: swapping them is marginally cheaper, but the identity pairing is also in range.
  const m: Track[] = [{ start: [0.2, 0.5], end: [0.8, 0.5] }, { start: [0.22, 0.52], end: [0.82, 0.52] }];
  const ours: Track[] = [{ start: [0.22, 0.52], end: [0.82, 0.52] }, { start: [0.2, 0.5], end: [0.8, 0.5] }];
  const r = matchStrokes(ours, m, 0.2);
  expect(r.outcome).toBe('nomatch');
  expect(r.reason).toMatch(/ambiguous/);
});

test('nomatch: different stroke counts', () => {
  expect(matchStrokes(moe.slice(0, 3), moe).outcome).toBe('nomatch');
});

test('the threshold is inclusive and governs match vs nomatch', () => {
  const ours = moe.map(t => nudge(t, 0.05)); // each cost = 2 * 0.05 * sqrt(2) ≈ 0.1414
  expect(matchStrokes(ours, moe, 0.15).outcome).toBe('match');
  expect(matchStrokes(ours, moe, 0.14).outcome).toBe('nomatch');
});

const page = (xml: string, extra = '') =>
  `<html><script>var xml=[];xml[123]=${JSON.stringify(xml)};</script>${extra}</html>`;
const xml = `<?xml version="1.0"?>\n<Word version="1.0" unicode="十">\n<Stroke><Outline><MoveTo x="1" y="2"/></Outline>` +
  `<Track><MoveTo x="100.0" y="1024.0" size="9"/><LineTo x="1900.5" y="1000"/></Track></Stroke>\n` +
  `<Stroke><Outline/><Track><MoveTo x="1024" y="100"/><MoveTo x="1024" y="1900"/></Track></Stroke></Word>`;

test('extractMoeXml unescapes the JS string literal and parseMoeXml reads the char and Track points', () => {
  const x = extractMoeXml(page(xml));
  expect(x?.id).toBe('123');
  expect(x?.xml).toBe(xml);
  const p = parseMoeXml(x!.xml);
  expect(p.char).toBe('十');
  expect(p.tracks).toEqual([[[100, 1024], [1900.5, 1000]], [[1024, 100], [1024, 1900]]]);
});

test('a page without embedded XML is not found', () => {
  expect(extractMoeXml('<html>查無資料</html>')).toBeNull();
});

test('hasVersion2 needs both 有另一種寫法 and an ST=2 link', () => {
  const link = `有另一種寫法：<a href='/dictView.jsp?ID=1&WORD='>1</a> / <a href='/dictView.jsp?ID=1&ST=2&WORD='>2</a>`;
  expect(hasVersion2(page(xml, link))).toBe(true);
  expect(hasVersion2(page(xml))).toBe(false);
  expect(hasVersion2(page(xml, '有另一種寫法'))).toBe(false);
  expect(hasVersion2(page(xml, "<a href='/dictView.jsp?ID=1&ST=2&WORD='>2</a>"))).toBe(false);
});

test('alignToBox maps the bounding box to the unit square: uniform scale on the larger side, centred', () => {
  // Box x 0.2..0.6 (w 0.4), y 0.1..0.3 (h 0.2): scale by 0.4, so y spans 0.25..0.75.
  const out = alignToBox([{ start: [0.2, 0.1], end: [0.6, 0.3] }]);
  expect(out[0]!.start[0]).toBeCloseTo(0); expect(out[0]!.start[1]).toBeCloseTo(0.25);
  expect(out[0]!.end[0]).toBeCloseTo(1); expect(out[0]!.end[1]).toBeCloseTo(0.75);
});

test('alignToBox makes a shifted, scaled copy of a character identical (cost 0 match)', () => {
  const copy = moe.map(t => ({ start: [t.start[0] * 0.7 + 0.1, t.start[1] * 0.7 + 0.05], end: [t.end[0] * 0.7 + 0.1, t.end[1] * 0.7 + 0.05] }) as Track);
  expect(matchStrokes(copy, moe, 0.05).outcome).toBe('nomatch');
  const r = matchStrokes(alignToBox(copy), alignToBox(moe), 0.001);
  expect(r.outcome).toBe('match');
});
