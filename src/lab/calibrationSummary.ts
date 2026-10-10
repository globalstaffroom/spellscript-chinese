import type { AttemptRecord } from '../writing/attempt';
import type { InputKind, TierId } from '../writing/tiers';

export type Figures = { attempts: number; passed: number; passedFirstTry: number; strokesEvaluated: number; strokesRejected: number; rejectionRate: number };
export type CalibrationSummary = {
  byTier: Record<TierId, Figures>;
  byInput: Partial<Record<InputKind, Figures>>;
  lookalikes: { asked: string; written: string; tier: TierId; falseAccept: boolean }[];
  abandoned: number;
};

const empty = (): Figures => ({ attempts: 0, passed: 0, passedFirstTry: 0, strokesEvaluated: 0, strokesRejected: 0, rejectionRate: 0 });

function add(f: Figures, a: AttemptRecord) {
  f.attempts++;
  if (a.result === 'passed') f.passed++;
  if (a.result === 'passed' && a.totalMistakes === 0 && a.strokes.every(s => s.accepted)) f.passedFirstTry++;
  f.strokesEvaluated += a.strokes.length;
  f.strokesRejected += a.strokes.filter(s => !s.accepted).length;
  f.rejectionRate = f.strokesEvaluated ? f.strokesRejected / f.strokesEvaluated : 0;
}

export function summarizeCalibration(attempts: AttemptRecord[]): CalibrationSummary {
  const out: CalibrationSummary = { byTier: { apprentice: empty(), practice: empty(), master: empty() }, byInput: {}, lookalikes: [], abandoned: 0 };
  for (const a of attempts) {
    if (a.result === 'abandoned') { out.abandoned++; continue; }
    if (a.context === 'lookalike') {
      out.lookalikes.push({ asked: a.char, written: a.expectedChar ?? '?', tier: a.tier, falseAccept: a.result === 'passed' });
      continue;
    }
    if (a.context !== 'calibration') continue;
    add(out.byTier[a.tier], a);
    for (const k of a.inputs) add((out.byInput[k] ??= empty()), a);
  }
  return out;
}
