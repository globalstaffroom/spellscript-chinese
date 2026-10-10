import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { StrokeReport } from '../src/content/check';
import { charToFile } from '../src/content/strokeFiles';
import { selectStrokeData } from '../src/content/strokeSelect';
import { collectTargets } from '../src/content/targets';
import { ROOT, contentPath, hanziWriterData, loadCurricula, loadExtras, loadZhHant, readOverride } from './lib/sources';

const { targets, conflicts } = collectTargets(loadCurricula(), loadExtras());
if (conflicts.length) {
  console.error('Stroke-count conflicts:\n' + conflicts.join('\n'));
  process.exit(1);
}
const zhHant = loadZhHant();
const out = path.join(ROOT, 'public/strokes');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const report: StrokeReport = { generatedAt: new Date().toISOString(), chars: [] };
for (const [char, expected] of targets) {
  const s = selectStrokeData(char, expected, {
    override: readOverride(char),
    'animcjk-zhHant': zhHant.get(char),
    'hanzi-writer-data': hanziWriterData(char),
  });
  if (s.chosen) writeFileSync(path.join(out, charToFile(char)), JSON.stringify({ ...s.chosen.data, source: s.chosen.source }));
  report.chars.push({ char, expected, source: s.chosen?.source ?? null, rejected: s.rejected, overrideMismatch: s.overrideMismatch });
}
writeFileSync(path.join(out, 'LICENSE.txt'),
  'Stroke data derived from AnimCJK (https://github.com/parsimonhi/animCJK) and hanzi-writer-data\n' +
  '(https://github.com/chanind/hanzi-writer-data), both under the Arphic Public License.\n' +
  'Hand-composed overrides in this folder are derived from the same data and carry the same licence.\n');
writeFileSync(contentPath('strokes/report.json'), JSON.stringify(report, null, 1) + '\n');

const count = (src: string | null) => report.chars.filter(c => c.source === src).length;
console.log(`characters: ${report.chars.length}`);
console.log(`  animcjk-zhHant: ${count('animcjk-zhHant')}  hanzi-writer-data: ${count('hanzi-writer-data')}  override: ${count('override')}`);
console.log(`  missing: ${count(null)}  ${report.chars.filter(c => !c.source).map(c => c.char).join('')}`);
