/**
 * Automatic stroke-order check against the MOE 筆順學習網 (stroke-order.learningweb.moe.edu.tw).
 *
 *   npm run moe-check                 fetch (cached) + match, print a summary, write .cache/moe/results.json
 *   npm run moe-check -- --apply      also write verified.json (moe-auto), compose-recipes.json (reorders),
 *                                     alternates.json (version 2); then run compose-strokes + build-strokes and
 *                                     run --apply again so the reordered characters are re-checked and verified
 *   npm run moe-check -- --controls   run the matcher controls only (needs the cache)
 *   --threshold=0.18  --offline (never fetch; a character without a cached page is "not found")
 *
 * Licence: MOE data is CC BY-NC-ND 3.0 TW. It is cached raw in .cache/moe/ (git-ignored) as a local reference
 * only. Nothing from it is written into our stroke files; only a pass/fail and a permutation of OUR stroke indices.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Alternates } from '../src/content/alternates';
import type { StrokeReport, Verified } from '../src/content/check';
import type { Recipe } from '../src/content/compose';
import {
  DEFAULT_THRESHOLD, extractMoeXml, hasVersion2, matchStrokes, normaliseMoe, normaliseOurs, parseMoeXml,
  type MatchResult, type Track,
} from '../src/content/moeMatch';
import { charToFile } from '../src/content/strokeFiles';
import type { StrokeJson } from '../src/content/types';
import { ROOT, contentPath, hanziWriterData, loadZhHant, readJson } from './lib/sources';

const BASE = 'https://stroke-order.learningweb.moe.edu.tw';
const UA = 'SpellScript-Chinese stroke-order check (local, non-commercial; one request per second)';
const CACHE = path.join(ROOT, '.cache/moe');
const TODAY = new Date().toISOString().slice(0, 10);
const METHOD = 'track start/end match vs MOE 筆順學習網 v1';
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const flag = (name: string) => process.argv.includes(`--${name}`);
const THRESHOLD = Number(arg('threshold') ?? DEFAULT_THRESHOLD);
const OFFLINE = flag('offline');

export const moeLink = (char: string) => `${BASE}/searchW.jsp?ID2=1&WORD=${encodeURIComponent(char)}`;

let lastRequest = 0;
const fetchFailures: string[] = [];
async function politeGet(url: string): Promise<string> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequest + 1500 - Date.now();
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastRequest = Date.now();
    try {
      // curl, not Node fetch: Node's fetch hit repeated connect timeouts on this host where curl did not.
      const r = spawnSync('curl', ['-sS', '-L', '--fail', '-m', '20', '-A', UA, url], { encoding: 'utf8', maxBuffer: 1 << 26 });
      if (r.status !== 0) throw new Error(`curl exit ${r.status}: ${r.stderr.trim()}`);
      return r.stdout;
    } catch (e) {
      if (attempt >= 1) throw new Error(`${url}: ${(e as Error).message}`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

/** Cached page for the character (version 1 or 2), fetched once. null when offline and not cached. */
async function moePage(char: string, version: 1 | 2, v1Id?: string): Promise<string | null> {
  const file = path.join(CACHE, charToFile(char).replace('.json', version === 1 ? '.html' : '_st2.html'));
  if (existsSync(file)) return readFileSync(file, 'utf8');
  if (OFFLINE) return null;
  const url = version === 1 ? moeLink(char) : `${BASE}/dictView.jsp?ID=${v1Id}&ST=2&WORD=`;
  try {
    const html = await politeGet(url);
    writeFileSync(file, html);
    return html;
  } catch (e) {
    // Not cached, so the next run tries again. Counted as not found for this run.
    console.warn(`fetch failed for ${char} v${version}: ${(e as Error).message}`);
    fetchFailures.push(`${char} v${version}`);
    return null;
  }
}

