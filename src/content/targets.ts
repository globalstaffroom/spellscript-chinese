import { writeChars } from './curriculum';
import type { Curriculum, ExtraChar } from './types';

export function collectTargets(curricula: Curriculum[], extras: ExtraChar[]) {
  const targets = new Map<string, number>();
  const conflicts: string[] = [];
  const add = (char: string, n: number) => {
    const prev = targets.get(char);
    if (prev === undefined) targets.set(char, n);
    else if (prev !== n) conflicts.push(`${char}: ${prev} in one source, ${n} in another`);
  };
  for (const c of curricula) for (const w of writeChars(c)) add(w.char, w.totalStrokes);
  for (const e of extras) add(e.char, e.totalStrokes);
  return { targets, conflicts };
}
