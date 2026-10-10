import type { StrokeJson } from './types';

export function charToFile(char: string): string {
  const cps = [...char];
  if (cps.length !== 1) throw new Error(`expected one character, got "${char}"`);
  return cps[0]!.codePointAt(0)!.toString(16).toUpperCase() + '.json';
}

/** Browser only: loads a generated stroke file from public/strokes/. */
export async function loadStrokeJson(char: string): Promise<StrokeJson> {
  const res = await fetch(`${import.meta.env.BASE_URL}strokes/${charToFile(char)}`);
  if (!res.ok) throw new Error(`no stroke data for ${char} (${res.status})`);
  const d = (await res.json()) as StrokeJson;
  return { strokes: d.strokes, medians: d.medians };
}
