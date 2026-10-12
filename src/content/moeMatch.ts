/**
 * Compare our stroke data (Make Me a Hanzi coordinates) with MOE 筆順學習網 stroke tracks by stroke start and end
 * points. Pure: no network, no files. The MOE data itself is CC BY-NC-ND and is only ever read from a local,
 * git-ignored cache by tools/moe-check.ts; nothing here stores it.
 */

export type Pt = [number, number];
/** One stroke reduced to where the pen goes down and where it lifts, in a unit square with y DOWN. */
export type Track = { start: Pt; end: Pt };

/** Our medians: 1024 box, y UP, baseline at y = -124, so screen y = 900 - y. */
export function normaliseOurs(medians: number[][][]): Track[] {
  return medians.map(m => {
    if (m.length < 1) throw new Error('a median with no points');
    const f = (p: number[]): Pt => [p[0]! / 1024, (900 - p[1]!) / 1024];
    return { start: f(m[0]!), end: f(m[m.length - 1]!) };
  });
}

/** MOE track points: 2048 box, y DOWN. */
export function normaliseMoe(tracks: Pt[][]): Track[] {
  return tracks.map(t => {
    if (t.length < 1) throw new Error('an MOE track with no points');
    const f = (p: Pt): Pt => [p[0] / 2048, p[1] / 2048];
    return { start: f(t[0]!), end: f(t[t.length - 1]!) };
  });
}

/**
 * Second-opinion normalisation: map a character's own bounding box (min/max over all start and end points) into the
 * unit square — uniform scale on the larger side, centred on (0.5, 0.5). Removes offset and size differences
 * between our font and MOE's.
 */
export function alignToBox(tracks: Track[]): Track[] {
  const pts = tracks.flatMap(t => [t.start, t.end]);
  if (!pts.length) return [];
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), w = Math.max(...xs) - x0, h = Math.max(...ys) - y0;
  const s = Math.max(w, h) || 1, cx = x0 + w / 2, cy = y0 + h / 2;
  const f = (p: Pt): Pt => [(p[0] - cx) / s + 0.5, (p[1] - cy) / s + 0.5];
  return tracks.map(t => ({ start: f(t.start), end: f(t.end) }));
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const forwardCost = (a: Track, b: Track) => dist(a.start, b.start) + dist(a.end, b.end);
export const reversedCost = (a: Track, b: Track) => dist(a.start, b.end) + dist(a.end, b.start);

/**
 * Minimum-cost assignment for a square cost matrix: result[row] = column. Brute force over all permutations when
 * n <= 8, the Hungarian algorithm otherwise.
 */
export function assign(cost: number[][]): number[] {
  const n = cost.length;
  if (cost.some(r => r.length !== n)) throw new Error('assign needs a square matrix');
  return n <= 8 ? bruteForce(cost) : hungarian(cost);
}

export function bruteForce(cost: number[][]): number[] {
  const n = cost.length;
  let best: number[] = [], bestCost = Infinity;
  const perm: number[] = [], used = new Array<boolean>(n).fill(false);
  const go = (row: number, acc: number) => {
    if (acc >= bestCost) return;
    if (row === n) { bestCost = acc; best = [...perm]; return; }
    for (let c = 0; c < n; c++) {
      if (used[c]) continue;
      used[c] = true; perm.push(c);
      go(row + 1, acc + cost[row]![c]!);
      perm.pop(); used[c] = false;
    }
  };
  go(0, 0);
  return best;
}

/** Hungarian algorithm (Kuhn–Munkres with potentials), O(n^3). */
export function hungarian(cost: number[][]): number[] {
  const n = cost.length;
  const INF = Infinity;
  const u = new Array<number>(n + 1).fill(0), v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0), way = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(INF), used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0]!;
      let delta = INF, j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (cur < minv[j]!) { minv[j] = cur; way[j] = j0; }
        if (minv[j]! < delta) { delta = minv[j]!; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]!] = u[p[j]!]! + delta; v[j] = v[j]! - delta; }
        else minv[j] = minv[j]! - delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]!; p[j0] = p[j1]!; j0 = j1; } while (j0 !== 0);
  }
  const out = new Array<number>(n).fill(-1);
  for (let j = 1; j <= n; j++) if (p[j]! > 0) out[p[j]! - 1] = j - 1;
  return out;
}

export type Outcome = 'match' | 'reorder' | 'reversed' | 'nomatch';
export type MatchResult = {
  outcome: Outcome;
  /** order[k] = our stroke index drawn k-th by MOE (a permutation when outcome is match or reorder). */
  order: number[];
  /** Assigned forward cost per MOE stroke k (pairs our order[k] with MOE k). */
  costs: number[];
  /** MOE stroke indices whose matched stroke of ours runs the other way (outcome reversed). */
  reversedAt: number[];
  reason: string;
};

/**
 * Calibrated 2026-10-12 (brief's starting value 0.18): the largest cost among the founder-verified characters is
 * 0.216 (石), the smallest cost at which a look-alike pair (午↔牛) is accepted is 0.244; 0.23 sits between them.
 * See docs/stroke-check/2026-10-12-moe-check.md.
 */
export const DEFAULT_THRESHOLD = 0.23;

