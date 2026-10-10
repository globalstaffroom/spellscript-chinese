import { mkdirSync, writeFileSync } from 'node:fs';
import { compose, type Recipe } from '../src/content/compose';
import type { StrokeJson } from '../src/content/types';
import { contentPath, hanziWriterData, loadZhHant, readJson } from './lib/sources';

const zhHant = loadZhHant();
// Donors and bases are looked up regardless of stroke count; build-strokes re-checks the result against MOE.
const lookup = (char: string): StrokeJson => {
  const d = zhHant.get(char) ?? hanziWriterData(char);
  if (!d) throw new Error(`no data anywhere for ${char}`);
  return d;
};

const recipes = readJson<Recipe[]>(contentPath('strokes/compose-recipes.json'));
mkdirSync(contentPath('strokes/overrides'), { recursive: true });
for (const r of recipes) {
  const out = compose(r.baseChar ? lookup(r.baseChar) : null, r.ops.map(op => ({ op, donor: lookup(op.donor.char) })));
  writeFileSync(contentPath('strokes/overrides', `${r.char}.json`), JSON.stringify(out) + '\n');
  console.log(`${r.char}: ${out.strokes.length} strokes`);
}
