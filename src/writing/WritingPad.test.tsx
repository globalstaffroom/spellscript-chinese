import { act, render, screen } from '@testing-library/react';
import type { AttemptRecord } from './attempt';
import { WritingPad } from './WritingPad';

type Opts = Record<string, any>;
const h = vi.hoisted(() => ({ create: vi.fn(), quizOpts: null as Opts | null, cancelQuiz: vi.fn(), createOpts: null as Opts | null }));
vi.mock('hanzi-writer', () => ({
  default: {
    create: (el: HTMLElement, char: string, opts: Opts) => {
      h.create(el, char, opts);
      h.createOpts = opts;
      return { quiz: (q: Opts) => { h.quizOpts = q; return Promise.resolve(); }, cancelQuiz: h.cancelQuiz };
    },
  },
}));

const loader = vi.fn(async () => ({ strokes: ['M 0 0 Z'], medians: [[[0, 0], [1, 1]]] }));
const base = { char: '木', profileId: 'p1', context: 'calibration' as const, word: null, expectedChar: null, leniencyInput: 'finger' as const, size: 300, loader, onInputSeen: () => {} };
const stroke = (o: Opts) => ({ character: '木', strokeNum: 0, mistakesOnStroke: 0, totalMistakes: 0, strokesRemaining: 3, isBackwards: false, drawnPath: { pathString: '', points: [{ x: 1, y: 1 }] }, ...o });

beforeEach(() => { h.quizOpts = null; h.cancelQuiz.mockClear(); loader.mockClear(); });

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

test('a finger that started outside the pad still reaches the page after the Pencil was used', async () => {
  render(<WritingPad {...base} tier="practice" onFinish={() => {}} />);
  await act(async () => {});
  const pad = screen.getByTestId('writing-pad');
  const reached = vi.fn();
  document.addEventListener('touchend', reached);
  pad.dispatchEvent(ev('touchstart', [PEN]));
  document.dispatchEvent(ev('touchend', [{ id: 9, type: 'direct' }]));
  document.removeEventListener('touchend', reached);
  expect(reached).toHaveBeenCalledTimes(1);
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
