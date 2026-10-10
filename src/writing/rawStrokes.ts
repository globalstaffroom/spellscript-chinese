import type { InputKind } from './tiers';

/** `t` is milliseconds since the attempt started (performance.now() relative), as WritingPad sets it. */
export type RawPoint = { x: number; y: number; t: number };
export type RawStroke = { input: InputKind; points: RawPoint[] };

/**
 * Records the child's actual strokes with timestamps, so take() pairs with Hanzi Writer's per-stroke callbacks.
 *
 * Mirrors Hanzi Writer 3.7.3 Quiz.startUserStroke: a single-point stroke (a tap) is dropped, and a second begin()
 * while a stroke is open ends that stroke and starts nothing, so the point that began it is not recorded.
 *
 * Contract: one queue per attempt. WritingPad creates a fresh queue for each attempt and discards it when the
 * attempt ends. There is no reset method.
 */
export class RawStrokeQueue {
  private current: RawStroke | null = null;
  private done: RawStroke[] = [];
  begin(input: InputKind, p: RawPoint) {
    if (this.current) { this.end(); return; }
    this.current = { input, points: [p] };
  }
  move(p: RawPoint) { this.current?.points.push(p); }
  end() {
    if (this.current && this.current.points.length > 1) this.done.push(this.current);
    this.current = null;
  }
  take(): RawStroke | null { return this.done.shift() ?? null; }
  get pending() { return this.done.length; }
}
