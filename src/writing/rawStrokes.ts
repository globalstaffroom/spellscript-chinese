import type { InputKind } from './tiers';

export type RawPoint = { x: number; y: number; t: number };
export type RawStroke = { input: InputKind; points: RawPoint[] };

/**
 * Records the child's actual strokes with timestamps. Hanzi Writer reports each evaluated stroke through a callback
 * but skips single-point taps without one, so taps are dropped here too. That keeps take() paired with the callbacks.
 */
export class RawStrokeQueue {
  private current: RawStroke | null = null;
  private done: RawStroke[] = [];
  begin(input: InputKind, p: RawPoint) { this.current = { input, points: [p] }; }
  move(p: RawPoint) { this.current?.points.push(p); }
  end() {
    if (this.current && this.current.points.length > 1) this.done.push(this.current);
    this.current = null;
  }
  take(): RawStroke | null { return this.done.shift() ?? null; }
  get pending() { return this.done.length; }
}
