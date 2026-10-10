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
  document.addEventListener('touchend', reached); // Hanzi Writer listens on document
  const touch = (type: string, touchType: string) => {
    const e = new Event(type, { bubbles: true, cancelable: true }) as any;
    const list = [{ clientX: 10, clientY: 10, touchType }];
    e.touches = type === 'touchend' ? [] : list; e.changedTouches = list;
    return e;
  };
  pad.dispatchEvent(touch('touchstart', 'stylus'));
  pad.dispatchEvent(touch('touchend', 'direct'));
  expect(reached).not.toHaveBeenCalled();
  pad.dispatchEvent(touch('touchend', 'stylus'));
  expect(reached).toHaveBeenCalledTimes(1);
  document.removeEventListener('touchend', reached);
});

test('missing stroke data shows a message instead of a blank pad', async () => {
  render(<WritingPad {...base} tier="practice" loader={async () => { throw new Error('404'); }} onFinish={() => {}} />);
  await act(async () => {});
  expect(screen.getByRole('alert').textContent).toContain('找不到「木」的筆順資料');
});