/**
 * Threshold for the aligned (own-bounding-box) second opinion. Calibration 2026-10-12 found NO value that passes
 * the controls: a founder-verified character needs ≥ 0.323 (田) but a look-alike is accepted from 0.258 (午↔牛).
 * moe-check --aligned --apply therefore refuses (controls fail at any threshold); 0.25 is kept only for reporting.
 */
export const ALIGNED_THRESHOLD = 0.25;

/**
 * Match our strokes against MOE strokes.
 * 1. Different counts → nomatch.
 * 2. Optimal assignment on the forward cost; every assigned cost under the threshold → match (identity) or reorder.
 *    A reorder is only claimed when our own order does NOT also fit (some identity-pair cost over the threshold);
 *    if both orders fit, the strokes are too alike to tell apart and the result is nomatch (ambiguous).
 * 3. Otherwise, assignment on min(forward, reversed); if every pair is then under the threshold and some pair only
 *    fits reversed (reversed cost under threshold, forward cost over it) → reversed.
 * 4. Anything else → nomatch.
 */
export function matchStrokes(ours: Track[], moe: Track[], threshold = DEFAULT_THRESHOLD): MatchResult {
  if (ours.length !== moe.length) {
    return { outcome: 'nomatch', order: [], costs: [], reversedAt: [], reason: `stroke count ours ${ours.length} vs MOE ${moe.length}` };
  }
  const n = moe.length;
  // Rows are MOE strokes, columns are ours: assignment[k] = our stroke for MOE stroke k.
  const fwd = moe.map(m => ours.map(o => forwardCost(o, m)));
  const rev = moe.map(m => ours.map(o => reversedCost(o, m)));
  const order = assign(fwd);
  const costs = order.map((o, k) => fwd[k]![o]!);
  const over = costs.map((c, k) => (c > threshold ? k : -1)).filter(k => k >= 0);
  if (!over.length) {
    const identity = order.every((o, k) => o === k);
    if (!identity && moe.every((_, k) => fwd[k]![k]! <= threshold)) {
      return { outcome: 'nomatch', order, costs, reversedAt: [], reason: `ambiguous: both our order and MOE order ${order.join(',')} fit within ${threshold}` };
    }
    return {
      outcome: identity ? 'match' : 'reorder', order, costs, reversedAt: [],
      reason: identity ? 'all strokes match in order' : `same strokes, MOE order ${order.join(',')}`,
    };
  }
  const both = moe.map((_, k) => ours.map((_, o) => Math.min(fwd[k]![o]!, rev[k]![o]!)));
  const order2 = assign(both);
  const costs2 = order2.map((o, k) => both[k]![o]!);
  const reversedAt = order2.map((o, k) => (fwd[k]![o]! > threshold && rev[k]![o]! <= threshold ? k : -1)).filter(k => k >= 0);
  if (costs2.every(c => c <= threshold) && reversedAt.length) {
    return {
      outcome: 'reversed', order: order2, costs: costs2, reversedAt,
      reason: `MOE stroke(s) ${reversedAt.map(k => k + 1).join(', ')} run the other way in our data`,
    };
  }
  return {
    outcome: 'nomatch', order, costs, reversedAt: [],
    reason: `MOE stroke(s) ${over.map(k => `${k + 1} (cost ${costs[k]!.toFixed(2)})`).join(', ')} have no stroke of ours within ${threshold}`,
  };
}

/** The MOE page's embedded stroke XML (a JS string literal `xml[<id>]="…"`), or null if the page has none. */
export function extractMoeXml(html: string): { id: string; xml: string } | null {
  const m = html.match(/xml\[(\d+)\]\s*=\s*("(?:[^"\\]|\\.)*")/);
  if (!m) return null;
  // JS string literal → JSON string literal: \' and \/ are legal in JS but \' is not in JSON.
  const lit = m[2]!.replace(/\\'/g, "'");
  return { id: m[1]!, xml: JSON.parse(lit) as string };
}

/** The character the XML describes, and each stroke's Track points (MoveTo/LineTo x,y in order). */
export function parseMoeXml(xml: string): { char: string | null; tracks: Pt[][] } {
  const char = xml.match(/<Word\b[^>]*\bunicode="([^"]+)"/)?.[1] ?? null;
  const tracks: Pt[][] = [];
  for (const s of xml.match(/<Stroke>[\s\S]*?<\/Stroke>/g) ?? []) {
    const t = s.match(/<Track>([\s\S]*?)<\/Track>/)?.[1];
    if (t === undefined) throw new Error('an MOE stroke with no Track');
    const pts: Pt[] = [];
    for (const el of t.match(/<(?:MoveTo|LineTo)\b[^>]*>/g) ?? []) {
      const x = el.match(/\bx="(-?[\d.]+)"/)?.[1], y = el.match(/\by="(-?[\d.]+)"/)?.[1];
      if (x === undefined || y === undefined) throw new Error(`MOE track point without x/y: ${el}`);
      pts.push([Number(x), Number(y)]);
    }
    if (!pts.length) throw new Error('an MOE Track with no points');
    tracks.push(pts);
  }
  return { char, tracks };
}

/** Does the MOE page offer a second version (「有另一種寫法」 with an ST=2 link)? */
export function hasVersion2(html: string): boolean {
  return html.includes('有另一種寫法') && /dictView\.jsp\?ID=\d+&(?:amp;)?ST=2/.test(html);
}
