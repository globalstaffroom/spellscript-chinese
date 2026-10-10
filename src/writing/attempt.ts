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
  strokes: StrokeResult[];
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
    tier: i.tier, leniencyInput: i.leniencyInput, outlineVisible: i.outlineVisible, hintShown: false, strokes: [],
    totalMistakes: 0, checker: CHECKER_VERSION, startedAt: i.now,
  };
}

export function recordStroke(s: AttemptState, e: StrokeEvent, raw: RawStroke | null): AttemptState {
  const hint = !e.isCorrect && e.mistakesOnStroke >= TIERS[s.tier].showHintAfterMisses;
  const stroke: StrokeResult = {
    strokeNum: e.strokeNum, accepted: e.isCorrect, backwards: e.isBackwards, mistakesOnStroke: e.mistakesOnStroke,
    drawn: e.drawn, raw, hintShownAfter: hint,
  };
  return { ...s, strokes: [...s.strokes, stroke], totalMistakes: e.totalMistakes, hintShown: s.hintShown || hint };
}

export const isOverMistakeLimit = (s: AttemptState) => s.totalMistakes >= TIERS[s.tier].maxMistakes;

export function finishAttempt(s: AttemptState, result: AttemptResult, now: number): AttemptRecord {
  const inputs = [...new Set(s.strokes.flatMap(x => (x.raw ? [x.raw.input] : [])))];
  return { ...s, inputs, result, endedAt: now };
}
