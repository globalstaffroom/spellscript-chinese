import { act, render, screen } from '@testing-library/react';
import type { AttemptRecord } from './attempt';
import { WritingPad } from './WritingPad';

type Opts = Record<string, any>;
const h = vi.hoisted(() => ({
  create: vi.fn(), quizOpts: null as Opts | null, quizCalls: [] as Opts[], cancelQuiz: vi.fn(), createOpts: null as Opts | null,
  setCharacter: vi.fn(async (_c: string) => {}), highlightStroke: vi.fn(async (_k: number) => {}),
}));
vi.mock('hanzi-writer', () => ({
  default: {
    create: (el: HTMLElement, char: string, opts: Opts) => {
      h.create(el, char, opts);
      h.createOpts = opts;
      return {
        quiz: (q: Opts) => { h.quizOpts = q; h.quizCalls.push(q); return Promise.resolve(); },
        cancelQuiz: h.cancelQuiz, setCharacter: h.setCharacter, highlightStroke: h.highlightStroke,
      };
    },
  },
}));

const loader = vi.fn(async () => ({ strokes: ['M 0 0 Z'], medians: [[[0, 0], [1, 1]]] }));
const base = { char: '木', profileId: 'p1', context: 'calibration' as const, word: null, expectedChar: null, leniencyInput: 'finger' as const, size: 300, loader, onInputSeen: () => {} };
const stroke = (o: Opts) => ({ character: '木', strokeNum: 0, mistakesOnStroke: 0, totalMistakes: 0, strokesRemaining: 3, isBackwards: false, drawnPath: { pathString: '', points: [{ x: 1, y: 1 }] }, ...o });

beforeEach(() => {
  h.quizOpts = null; h.quizCalls = []; h.cancelQuiz.mockClear(); loader.mockClear();
  h.setCharacter.mockReset(); h.setCharacter.mockImplementation(async () => {}); h.highlightStroke.mockClear();
});

test('starts the quiz with the tier settings and never auto-accepts', async () => {
  render(<WritingPad {...base} tier="master" onFinish={() => {}} />);
  await act(async () => {});
  expect(h.createOpts?.showOutline).toBe(false);
  expect(h.createOpts?.showCharacter).toBe(false);
  expect(h.quizOpts).toMatchObject({ showHintAfterMisses: 3, acceptBackwardsStrokes: false, markStrokeCorrectAfterMisses: false });
});

test('reaching the tier mistake limit cancels the quiz and reports failed', async () => {
  const done: AttemptRecord[] = [];
  render(<WritingPad {...base} tier="master" onFinish={r => done.push(r)} />);
  await act(async () => {});
  act(() => { h.quizOpts!.onMistake(stroke({ mistakesOnStroke: 1, totalMistakes: 1 })); });
  expect(done).toHaveLength(0);
  act(() => { h.quizOpts!.onMistake(stroke({ mistakesOnStroke: 2, totalMistakes: 2 })); });
  expect(h.cancelQuiz).toHaveBeenCalledTimes(1);
  expect(done.map(d => d.result)).toEqual(['failed']);
});

test('completing the quiz reports passed exactly once', async () => {
  const done: AttemptRecord[] = [];
  render(<WritingPad {...base} tier="practice" onFinish={r => done.push(r)} />);
  await act(async () => {});
  act(() => { h.quizOpts!.onCorrectStroke(stroke({ strokesRemaining: 0 })); h.quizOpts!.onComplete({ character: '木', totalMistakes: 0 }); });
  expect(done.map(d => [d.result, d.strokes.length])).toEqual([['passed', 1]]);
});

test('leaving mid-character saves the attempt as abandoned (Review Focus 4)', async () => {
  const done: AttemptRecord[] = [];
  const { unmount } = render(<WritingPad {...base} tier="practice" onFinish={r => done.push(r)} />);
  await act(async () => {});
  act(() => { h.quizOpts!.onCorrectStroke(stroke({})); });
  unmount();
  expect(done.map(d => d.result)).toEqual(['abandoned']);
});

test('leaving before any stroke saves nothing', async () => {
  const done: AttemptRecord[] = [];
  const { unmount } = render(<WritingPad {...base} tier="practice" onFinish={r => done.push(r)} />);
  await act(async () => {});
  unmount();
  expect(done).toEqual([]);
});