type MoeVersion = { tracks: Track[] } | { error: string };
async function moeVersions(char: string): Promise<{ v1: MoeVersion; v2: MoeVersion | null }> {
  const read = (html: string | null): MoeVersion & { id?: string } => {
    if (html === null) return { error: OFFLINE ? 'not cached (offline)' : 'MOE page could not be fetched (retry later)' };
    const x = extractMoeXml(html);
    if (!x) return { error: 'MOE page has no stroke data (not found)' };
    const p = parseMoeXml(x.xml);
    if (p.char !== char) return { error: `MOE page is for ${p.char ?? 'an unknown character'}, not ${char} (not found)` };
    return { tracks: normaliseMoe(p.tracks), id: x.id };
  };
  const h1 = await moePage(char, 1);
  const v1 = read(h1);
  if (!('tracks' in v1) || !h1 || !hasVersion2(h1)) return { v1, v2: null };
  return { v1, v2: read(await moePage(char, 2, v1.id)) };
}

export type CharResult = {
  char: string;
  source: string | null;
  v1: MatchResult | { outcome: 'notfound'; reason: string };
  v2: MatchResult | { outcome: 'notfound'; reason: string } | null;
};

const ours = (char: string): StrokeJson | null => {
  const p = path.join(ROOT, 'public/strokes', charToFile(char));
  return existsSync(p) ? readJson<StrokeJson>(p) : null;
};

function run(oursData: StrokeJson, moe: MoeVersion): CharResult['v1'] {
  if (!('tracks' in moe)) return { outcome: 'notfound', reason: moe.error };
  return matchStrokes(normaliseOurs(oursData.medians), moe.tracks, THRESHOLD);
}

async function checkAll(chars: { char: string; source: string | null }[]): Promise<CharResult[]> {
  const out: CharResult[] = [];
  let i = 0;
  for (const { char, source } of chars) {
    i++;
    const data = ours(char);
    const { v1, v2 } = await moeVersions(char);
    if (!data) { out.push({ char, source, v1: { outcome: 'notfound', reason: 'no stroke data of ours' }, v2: null }); continue; }
    out.push({ char, source, v1: run(data, v1), v2: v2 ? run(data, v2) : null });
    if (i % 25 === 0) console.log(`  ${i}/${chars.length}`);
  }
  return out;
}

