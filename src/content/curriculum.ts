import type { Curriculum } from './types';

const HAN = /^\p{Script=Han}$/u;

export type CurriculumProblem = { lesson: number; char: string; problem: string };

export function validateCurriculum(c: Curriculum): CurriculumProblem[] {
  const problems: CurriculumProblem[] = [];
  const seen = new Map<string, number>();
  for (const l of c.lessons) {
    for (const w of l.write) {
      if (!HAN.test(w.char)) problems.push({ lesson: l.lesson, char: w.char, problem: 'not a single Han character' });
      if (!(w.totalStrokes > 0) || w.strokesAfterRadical < 0 || w.strokesAfterRadical > w.totalStrokes) {
        problems.push({ lesson: l.lesson, char: w.char, problem: 'impossible stroke counts' });
      }
      const prev = seen.get(w.char);
      if (prev !== undefined) problems.push({ lesson: l.lesson, char: w.char, problem: `duplicate of lesson ${prev}` });
      else seen.set(w.char, l.lesson);
    }
  }
  return problems;
}

export function writeChars(c: Curriculum): { char: string; totalStrokes: number }[] {
  return c.lessons.flatMap(l => l.write.map(w => ({ char: w.char, totalStrokes: w.totalStrokes })));
}
