import { validateAlternates, type Alternates } from './alternates';
import { validateCurriculum } from './curriculum';
import type { StrokeSourceName } from './strokeSelect';
import { collectTargets } from './targets';
import type { Curriculum, ExtraChar } from './types';

export type ReportEntry = {
  char: string;
  expected: number;
  source: StrokeSourceName | null;
  rejected: { source: StrokeSourceName; count: number }[];
  overrideMismatch: boolean;
};
export type StrokeReport = { generatedAt: string; chars: ReportEntry[] };
export type Verified = Record<string, { by: string; date: string }>;
export type CalibrationSet = {
  tiers: Record<'apprentice' | 'practice' | 'master', string[]>;
  lookalikes: [string, string][];
};

export function checkContent(input: {
  curricula: Curriculum[];
  extras: ExtraChar[];
  report: StrokeReport;
  verified: Verified;
  requireVerified: string[];
  /** content/strokes/alternates.json; absent means no character has a second official order. */
  alternates?: Alternates;
}): string[] {
  const problems: string[] = [];
  for (const c of input.curricula) {
    for (const p of validateCurriculum(c)) problems.push(`${c.id} lesson ${p.lesson} 「${p.char}」: ${p.problem}`);
  }
  const { targets, conflicts } = collectTargets(input.curricula, input.extras);
  problems.push(...conflicts);
  const byChar = new Map(input.report.chars.map(e => [e.char, e]));
  for (const [char, expected] of targets) {
    if (!/^\p{Script=Han}$/u.test(char)) continue; // already reported by validateCurriculum
    const e = byChar.get(char);
    if (!e || e.expected !== expected) {
      problems.push(`${char}: not in content/strokes/report.json — run npm run build-strokes`);
      continue;
    }
    if (e.overrideMismatch) {
      const n = e.rejected.find(r => r.source === 'override')?.count;
      problems.push(`${char}: override has ${n} strokes but MOE says ${expected} — fix its compose recipe`);
    } else if (e.source === null) {
      const rej = e.rejected.map(r => `${r.source} ${r.count}`).join(', ') || 'no source has it';
      problems.push(`${char}: no stroke data with the MOE count ${expected} (rejected: ${rej})`);
    }
  }
  problems.push(...validateAlternates(input.alternates ?? {}, targets));
  for (const char of input.requireVerified) {
    if (!input.verified[char]) problems.push(`${char}: stroke order not yet verified against MOE 筆順`);
  }
  return problems;
}

export function calibrationChars(set: CalibrationSet): string[] {
  return [...new Set([...Object.values(set.tiers).flat(), ...set.lookalikes.flat()])];
}