test('a palm touchend during Pencil use never reaches Hanzi Writer (Review Focus 1)', async () => {
  render(<WritingPad {...base} tier="practice" onFinish={() => {}} />);
  await act(async () => {});
  const pad = screen.getByTestId('writing-pad');
  const reached = vi.fn();
  const ups = vi.fn();
  document.addEventListener('mouseup', ups);
  document.addEventListener('touchend', reached); // Hanzi Writer listens on document
  const touch = (type: string, touchType: string) => {
    const e = new Event(type, { bubbles: true, cancelable: true }) as any;
    const list = [{ identifier: touchType === 'stylus' ? 2 : 1, clientX: 10, clientY: 10, touchType }];
    e.touches = type === 'touchend' ? [] : list; e.changedTouches = list;
    return e;
  };
  pad.dispatchEvent(touch('touchstart', 'stylus'));
  pad.dispatchEvent(touch('touchstart', 'direct')); // the palm lands on the pad too
  pad.dispatchEvent(touch('touchend', 'direct'));
  expect(reached).not.toHaveBeenCalled();
  expect(ups).not.toHaveBeenCalled(); // the palm lifting did not end the Pencil stroke
  pad.dispatchEvent(touch('touchend', 'stylus'));
  expect(reached).not.toHaveBeenCalled(); // Hanzi Writer is ended by a synthetic mouseup, never a native touchend
  expect(ups).toHaveBeenCalledTimes(1);
  document.removeEventListener('touchend', reached);
  document.removeEventListener('mouseup', ups);
});

test('missing stroke data shows a message instead of a blank pad', async () => {
  render(<WritingPad {...base} tier="practice" loader={async () => { throw new Error('404'); }} onFinish={() => {}} />);
  await act(async () => {});
  expect(screen.getByRole('alert').textContent).toContain('找不到「木」的筆順資料');
});

type T = { id: number; type: 'stylus' | 'direct'; x?: number };
const ev = (type: string, changed: T[], all: T[] = changed) => {
  const e = new Event(type, { bubbles: true, cancelable: true }) as any;
  const mk = (t: T) => ({ identifier: t.id, clientX: t.x ?? 10, clientY: 10, touchType: t.type });
  e.touches = all.map(mk); e.changedTouches = changed.map(mk);
  return e;
};
const PEN: T = { id: 2, type: 'stylus' };
const PALM: T = { id: 1, type: 'direct' };

test('native touches never reach Hanzi Writer', async () => {
  const seen: string[] = [];
  const { container } = render(<WritingPad {...base} tier="practice" onFinish={() => {}} />);
  await act(async () => {});
  const hw = container.querySelector('[data-hw]')!;
  hw.addEventListener('touchstart', () => seen.push('start'));
  hw.addEventListener('touchmove', () => seen.push('move'));
  hw.dispatchEvent(ev('touchstart', [PEN]));
  hw.dispatchEvent(ev('touchmove', [PEN]));
  expect(seen).toEqual([]);
});

test('a palm and the Pencil lifting together end the stroke exactly once', async () => {
  const { container } = render(<WritingPad {...base} tier="practice" onFinish={() => {}} />);
  await act(async () => {});
  const pad = screen.getByTestId('writing-pad');
  const ups = vi.fn(); const nativeEnd = vi.fn();
  document.addEventListener('mouseup', ups); document.addEventListener('touchend', nativeEnd);
  pad.dispatchEvent(ev('touchstart', [PEN]));
  pad.dispatchEvent(ev('touchstart', [PALM], [PEN, PALM]));
  pad.dispatchEvent(ev('touchend', [PALM, PEN], [PALM, PEN]));
  document.removeEventListener('mouseup', ups); document.removeEventListener('touchend', nativeEnd);
  expect(ups).toHaveBeenCalledTimes(1);
  expect(nativeEnd).not.toHaveBeenCalled();
  expect(container).toBeTruthy();
});

