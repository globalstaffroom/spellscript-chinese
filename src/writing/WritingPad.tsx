import HanziWriter from 'hanzi-writer';
import { useEffect, useRef, useState } from 'react';
import { applyOrder, divergeAt } from '../content/alternates';
import { loadStrokeJson } from '../content/strokeFiles';
import type { StrokeJson } from '../content/types';
import { newId } from '../storage/profiles';
import { finishAttempt, isOverMistakeLimit, recordStroke, startAttempt, type AttemptContext, type AttemptRecord, type AttemptState, type StrokeEvent } from './attempt';
import { PalmFilter, classifyPointer } from './input';
import { RawStrokeQueue, type RawStroke } from './rawStrokes';
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
  /** Second official MOE orders for this character (content/strokes/alternates.json), as permutations of 0..n-1. */
  alternates?: number[][];
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

    // Hanzi Writer never receives native touch events: it reads touches[0] and ends a stroke on ANY document touchend,
    // so a resting palm would hijack it. The pad picks one touch (the Pencil wins) and drives Hanzi Writer with
    // synthetic mouse events. Its own document listeners cannot be removed (no API), so we stop events before them.
    const hwEl = el.querySelector<HTMLDivElement>('[data-hw]')!;
    type Touch1 = { identifier: number; clientX: number; clientY: number; touchType?: string };
    let active: { id: number; kind: 'pen' | 'finger' } | null = null;
    // Spec §5: once the Pencil has been seen in this attempt, every finger touch is a palm (no time-out inside an attempt).
    let penSeenThisAttempt = false;
    const padTouchIds = new Set<number>();
    const synthetic = new WeakSet<Event>();
    let lastTouch = -Infinity; // Safari fires compatibility mouse events after a touch
    const fire = (type: string, target: EventTarget, x: number, y: number) => {
      const ev = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
      synthetic.add(ev);
      target.dispatchEvent(ev);
    };
    const hwTarget = () => hwEl.querySelector('svg') ?? hwEl;
    const stopActive = () => {
      if (!active) return;
      queue.end();
      fire('mouseup', document, 0, 0);
      active = null;
    };
    const touches = (l: TouchList | ArrayLike<unknown>) => Array.from(l as ArrayLike<Touch1>);
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault(); e.stopPropagation();
      lastTouch = performance.now();
      for (const t of touches(e.changedTouches)) {
        padTouchIds.add(t.identifier);
        const kind = t.touchType === 'stylus' ? 'pen' : 'finger';
        if (kind === 'pen') { palm.notePen(performance.now()); penSeenThisAttempt = true; }
        if (kind === 'finger' && penSeenThisAttempt) continue;
        if (switching) continue;
        if (active && !(active.kind === 'finger' && kind === 'pen')) continue;
        if (!active && kind === 'finger' && palm.shouldBlock({ primary: 'direct', now: performance.now() })) continue;
        if (active) stopActive(); // a palm that landed first loses to the Pencil
        active = { id: t.identifier, kind };
        latest.current.onInputSeen(kind);
        queue.begin(kind, local(t.clientX, t.clientY));
        fire('mousedown', hwTarget(), t.clientX, t.clientY);
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (!active) return;
      const t = touches(e.changedTouches).find(c => c.identifier === active!.id);
      if (!t) return;
      if (t.touchType === 'stylus') palm.notePen(performance.now());
      queue.move(local(t.clientX, t.clientY));
      fire('mousemove', hwTarget(), t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      lastTouch = performance.now();
      let ours = false;
      for (const t of touches(e.changedTouches)) {
        if (!padTouchIds.delete(t.identifier)) continue; // never started on the pad: leave it alone
        ours = true;
        if (active && active.id === t.identifier) {
          if (t.touchType === 'stylus') palm.notePen(performance.now());
          stopActive();
        }
      }
      if (ours) e.stopPropagation();
    };
    // Hanzi Writer ends its stroke on ANY document touchend, even one that started off the pad (a palm lifting, an
    // iOS touchcancel). Registered before HanziWriter.create, so on document this bubble listener runs before its own.
    const onDocTouchEnd = (e: TouchEvent) => { if (active !== null) e.stopImmediatePropagation(); };
    // Alternate stroke orders. Hanzi Writer grades one order, so at a stroke where an alternate diverges the pad holds a
    // rejected stroke, reloads the character in the alternate order and replays the held stroke through Hanzi Writer.
    const alts = p.alternates ?? [];
    let order: number[] | null = null; // null = primary
    const tried = new Set<string>(); // `${stroke}:${alternate}` already tried in this attempt
    let switching = false; // while a switch/replay is in flight, no new child stroke starts
    let replay: { held: RawStroke; accepted: boolean } | null = null;
    const compat = (e: MouseEvent) => !synthetic.has(e) && performance.now() - lastTouch < 800;
    let mouseDown = false;
    const onMouseDown = (e: MouseEvent) => {
      if (synthetic.has(e)) return;
      if (compat(e) || switching) { e.stopPropagation(); e.preventDefault(); return; }
      mouseDown = true;
      latest.current.onInputSeen('mouse');
      queue.begin('mouse', local(e.clientX, e.clientY));
    };
    const onMouseMove = (e: MouseEvent) => {
      if (synthetic.has(e)) return;
      if (compat(e)) { e.stopPropagation(); return; }
      if (mouseDown) queue.move(local(e.clientX, e.clientY));
    };
    const onMouseUp = (e: MouseEvent) => {
      if (synthetic.has(e)) return;
      if (compat(e)) { e.stopPropagation(); return; }
      if (mouseDown) { mouseDown = false; queue.end(); }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (classifyPointer(e.pointerType) === 'pen') { palm.notePen(performance.now()); penSeenThisAttempt = true; }
    };

    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
    el.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    window.addEventListener('touchend', onTouchEnd, true);
    window.addEventListener('touchcancel', onTouchEnd, true);
    document.addEventListener('touchend', onDocTouchEnd);
    document.addEventListener('touchcancel', onDocTouchEnd);
    el.addEventListener('mousedown', onMouseDown, true);
    el.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('mouseup', onMouseUp, true);

    /** Records one stroke; true if it ended the attempt (mistake limit). */
    const record = (e: StrokeEvent, raw: RawStroke | null) => {
      if (!state || finished) return true;
      state = recordStroke(state, e, raw);
      if (!e.isCorrect && isOverMistakeLimit(state)) { writer.cancelQuiz(); finish('failed'); return true; }
      return false;
    };
    const onStroke = (isCorrect: boolean) => (s: HwStroke) => {
      if (!state || finished) return;
      const e: StrokeEvent = {
        strokeNum: s.strokeNum, isCorrect, isBackwards: s.isBackwards, mistakesOnStroke: s.mistakesOnStroke,
        totalMistakes: s.totalMistakes, drawn: s.drawnPath.points.map(({ x, y }) => ({ x, y })),
      };
      if (replay) { // Hanzi Writer's verdict on the held stroke under the alternate order
        if (isCorrect) { replay.accepted = true; state = { ...state, order }; record(e, replay.held); }
        return;
      }
      const raw = queue.take();
      if (!isCorrect && order === null && raw) {
        const j = alts.findIndex((alt, n) => divergeAt(alt) === s.strokeNum && !tried.has(`${s.strokeNum}:${n}`));
        if (j >= 0) { void tryAlternate(j, e, raw); return; }
      }
      record(e, raw);
    };
    const restart = async (k: number) => {
      await writer.setCharacter(p.char); // reloads through charDataLoader, so it picks up the current order
      if (disposed) return;
      await writer.quiz({ ...quizOptions, quizStartStrokeNum: k }); // strokes before k are shown as written
    };
    const replayStroke = (raw: RawStroke) => {
      const r = el.getBoundingClientRect();
      const pts = raw.points.map(pt => ({ x: pt.x + r.left, y: pt.y + r.top }));
      const target = hwTarget();
      fire('mousedown', target, pts[0]!.x, pts[0]!.y);
      for (const pt of pts.slice(1)) fire('mousemove', target, pt.x, pt.y);
      fire('mouseup', document, pts.at(-1)!.x, pts.at(-1)!.y);
    };
    const tryAlternate = async (j: number, held: StrokeEvent, raw: RawStroke) => {
      const k = held.strokeNum;
      switching = true;
      tried.add(`${k}:${j}`);
      let recorded = false;
      try {
        await Promise.resolve(); // let Hanzi Writer finish ending the stroke before the character is replaced
        order = alts[j]!;
        await restart(k);
        if (disposed || !state || finished) return;
        const outcome = { held: raw, accepted: false };
        replay = outcome;
        try { replayStroke(raw); } finally { replay = null; }
        if (outcome.accepted) return; // recorded in onStroke; the attempt continues in the alternate order
        // Rejected (or no verdict): wrong under both orders. One mistake, and back to the textbook order so the hint
        // and outline guide it.
        order = null;
        recorded = true;
        if (record(held, raw)) return;
        await restart(k);
        if (!disposed && state?.strokes.at(-1)?.hintShownAfter) writer.highlightStroke(k).catch(() => {});
      } catch {
        order = null;
        if (!recorded) { recorded = true; if (record(held, raw)) return; }
        try { if (!disposed) await restart(k); } catch { /* nothing more to do */ }
      } finally {
        switching = false;
      }
    };

    const loader = p.loader ?? loadStrokeJson;
    // Start the load here (not only inside Hanzi Writer) so a missing file always shows the message; Hanzi Writer reuses this promise.
    let disposed = false;
    const first = Promise.resolve().then(() => loader(p.char));
    first.catch(() => { if (!disposed) setError(`找不到「${p.char}」的筆順資料`); });
    const quizOptions = {
      ...quizOptionsFor(p.tier, p.leniencyInput),
      onCorrectStroke: onStroke(true),
      onMistake: onStroke(false),
      onComplete: () => finish('passed'),
    };
    const writer = HanziWriter.create(hwEl, p.char, {
      width: p.size, height: p.size, padding: Math.round(p.size * 0.06),
      showOutline: showOutlineFor(p.tier), showCharacter: false, renderer: 'svg',
      outlineColor: '#DDD', drawingColor: '#222', drawingWidth: Math.max(8, Math.round(p.size / 30)),
      onLoadCharDataError: () => {},
      charDataLoader: (c: string, onLoad: (d: StrokeJson) => void, onError: (e?: unknown) => void) => {
        const o = order; // one network load: an alternate order permutes the already-loaded base data
        (c === p.char ? first : loader(c)).then(d => onLoad(o && c === p.char ? applyOrder(d, o) : d), err => { onError(err); });
      },
    });
    writer.quiz(quizOptions).catch(() => {});

    return () => {
      disposed = true;
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('touchstart', onTouchStart, true);
      el.removeEventListener('touchmove', onTouchMove, true);
      window.removeEventListener('touchend', onTouchEnd, true);
      window.removeEventListener('touchcancel', onTouchEnd, true);
      document.removeEventListener('touchend', onDocTouchEnd);
      document.removeEventListener('touchcancel', onDocTouchEnd);
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
