import { RawStrokeQueue } from './rawStrokes';

const p = (x: number, t: number) => ({ x, y: 0, t });

test('completed strokes come out in order with their input kind', () => {
  const q = new RawStrokeQueue();
  q.begin('pen', p(0, 0)); q.move(p(1, 10)); q.end();
  q.begin('finger', p(5, 20)); q.move(p(6, 30)); q.end();
  expect(q.take()).toEqual({ input: 'pen', points: [p(0, 0), p(1, 10)] });
  expect(q.take()?.input).toBe('finger');
  expect(q.take()).toBeNull();
});

test('a tap without moving is dropped, as Hanzi Writer drops it, so later strokes stay aligned', () => {
  const q = new RawStrokeQueue();
  q.begin('finger', p(0, 0)); q.end();                        // tap: Hanzi Writer fires no callback
  q.begin('finger', p(1, 1)); q.move(p(2, 2)); q.end();       // real stroke
  expect(q.pending).toBe(1);
  expect(q.take()?.points[0]).toEqual(p(1, 1));
});

test('move or end without begin is ignored', () => {
  const q = new RawStrokeQueue();
  q.move(p(1, 1)); q.end();
  expect(q.take()).toBeNull();
});

test('a second start while a stroke is open closes it and starts nothing, as Hanzi Writer does', () => {
  const q = new RawStrokeQueue();
  q.begin('pen', p(0, 0)); q.move(p(1, 10));
  q.begin('pen', p(2, 20));                                    // closes the first stroke, starts nothing
  q.move(p(3, 30));                                            // ignored: no stroke is open
  q.end();                                                     // no-op
  expect(q.pending).toBe(1);
  expect(q.take()).toEqual({ input: 'pen', points: [p(0, 0), p(1, 10)] });
  expect(q.take()).toBeNull();
});