test('a palm already down loses to the Pencil, which is drawn at its own position', async () => {
  const kinds: string[] = []; const downs: number[] = []; const ups = vi.fn();
  const { container } = render(<WritingPad {...base} tier="practice" onInputSeen={k => kinds.push(k)} onFinish={() => {}} />);
  await act(async () => {});
  const pad = screen.getByTestId('writing-pad');
  container.querySelector('[data-hw]')!.addEventListener('mousedown', e => downs.push((e as MouseEvent).clientX));
  document.addEventListener('mouseup', ups);
  pad.dispatchEvent(ev('touchstart', [PALM]));
  pad.dispatchEvent(ev('touchstart', [{ ...PEN, x: 200 }], [PALM, { ...PEN, x: 200 }]));
  document.removeEventListener('mouseup', ups);
  expect(ups).toHaveBeenCalledTimes(1);
  expect(downs).toEqual([10, 200]);
  expect(kinds.at(-1)).toBe('pen');
});

test('while a Pencil stroke is active, an off-pad touchend or touchcancel never reaches Hanzi Writer (Critical 1)', async () => {
  render(<WritingPad {...base} tier="practice" onFinish={() => {}} />);
  await act(async () => {});
  const pad = screen.getByTestId('writing-pad');
  const outside = document.createElement('div'); document.body.appendChild(outside);
  const reached = vi.fn(); const ups = vi.fn();
  // Registered after the pad mounted, as Hanzi Writer's own document listener is.
  document.addEventListener('touchend', reached); document.addEventListener('touchcancel', reached);
  document.addEventListener('mouseup', ups);
  pad.dispatchEvent(ev('touchstart', [PEN]));
  outside.dispatchEvent(ev('touchend', [{ id: 9, type: 'direct' }], [PEN])); // a palm mostly off the pad lifts
  outside.dispatchEvent(ev('touchcancel', [{ id: 8, type: 'direct' }], [PEN]));
  document.dispatchEvent(ev('touchend', [{ id: 7, type: 'direct' }], [PEN]));
  document.removeEventListener('touchend', reached); document.removeEventListener('touchcancel', reached);
  document.removeEventListener('mouseup', ups);
  outside.remove();
  expect(reached).not.toHaveBeenCalled();
  expect(ups).not.toHaveBeenCalled(); // the Pencil stroke is still going
});

test('with no pad stroke active, an off-pad touchend still reaches the page', async () => {
  render(<WritingPad {...base} tier="practice" onFinish={() => {}} />);
  await act(async () => {});
  const pad = screen.getByTestId('writing-pad');
  const reached = vi.fn();
  document.addEventListener('touchend', reached);
  pad.dispatchEvent(ev('touchstart', [PEN]));
  pad.dispatchEvent(ev('touchend', [PEN], []));
  document.dispatchEvent(ev('touchend', [{ id: 9, type: 'direct' }], []));
  document.removeEventListener('touchend', reached);
  expect(reached).toHaveBeenCalledTimes(1);
});

test('after the Pencil was used, a finger touch is ignored for the rest of the attempt, even after a pause (Important 3)', async () => {
  const kinds: string[] = []; const downs = vi.fn();
  const { container } = render(<WritingPad {...base} tier="practice" onInputSeen={k => kinds.push(k)} onFinish={() => {}} />);
  await act(async () => {});
  const pad = screen.getByTestId('writing-pad');
  container.querySelector('[data-hw]')!.addEventListener('mousedown', downs);
  let now = 1000;
  const clock = vi.spyOn(performance, 'now').mockImplementation(() => now);
  try {
    pad.dispatchEvent(ev('touchstart', [PEN]));
    pad.dispatchEvent(ev('touchend', [PEN], []));
    expect(downs).toHaveBeenCalledTimes(1);
    now += 5000; // well past the 1.5 s pen grace
    pad.dispatchEvent(ev('touchstart', [PALM]));
    expect(downs).toHaveBeenCalledTimes(1);
    expect(kinds).toEqual(['pen']);
  } finally { clock.mockRestore(); }
});