// ---------- controls ----------
async function controls(): Promise<boolean> {
  const lines: string[] = [];
  let ok = true;
  const expect = (label: string, got: string, pass: boolean) => {
    ok &&= pass;
    lines.push(`${pass ? 'PASS' : 'FAIL'}  ${label}: ${got}`);
  };
  const fang = ours('方')!;
  const { v1, v2 } = await moeVersions('方');
  const r1 = run(fang, v1), r2 = v2 ? run(fang, v2) : null;
  expect('方 v1 → match', r1.outcome, r1.outcome === 'match');
  expect('方 v2 → order [0,1,3,2]', r2 && 'order' in r2 ? `${r2.outcome} [${r2.order}]` : 'no v2',
    !!r2 && 'order' in r2 && r2.order.join() === '0,1,3,2');
  // Synthetic: our 方 with strokes 2 and 3 swapped, and with stroke 3 reversed.
  const swapped = { strokes: fang.strokes, medians: [fang.medians[0]!, fang.medians[1]!, fang.medians[3]!, fang.medians[2]!] };
  const rs = run(swapped, v1);
  expect('方 strokes 2,3 swapped → reorder', `${rs.outcome}${'order' in rs ? ` [${rs.order}]` : ''}`, rs.outcome === 'reorder');
  for (let k = 0; k < fang.medians.length; k++) {
    const rev = { strokes: fang.strokes, medians: fang.medians.map((m, i) => (i === k ? [...m].reverse() : m)) };
    const rr = run(rev, v1);
    expect(`方 stroke ${k + 1} reversed → reversed`, rr.outcome, rr.outcome === 'reversed');
  }
  // Negative: raw mainland hanzi-writer-data, found wrong against the textbook cards in Task 12.
  for (const c of ['遙', '遨', '慌', '滑']) {
    const raw = hanziWriterData(c)!;
    const { v1: m } = await moeVersions(c);
    const r = run(raw, m);
    const moeN = 'tracks' in m ? m.tracks.length : '?';
    expect(`${c} raw hanzi-writer-data (${raw.medians.length} strokes vs MOE ${moeN}) → not match`, `${r.outcome}: ${r.reason}`, 'tracks' in m && r.outcome !== 'match');
  }
  // The four above only differ in stroke COUNT, so they never reach the geometry. Same-count negatives:
  // (a) look-alike pairs — our data for one against MOE for the other;
  for (const [a, b] of [['土', '士'], ['士', '土'], ['未', '末'], ['末', '未'], ['人', '入'], ['入', '人'], ['午', '牛'], ['牛', '午']] as const) {
    const m = (await moeVersions(b)).v1;
    const r = run(ours(a)!, m);
    expect(`ours ${a} vs MOE ${b} → not match`, `${r.outcome}`, 'tracks' in m && r.outcome !== 'match');
  }
  // (b) raw mainland hanzi-writer-data with the MOE stroke count whose order differs from our served data (order
  //     difference found by matching our data against the raw data, no MOE involved) — must not come out match.
  const report = readJson<StrokeReport>(contentPath('strokes/report.json'));
  const mainland: string[] = [], falseMatch: string[] = [];
  for (const { char } of report.chars) {
    const raw = hanziWriterData(char), served = ours(char);
    const m = (await moeVersions(char)).v1;
    if (!raw || !served || !('tracks' in m) || raw.medians.length !== m.tracks.length || served.medians.length !== raw.medians.length) continue;
    const vsServed = matchStrokes(normaliseOurs(served.medians), normaliseOurs(raw.medians), Infinity);
    if (vsServed.order.every((o, k) => o === k)) continue;
    mainland.push(char);
    if (run(raw, m).outcome === 'match') falseMatch.push(char);
  }
  expect(`${mainland.length} raw mainland same-count different-order (${mainland.join('')}) → not match`,
    falseMatch.length ? `false match: ${falseMatch.join('')}` : 'none match', mainland.length > 0 && !falseMatch.length);
  // Positive: founder-verified characters.
  const verified = readJson<Verified>(contentPath('strokes/verified.json'));
  const founder = Object.entries(verified).filter(([, v]) => v.by === 'founder').map(([c]) => c);
  const misses: string[] = [];
  for (const c of founder) {
    const r = run(ours(c)!, (await moeVersions(c)).v1);
    if (r.outcome !== 'match') misses.push(`${c} ${r.outcome}: ${r.reason}`);
  }
  expect(`${founder.length} founder-verified → match`, misses.length ? misses.join('; ') : 'all match', !misses.length);
  console.log(`Controls (threshold ${THRESHOLD}):\n` + lines.join('\n'));
  return ok;
}

