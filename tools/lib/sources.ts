import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Curriculum, ExtraChar, StrokeJson } from '../../src/content/types';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

export function loadZhHant(): Map<string, StrokeJson> {
  const m = new Map<string, StrokeJson>();
  for (const line of readFileSync(path.join(ROOT, 'vendor/animcjk/graphicsZhHant.txt'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const d = JSON.parse(line) as { character: string } & StrokeJson;
    m.set(d.character, { strokes: d.strokes, medians: d.medians });
  }
  return m;
}

const HWD = path.dirname(require.resolve('hanzi-writer-data/package.json'));
export function hanziWriterData(char: string): StrokeJson | undefined {
  const p = path.join(HWD, `${char}.json`);
  if (!existsSync(p)) return undefined;
  const d = readJson<StrokeJson>(p);
  return { strokes: d.strokes, medians: d.medians };
}

export function readOverride(char: string): StrokeJson | undefined {
  const p = path.join(ROOT, 'content/strokes/overrides', `${char}.json`);
  return existsSync(p) ? readJson<StrokeJson>(p) : undefined;
}

export function loadCurricula(): Curriculum[] {
  const dir = path.join(ROOT, 'content/curricula');
  return readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => readJson<Curriculum>(path.join(dir, f)));
}

export const loadExtras = () => readJson<ExtraChar[]>(path.join(ROOT, 'content/extra-characters.json'));
export const contentPath = (...p: string[]) => path.join(ROOT, 'content', ...p);
export { readJson };