test('a native mouse event right after a touch is hidden from Hanzi Writer; a synthetic one is not', async () => {
  const { container } = render(<WritingPad {...base} tier="practice" onFinish={() => {}} />);
  await act(async () => {});
  const pad = screen.getByTestId('writing-pad');
  const hw = container.querySelector('[data-hw]')!;
  const downs = vi.fn(); hw.addEventListener('mousedown', downs);
  pad.dispatchEvent(ev('touchstart', [PEN]));
  expect(downs).toHaveBeenCalledTimes(1); // synthetic
  hw.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  expect(downs).toHaveBeenCalledTimes(1); // native compatibility event blocked
});

// ---- Alternate MOE stroke orders (方: primary 0,1,2,3; MOE version 2 is 0,1,3,2, diverging at stroke 2) ----
const fangData = { strokes: ['S0', 'S1', 'S2', 'S3'], medians: [[[0, 0], [0, 1]], [[1, 0], [1, 1]], [[2, 0], [2, 1]], [[3, 0], [3, 1]]] };
const fangLoader = vi.fn(async () => fangData);
const fang = { ...base, char: '方', loader: fangLoader, alternates: [[0, 1, 3, 2]] };
const fstroke = (o: Opts) => stroke({ character: '方', ...o });

/** Renders 方 with the pad at a movable screen position; `verdict` plays Hanzi Writer's reply to the replayed stroke. */
async function mountFang(tier: 'apprentice' | 'practice' = 'practice') {
  fangLoader.mockClear();
  const done: AttemptRecord[] = [];
  const view = render(<WritingPad {...fang} tier={tier} onFinish={r => done.push(r)} />);
  await act(async () => {});
  const pad = screen.getByTestId('writing-pad');
  const rect = { left: 100, top: 50 };
  vi.spyOn(pad, 'getBoundingClientRect').mockImplementation(() => ({ left: rect.left, top: rect.top, x: rect.left, y: rect.top, width: 300, height: 300, right: 0, bottom: 0, toJSON: () => ({}) }));
  const hw = view.container.querySelector('[data-hw]')!;
  const at = (type: string, x: number, y: number) => {
    const e = new Event(type, { bubbles: true, cancelable: true }) as any;
    const t = [{ identifier: 5, clientX: x, clientY: y, touchType: 'direct' }];
    e.touches = type === 'touchend' ? [] : t; e.changedTouches = t;
    return e;
  };
  /** The child draws one stroke on the pad (raw points are pad-local). */
  const draw = (pts: [number, number][]) => {
    pad.dispatchEvent(at('touchstart', ...pts[0]!));
    for (const p of pts.slice(1)) pad.dispatchEvent(at('touchmove', ...p));
    pad.dispatchEvent(at('touchend', ...pts.at(-1)!));
  };
  const seen: string[] = [];
  const verdict = { fn: null as null | (() => void) };
  const watch = () => {
    hw.addEventListener('mousedown', e => seen.push(`down ${(e as MouseEvent).clientX},${(e as MouseEvent).clientY}`));
    hw.addEventListener('mousemove', e => seen.push(`move ${(e as MouseEvent).clientX},${(e as MouseEvent).clientY}`));
  };
  const onUp = () => { seen.push('up'); const f = verdict.fn; verdict.fn = null; f?.(); }; // Hanzi Writer grades on document mouseup
  document.addEventListener('mouseup', onUp);
  const cleanup = () => document.removeEventListener('mouseup', onUp);
  return { ...view, done, pad, rect, hw, draw, seen, verdict, watch, cleanup };
}

