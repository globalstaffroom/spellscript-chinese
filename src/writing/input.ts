import type { InputKind } from './tiers';

export type TouchKind = 'stylus' | 'direct';
export const PEN_GRACE_MS = 1500;

export function touchKinds(list: TouchList | ArrayLike<{ touchType?: string }>): TouchKind[] {
  return Array.from(list as ArrayLike<{ touchType?: string }>, t => (t.touchType === 'stylus' ? 'stylus' : 'direct'));
}

export function classifyPointer(pointerType: string): InputKind | null {
  if (pointerType === 'pen') return 'pen';
  if (pointerType === 'touch') return 'finger';
  if (pointerType === 'mouse') return 'mouse';
  return null;
}

export function classifyTouch(kinds: TouchKind[]): InputKind | null {
  if (!kinds.length) return null;
  return kinds[0] === 'stylus' ? 'pen' : 'finger';
}

/** While the Pencil is in use, ignore finger touches: they are almost always a resting palm (spec §5). */
export class PalmFilter {
  private lastPen = -Infinity;
  notePen(now: number) { this.lastPen = now; }
  shouldBlock(e: { primary: TouchKind | undefined; now: number }): boolean {
    return e.primary === 'direct' && e.now - this.lastPen <= PEN_GRACE_MS;
  }
}
