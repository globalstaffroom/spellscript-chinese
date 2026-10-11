import type { RawStroke } from './rawStrokes';
import { TIERS, type InputKind, type TierId } from './tiers';

export const CHECKER_VERSION = 'hanzi-writer@3.7.3+tiers-v1';

export type AttemptContext = 'calibration' | 'lookalike' | 'lesson' | 'seal' | 'story' | 'memory';
export type AttemptResult = 'passed' | 'failed' | 'abandoned';

export type StrokeEvent = {
  strokeNum: number;
  isCorrect: boolean;
  isBackwards: boolean;
  mistakesOnStroke: number;
  /** Hanzi Writer's per-quiz count. Kept for compatibility but NOT trusted: it resets on every quiz() restart. */
  totalMistakes: number;
  drawn: { x: number; y: number }[];
};

export type StrokeResult = {
  strokeNum: number;
  accepted: boolean;
  backwards: boolean;
  mistakesOnStroke: number;
  drawn: { x: number; y: number }[];
  raw: RawStroke | null;
  /** True if Hanzi Writer flashed the hint right after this stroke. */
  hintShownAfter: boolean;
};

export type AttemptRecord = {
  id: string;
  profileId: string;
  /** The character the pad checked against. */
  char: string;
  /** For look-alike tests: the character the adult actually wrote. Otherwise null. */
  expectedChar: string | null;
  word: string | null;
  context: AttemptContext;
  tier: TierId;
  /** The input kind whose leniency the quiz started with. */
  leniencyInput: InputKind;
  inputs: InputKind[];
  outlineVisible: boolean;
  hintShown: boolean;
  /** The stroke order graded against: null = primary, else the alternate permutation (StrokeResult.strokeNum indexes it). */
  order: number[] | null;
  strokes: StrokeResult[];
  /** Counted by recordStroke (one per rejected stroke), not copied from Hanzi Writer. */
  totalMistakes: number;
  result: AttemptResult;
  checker: string;
  startedAt: number;
  endedAt: number;
};

export type AttemptState = Omit<AttemptRecord, 'result' | 'endedAt' | 'inputs'>;

export function startAttempt(i: {
  id: string; profileId: string; char: string; expectedChar: string | null; word: string | null;
  context: AttemptContext; tier: TierId; leniencyInput: InputKind; outlineVisible: boolean; now: number;
}): AttemptState {
  return {
    id: i.id, profileId: i.profileId, char: i.char, expectedChar: i.expectedChar, word: i.word, context: i.context,
    tier: i.tier, leniencyInput: i.leniencyInput, outlineVisible: i.outlineVisible, hintShown: false, order: null, strokes: [],
    totalMistakes: 0, checker: CHECKER_VERSION, startedAt: i.now,
  };
}

export function recordStroke(s: AttemptState, e: StrokeEvent, raw: RawStroke | null): AttemptState {
  const hint = !e.isCorrect && e.mistakesOnStroke >= TIERS[s.tier].showHintAfterMisses;
  const stroke: StrokeResult = {
    strokeNum: e.strokeNum, accepted: e.isCorrect, backwards: e.isBackwards, mistakesOnStroke: e.mistakesOnStroke,
    drawn: e.drawn, raw, hintShownAfter: hint,
  };
  return { ...s, strokes: [...s.strokes, stroke], totalMistakes: s.totalMistakes + (e.isCorrect ? 0 : 1), hintShown: s.hintShown || hint };
}

export const isOverMistakeLimit = (s: AttemptState) => s.totalMistakes >= TIERS[s.tier].maxMistakes;

export function finishAttempt(s: AttemptState, result: AttemptResult, now: number): AttemptRecord {
  const inputs = [...new Set(s.strokes.flatMap(x => (x.raw ? [x.raw.input] : [])))];
  return { ...s, inputs, result, endedAt: now };
}