test('a mistake at the divergence stroke is held, the order switched and the stroke replayed; accepted means no mistake', async () => {
  const f = await mountFang();
  act(() => { h.quizOpts!.onCorrectStroke(fstroke({ strokeNum: 0 })); h.quizOpts!.onCorrectStroke(fstroke({ strokeNum: 1 })); });
  f.draw([[110, 60], [130, 80], [140, 95]]); // raw (10,10) (30,30) (40,45)
  f.watch();
  f.seen.length = 0;
  f.rect.left = 120; // the layout moved: the replay must use the pad's current position
  f.verdict.fn = () => h.quizOpts!.onCorrectStroke(fstroke({ strokeNum: 2 }));
  await act(async () => { h.quizOpts!.onMistake(fstroke({ strokeNum: 2, mistakesOnStroke: 1, totalMistakes: 1 })); });
  expect(h.setCharacter).toHaveBeenCalledWith('方');
  expect(h.quizCalls).toHaveLength(2);
  expect(h.quizCalls[1]).toMatchObject({ quizStartStrokeNum: 2, markStrokeCorrectAfterMisses: false });
  expect(f.seen).toEqual(['down 130,60', 'move 150,80', 'move 160,95', 'up']);
  act(() => { h.quizOpts!.onCorrectStroke(fstroke({ strokeNum: 3 })); h.quizOpts!.onComplete({ character: '方', totalMistakes: 0 }); });
  f.cleanup();
  expect(f.done).toHaveLength(1);
  const r = f.done[0]!;
  expect(r.strokes.map(s => [s.strokeNum, s.accepted])).toEqual([[0, true], [1, true], [2, true], [3, true]]);
  expect(r.strokes[2]!.raw?.points.map(p => [p.x, p.y])).toEqual([[10, 10], [30, 30], [40, 45]]);
  expect(r.totalMistakes).toBe(0);
  expect(r.order).toEqual([0, 1, 3, 2]);
  expect(r.result).toBe('passed');
});

test('after the switch, the character data Hanzi Writer loads is the permuted base data, from the one load', async () => {
  const f = await mountFang();
  const load = () => new Promise<typeof fangData>(res => h.createOpts!.charDataLoader('方', res, () => {}));
  expect((await load()).medians).toEqual(fangData.medians);
  f.draw([[110, 60], [130, 80]]);
  f.verdict.fn = () => h.quizOpts!.onCorrectStroke(fstroke({ strokeNum: 2 }));
  await act(async () => { h.quizOpts!.onMistake(fstroke({ strokeNum: 2, mistakesOnStroke: 1, totalMistakes: 1 })); });
  f.cleanup();
  const d = await load();
  expect(d.medians).toEqual([fangData.medians[0], fangData.medians[1], fangData.medians[3], fangData.medians[2]]);
  expect(d.strokes).toEqual(['S0', 'S1', 'S3', 'S2']);
  expect(fangLoader).toHaveBeenCalledTimes(1);
});

test('a replay rejected under the alternate too is one mistake; the pad switches back and never switches again on that stroke', async () => {
  const f = await mountFang();
  f.draw([[110, 60], [130, 80]]);
  f.verdict.fn = () => h.quizOpts!.onMistake(fstroke({ strokeNum: 2, mistakesOnStroke: 1, totalMistakes: 1 }));
  await act(async () => { h.quizOpts!.onMistake(fstroke({ strokeNum: 2, mistakesOnStroke: 1, totalMistakes: 1 })); });
  expect(h.quizCalls).toHaveLength(3);
  expect(h.quizCalls[2]).toMatchObject({ quizStartStrokeNum: 2 });
  expect(h.setCharacter).toHaveBeenCalledTimes(2);
  const data = await new Promise<typeof fangData>(res => h.createOpts!.charDataLoader('方', res, () => {}));
  expect(data.strokes).toEqual(fangData.strokes); // back on the textbook order
  f.draw([[110, 60], [150, 90]]);
  await act(async () => { h.quizOpts!.onMistake(fstroke({ strokeNum: 2, mistakesOnStroke: 1, totalMistakes: 1 })); });
  expect(h.setCharacter).toHaveBeenCalledTimes(2);
  expect(h.quizCalls).toHaveLength(3);
  f.unmount(); f.cleanup();
  const r = f.done[0]!;
  expect(r.result).toBe('abandoned');
  expect(r.strokes.map(s => [s.strokeNum, s.accepted])).toEqual([[2, false], [2, false]]);
  expect(r.strokes[0]!.raw?.points.map(p => [p.x, p.y])).toEqual([[10, 10], [30, 30]]);
  expect(r.totalMistakes).toBe(2);
  expect(r.order).toBeNull();
});

test('after switching back, the hint the textbook order earned is shown (見習: hint after 1 miss)', async () => {
  const f = await mountFang('apprentice');
  f.draw([[110, 60], [130, 80]]);
  f.verdict.fn = () => h.quizOpts!.onMistake(fstroke({ strokeNum: 2, mistakesOnStroke: 1, totalMistakes: 1 }));
  await act(async () => { h.quizOpts!.onMistake(fstroke({ strokeNum: 2, mistakesOnStroke: 1, totalMistakes: 1 })); });
  f.cleanup();
  expect(h.highlightStroke).toHaveBeenCalledWith(2);
});

