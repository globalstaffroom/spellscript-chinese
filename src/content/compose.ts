import type { StrokeJson } from './types';

export type Box = { minX: number; minY: number; maxX: number; maxY: number };
export type ComposeOp = { remove: number[]; insertAt: number; donor: { char: string; strokes: number[] | 'all' }; targetBox?: Box };
/**
 * `reverse`: stroke indices in the FINAL output order (after ops) whose medians are reversed (point order flipped,
 * so Hanzi Writer expects the stroke drawn the other way). Outlines are unchanged.
 */
export type Recipe = { char: string; baseChar: string | null; ops: ComposeOp[]; reverse?: number[]; note: string };

/** The data with the medians of the given strokes reversed; strokes (outlines) and all other medians untouched. */
export function reverseMedians(data: StrokeJson, idx: number[]): StrokeJson {
  for (const i of idx) {
    if (!Number.isInteger(i) || i < 0 || i >= data.medians.length) throw new Error(`reverse index ${i} out of range (${data.medians.length} strokes)`);
  }
  const rev = new Set(idx);
  return { strokes: [...data.strokes], medians: data.medians.map((m, i) => (rev.has(i) ? [...m].reverse() : m)) };
}

export function medianBox(medians: number[][][]): Box {
  const pts = medians.flat();
  if (!pts.length) throw new Error('medianBox of no points');
  const xs = pts.map(p => p[0]!), ys = pts.map(p => p[1]!);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

const axis = (v: number, a0: number, a1: number, b0: number, b1: number) =>
  a1 === a0 ? (b0 + b1) / 2 : b0 + ((v - a0) * (b1 - b0)) / (a1 - a0);

function mapper(from: Box, to: Box) {
  return (x: number, y: number): [number, number] => [
    Math.round(axis(x, from.minX, from.maxX, to.minX, to.maxX)),
    Math.round(axis(y, from.minY, from.maxY, to.minY, to.maxY)),
  ];
}

/** Path data in these datasets uses only absolute M/L/Q/C/Z, so every number is part of an x,y pair. */
export function transformPath(d: string, f: (x: number, y: number) => [number, number]): string {
  const tokens = d.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g) ?? [];
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (/[A-Za-z]/.test(t)) { out.push(t); continue; }
    const [x, y] = f(Number(t), Number(tokens[++i]));
    out.push(String(x), String(y));
  }
  return out.join(' ');
}

export function compose(base: StrokeJson | null, ops: { op: ComposeOp; donor: StrokeJson }[]): StrokeJson {
  const n = base?.strokes.length ?? 0;
  const removed = new Set<number>();
  const inserts = new Map<number, StrokeJson[]>();
  for (const { op, donor } of ops) {
    for (const i of op.remove) {
      if (i < 0 || i >= n) throw new Error(`remove index ${i} out of range (base has ${n} strokes)`);
      removed.add(i);
    }
    if (op.insertAt < 0 || op.insertAt > n) throw new Error(`insertAt ${op.insertAt} out of range`);
    const idx = op.donor.strokes === 'all' ? donor.strokes.map((_, i) => i) : op.donor.strokes;
    for (const i of idx) if (i < 0 || i >= donor.strokes.length) throw new Error(`donor ${op.donor.char} index ${i} out of range`);
    let to = op.targetBox;
    if (!to) {
      if (!op.remove.length || !base) throw new Error('an op that removes nothing needs a targetBox');
      to = medianBox(op.remove.map(i => base.medians[i]!));
    }
    const f = mapper(medianBox(idx.map(i => donor.medians[i]!)), to);
    const part: StrokeJson = {
      strokes: idx.map(i => transformPath(donor.strokes[i]!, f)),
      medians: idx.map(i => donor.medians[i]!.map(([x, y]) => f(x!, y!))),
    };
    inserts.set(op.insertAt, [...(inserts.get(op.insertAt) ?? []), part]);
  }
  const out: StrokeJson = { strokes: [], medians: [] };
  const flush = (at: number) => {
    for (const p of inserts.get(at) ?? []) { out.strokes.push(...p.strokes); out.medians.push(...p.medians); }
  };
  for (let i = 0; i < n; i++) {
    flush(i);
    if (!removed.has(i)) { out.strokes.push(base!.strokes[i]!); out.medians.push(base!.medians[i]!); }
  }
  flush(n);
  return out;
}