// ---------- apply ----------
function apply(results: CharResult[]) {
  const vPath = contentPath('strokes/verified.json');
  const verified = readJson<Verified>(vPath);
  const recipes = readJson<Recipe[]>(contentPath('strokes/compose-recipes.json'));
  const altPath = contentPath('strokes/alternates.json');
  const alternates = existsSync(altPath) ? readJson<Alternates>(altPath) : {};
  const zhHant = loadZhHant();
  const log: string[] = [];
  let reorderRecipes = 0, verifiedAdded = 0, verifiedRemoved = 0, altsAdded = 0;
  for (const r of results) {
    const prev = verified[r.char];
    if (r.v1.outcome === 'match') {
      if (!prev) { verified[r.char] = { by: 'moe-auto', date: TODAY, method: METHOD }; verifiedAdded++; }
    } else if (prev?.by === 'moe-auto') {
      delete verified[r.char]; verifiedRemoved++; log.push(`${r.char}: moe-auto verification withdrawn (${r.v1.outcome})`);
    }
    if (r.v1.outcome === 'reorder') {
      const existing = recipes.find(x => x.char === r.char);
      // compose-strokes looks a base up as zhHant ?? hanzi-writer-data; a self-reorder is only an identity
      // transform of the data we serve if that lookup returns exactly that data.
      const base = zhHant.get(r.char) ?? hanziWriterData(r.char);
      const servedIsBase = r.source === 'animcjk-zhHant' || (r.source === 'hanzi-writer-data' && !zhHant.has(r.char));
      if (existing) log.push(`${r.char}: reorder needed but it already has a compose recipe — founder`);
      else if (!servedIsBase || !base || base.medians.length !== r.v1.order.length) log.push(`${r.char}: reorder needed but served data (${r.source}) is not the compose base — founder`);
      else {
        recipes.push({
          char: r.char, baseChar: r.char,
          ops: [{ remove: r.v1.order.map((_, i) => i), insertAt: 0, donor: { char: r.char, strokes: r.v1.order } }],
          note: `Auto reorder (moe-check ${TODAY}): our own ${r.source} strokes in MOE 筆順學習網 v1 order.`,
        });
        reorderRecipes++;
      }
    }
    // Version 2 as a permutation of OUR indices — only meaningful once our primary order IS the MOE v1 order.
    if (r.v1.outcome === 'match' && r.v2 && (r.v2.outcome === 'match' || r.v2.outcome === 'reorder')) {
      const order = r.v2.order;
      if (r.v2.outcome === 'match') log.push(`${r.char}: MOE version 2 has the same order as version 1 (shape-only difference) — not added`);
      else if (alternates[r.char]) {
        const same = alternates[r.char]!.orders.some(o => o.join() === order.join());
        log.push(`${r.char}: alternates.json already has an entry (${same ? 'agrees' : 'DIFFERS'} with auto v2 [${order}]) — left as is`);
      } else {
        alternates[r.char] = { orders: [order], source: `MOE 筆順學習網 有另一種寫法 2 (auto-matched ${TODAY})` };
        altsAdded++;
      }
    }
  }
  writeFileSync(vPath, JSON.stringify(verified, null, 1) + '\n');
  writeFileSync(contentPath('strokes/compose-recipes.json'), JSON.stringify(recipes, null, 2) + '\n');
  const altOut = '{\n' + Object.entries(alternates).map(([c, a]) =>
    `  ${JSON.stringify(c)}: { "orders": ${JSON.stringify(a.orders).replace(/,/g, ', ')}, "source": ${JSON.stringify(a.source)} }`).join(',\n') + '\n}\n';
  writeFileSync(altPath, altOut);
  console.log(`apply: verified +${verifiedAdded} -${verifiedRemoved}, reorder recipes +${reorderRecipes}, alternates +${altsAdded}`);
  for (const l of log) console.log('  ' + l);
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  if (flag('controls')) process.exit((await controls()) ? 0 : 1);
  const report = readJson<StrokeReport>(contentPath('strokes/report.json'));
  const results = await checkAll(report.chars.map(c => ({ char: c.char, source: c.source })));
  writeFileSync(path.join(CACHE, 'results.json'), JSON.stringify({ threshold: THRESHOLD, date: TODAY, results }, null, 1));
  const tally = (pick: (r: CharResult) => string) =>
    Object.entries(results.reduce<Record<string, number>>((a, r) => ({ ...a, [pick(r)]: (a[pick(r)] ?? 0) + 1 }), {}));
  console.log(`v1 outcomes (threshold ${THRESHOLD}): ` + tally(r => r.v1.outcome).map(([k, n]) => `${k} ${n}`).join(', '));
  console.log(`v2 pages: ${results.filter(r => r.v2).length}; outcomes: ` +
    tally(r => (r.v2 ? r.v2.outcome : '-')).filter(([k]) => k !== '-').map(([k, n]) => `${k} ${n}`).join(', '));
  if (fetchFailures.length) console.warn(`${fetchFailures.length} page(s) could not be fetched: ${fetchFailures.join(', ')} — run again`);
  if (flag('apply')) {
    if (fetchFailures.length) { console.error('Fetch failures — nothing applied. Run again to fill the cache.'); process.exit(1); }
    if (!(await controls())) { console.error('Controls failed — nothing applied.'); process.exit(1); }
    apply(results);
  }
}

await main();