test('a mistake that is not at a divergence stroke is recorded and never switches the order', async () => {
  const f = await mountFang();
  f.draw([[110, 60], [130, 80]]);
  await act(async () => { h.quizOpts!.onMistake(fstroke({ strokeNum: 1, mistakesOnStroke: 1, totalMistakes: 1 })); });
  f.unmount(); f.cleanup();
  expect(h.setCharacter).not.toHaveBeenCalled();
  expect(h.quizCalls).toHaveLength(1);
  expect(f.done[0]!.totalMistakes).toBe(1);
});

test('while the switch is in flight a new stroke does not start', async () => {
  const f = await mountFang();
  let release!: () => void;
  h.setCharacter.mockImplementationOnce(() => new Promise<void>(res => { release = res; }));
  f.draw([[110, 60], [130, 80]]);
  await act(async () => { h.quizOpts!.onMistake(fstroke({ strokeNum: 2, mistakesOnStroke: 1, totalMistakes: 1 })); });
  f.watch();
  f.seen.length = 0;
  f.draw([[200, 200], [210, 210]]);
  f.hw.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
  expect(f.seen).toEqual([]);
  f.verdict.fn = () => h.quizOpts!.onCorrectStroke(fstroke({ strokeNum: 2 }));
  await act(async () => { release(); });
  f.unmount(); f.cleanup();
  expect(f.done[0]!.strokes.map(s => s.raw?.points[0])).toEqual([{ x: 10, y: 10, t: expect.any(Number) }]);
});

test('if reloading in the alternate order fails, the held stroke is a normal mistake and the pad stays on the primary order', async () => {
  const f = await mountFang();
  h.setCharacter.mockImplementation(async () => { throw new Error('load failed'); });
  f.draw([[110, 60], [130, 80]]);
  await act(async () => { h.quizOpts!.onMistake(fstroke({ strokeNum: 2, mistakesOnStroke: 1, totalMistakes: 1 })); });
  f.unmount(); f.cleanup();
  const r = f.done[0]!;
  expect(r.strokes.map(s => [s.strokeNum, s.accepted])).toEqual([[2, false]]);
  expect(r.totalMistakes).toBe(1);
  expect(r.order).toBeNull();
  const data = await new Promise<typeof fangData>(res => h.createOpts!.charDataLoader('方', res, () => {}));
  expect(data.strokes).toEqual(fangData.strokes);
});

test('while the switch is in flight a mouse press does not reach Hanzi Writer or start a recorded stroke', async () => {
  const f = await mountFang();
  let release!: () => void;
  h.setCharacter.mockImplementationOnce(() => new Promise<void>(res => { release = res; }));
  const mouse = (type: string, target: EventTarget, x: number, y: number) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  mouse('mousedown', f.hw, 110, 60); mouse('mousemove', f.hw, 130, 80); mouse('mouseup', document, 130, 80); // a mouse-only session: no touch
  await act(async () => { h.quizOpts!.onMistake(fstroke({ strokeNum: 2, mistakesOnStroke: 1, totalMistakes: 1 })); });
  f.watch();
  f.seen.length = 0;
  mouse('mousedown', f.hw, 200, 200);
  mouse('mousemove', f.hw, 210, 210);
  expect(f.seen.filter(s => s.startsWith('down'))).toEqual([]);
  mouse('mouseup', document, 210, 210);
  f.verdict.fn = () => h.quizOpts!.onCorrectStroke(fstroke({ strokeNum: 2 }));
  await act(async () => { release(); });
  act(() => { h.quizOpts!.onCorrectStroke(fstroke({ strokeNum: 3 })); });
  f.unmount(); f.cleanup();
  // The held stroke was replayed and accepted; the press during the switch left no raw stroke to pair with stroke 3.
  expect(f.done[0]!.strokes.map(s => [s.strokeNum, s.raw?.input ?? null])).toEqual([[2, 'mouse'], [3, null]]);
});
