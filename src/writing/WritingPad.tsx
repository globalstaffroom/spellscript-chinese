import HanziWriter from 'hanzi-writer';
import { useEffect, useRef, useState } from 'react';
import { loadStrokeJson } from '../content/strokeFiles';
import type { StrokeJson } from '../content/types';
import { newId } from '../storage/profiles';
import { finishAttempt, isOverMistakeLimit, recordStroke, startAttempt, type AttemptContext, type AttemptRecord, type AttemptState } from './attempt';
import { PalmFilter, classifyPointer, classifyTouch, touchKinds } from './input';
import { RawStrokeQueue } from './rawStrokes';
import { quizOptionsFor, showOutlineFor, type InputKind, type TierId } from './tiers';

type Props = {
  char: string;
  tier: TierId;
  profileId: string;
  context: AttemptContext;
  word: string | null;
  expectedChar: string | null;
  leniencyInput: InputKind;
  size: number;
  onFinish: (r: AttemptRecord) => void;
  onInputSeen: (k: InputKind) => void;
  loader?: (char: string) => Promise<StrokeJson>;
};

type HwStroke = { strokeNum: number; mistakesOnStroke: number; totalMistakes: number; isBackwards: boolean; drawnPath: { points: { x: number; y: number }[] } };

export function WritingPad(p: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(p);
  latest.current = p;

  useEffect(() => {
    const el = host.current!;
    const t0 = performance.now();
    const queue = new RawStrokeQueue();
    const palm = new PalmFilter();
    let state: AttemptState | null = startAttempt({
      id: newId(), profileId: p.profileId, char: p.char, expectedChar: p.expectedChar, word: p.word, context: p.context,
      tier: p.tier, leniencyInput: p.leniencyInput, outlineVisible: showOutlineFor(p.tier), now: Date.now(),
    });
    let finished = false;
    const finish = (result: AttemptRecord['result']) => {
      if (finished || !state) return;
      finished = true;
      latest.current.onFinish(finishAttempt(state, result, Date.now()));
    };
    const local = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      return { x: x - r.left, y: y - r.top, t: Math.round(performance.now() - t0) };
    };

    // Capture-phase listeners on the host run before Hanzi Writer's listeners on its inner node (start, move), and the
    // window capture listener runs before its document listener (end). Blocking here keeps palms out of its strokes.
    const onTouchStart = (e: TouchEvent) => {
      lastTouch = performance.now();
      const kinds = touchKinds(e.touches);
      if (kinds[0] === 'stylus') palm.notePen(performance.now());
      if (palm.shouldBlock({ primary: kinds[0], now: performance.now() })) { e.stopPropagation(); e.preventDefault(); return; }
      const kind = classifyTouch(kinds) ?? 'finger';
      latest.current.onInputSeen(kind);
      const t = e.touches[0]!;
      queue.begin(kind, local(t.clientX, t.clientY));
    };
    const onTouchMove = (e: TouchEvent) => {
      const kinds = touchKinds(e.touches);
      if (kinds[0] === 'stylus') palm.notePen(performance.now());
      if (palm.shouldBlock({ primary: kinds[0], now: performance.now() })) { e.stopPropagation(); e.preventDefault(); return; }
      const t = e.touches[0];
      if (t) queue.move(local(t.clientX, t.clientY));
    };
    const onTouchEnd = (e: TouchEvent) => {
      lastTouch = performance.now();
      const kinds = touchKinds(e.changedTouches);
      if (palm.shouldBlock({ primary: kinds[0], now: performance.now() })) { e.stopPropagation(); return; }
      if (kinds[0] === 'stylus') palm.notePen(performance.now());
      queue.end();
    };
    // Safari fires compatibility mouse events after a touch; recording them would add a phantom stroke to the queue.
    let lastTouch = -Infinity;
    let mouseDown = false;
    const onMouseDown = (e: MouseEvent) => {
      if (performance.now() - lastTouch < 800) return;
      mouseDown = true;
      latest.current.onInputSeen('mouse');
      queue.begin('mouse', local(e.clientX, e.clientY));
    };
    const onMouseMove = (e: MouseEvent) => { if (mouseDown) queue.move(local(e.clientX, e.clientY)); };
    const onMouseUp = () => { if (mouseDown) { mouseDown = false; queue.end(); } };
    const onPointerDown = (e: PointerEvent) => { if (classifyPointer(e.pointerType) === 'pen') palm.notePen(performance.now()); };

    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
    el.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    window.addEventListener('touchend', onTouchEnd, true);
    el.addEventListener('mousedown', onMouseDown, true);
    el.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('mouseup', onMouseUp, true);

    const onStroke = (isCorrect: boolean) => (s: HwStroke) => {
      if (!state || finished) return;
      state = recordStroke(state, {
        strokeNum: s.strokeNum, isCorrect, isBackwards: s.isBackwards, mistakesOnStroke: s.mistakesOnStroke,
        totalMistakes: s.totalMistakes, drawn: s.drawnPath.points.map(({ x, y }) => ({ x, y })),
      }, queue.take());
      if (!isCorrect && isOverMistakeLimit(state)) { writer.cancelQuiz(); finish('failed'); }
    };

    const loader = p.loader ?? loadStrokeJson;
    // Start the load here (not only inside Hanzi Writer) so a missing file always shows the message; Hanzi Writer reuses this promise.
    let disposed = false;
    const first = loader(p.char);
    first.catch(() => { if (!disposed) setError(`找不到「${p.char}」的筆順資料`); });
    const hwEl = el.querySelector<HTMLDivElement>('[data-hw]')!;
    const writer = HanziWriter.create(hwEl, p.char, {
      width: p.size, height: p.size, padding: Math.round(p.size * 0.06),
      showOutline: showOutlineFor(p.tier), showCharacter: false, renderer: 'svg',
      outlineColor: '#DDD', drawingColor: '#222', drawingWidth: Math.max(8, Math.round(p.size / 30)),
      charDataLoader: (c: string, onLoad: (d: StrokeJson) => void, onError: (e?: unknown) => void) => {
        (c === p.char ? first : loader(c)).then(onLoad, err => { onError(err); });
      },
    });
    void writer.quiz({
      ...quizOptionsFor(p.tier, p.leniencyInput),
      onCorrectStroke: onStroke(true),
      onMistake: onStroke(false),
      onComplete: () => finish('passed'),
    });

    return () => {
      disposed = true;
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('touchstart', onTouchStart, true);
      el.removeEventListener('touchmove', onTouchMove, true);
      window.removeEventListener('touchend', onTouchEnd, true);
      el.removeEventListener('mousedown', onMouseDown, true);
      el.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('mouseup', onMouseUp, true);
      if (!finished && state && state.strokes.length > 0) finish('abandoned');
      state = null;
      try { writer.cancelQuiz(); } catch { /* writer may not have finished loading */ }
      hwEl.replaceChildren(); // StrictMode remounts in development; never leave two drawings stacked
    };
    // One effect run per attempt: the parent remounts the pad (key) for a new character or tier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-testid="writing-pad" ref={host} style={{ position: 'relative', width: p.size, height: p.size, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <TianZiGe size={p.size} />
      <div data-hw style={{ position: 'absolute', inset: 0 }} />
      {error && <p role="alert" style={{ position: 'absolute', inset: 0, margin: 0, display: 'grid', placeItems: 'center', color: '#a00' }}>{error}</p>}
    </div>
  );
}

function TianZiGe({ size }: { size: number }) {
  const s = size;
  return (
    <svg width={s} height={s} style={{ position: 'absolute', inset: 0 }} aria-hidden>
      <rect x="1" y="1" width={s - 2} height={s - 2} fill="#FFFDF8" stroke="#C8322B" strokeWidth="2" />
      <line x1={s / 2} y1="0" x2={s / 2} y2={s} stroke="#E9B8B5" strokeDasharray="8 6" />
      <line x1="0" y1={s / 2} x2={s} y2={s / 2} stroke="#E9B8B5" strokeDasharray="8 6" />
    </svg>
  );
}
