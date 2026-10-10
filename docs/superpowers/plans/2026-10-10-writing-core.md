# SpellScript Chinese — Plan 1: Writing core and calibration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a small web app that runs on the iPad, lets a child write any 康軒 生字 stroke by stroke in Taiwan
stroke order at one of three difficulty tiers, logs every attempt on the device, and runs the calibration session the
spec requires before the tiers are trusted.

**Architecture:** The app is a Vite + React + TypeScript app. Stroke data is generated at build time:
- the generator takes each character from AnimCJK's Taiwan set or from hanzi-writer-data, or from a hand-composed
  override;
- it accepts a source only if that source's stroke count equals the MOE count printed in the textbook;
- it writes one JSON file per character into `public/strokes/`.

A `WritingPad` component wraps Hanzi Writer's quiz mode. It applies the tier settings, detects finger or Pencil on
every stroke, rejects resting palms, and emits one `AttemptRecord` per attempt. The record is stored in IndexedDB.
Three lab screens make up v1's first on-device milestone: an input probe, a stroke-order review and a calibration run.

**Tech Stack:** Node 26, TypeScript 5.8.3, React 19.1.0, Vite 6.3.5, Vitest 3.2.4 (jsdom 26.1.0),
@testing-library/react 16.3.0, hanzi-writer 3.7.3, hanzi-writer-data 2.0.1 (build-time only), idb 8.0.3,
fake-indexeddb 6.0.1, tsx 4.20.3.

**Spec:** `docs/superpowers/specs/2026-10-09-spellscript-chinese-design.md`. This plan covers spec §5 (handwriting,
tiers, input, calibration, attempt log), the stroke-data part of §4, and the storage part of §7.

**This is Plan 1 of 3.** Plan 2: learning model and game (evidence ladder, Memory Spirits, story levels, map, trials,
Guanyin's lessons, 注音, the strings table). Plan 3: parent screen, back up and restore, offline PWA, English toggle,
GitHub Pages release. Each plan is written once the previous one is done, so it can build on what was actually learned.

**Spec items deliberately left to later plans:**
- Plan 2:
  - stroke-named feedback ("第3筆是撇…");
  - tier suggestions from the 90% / 65% success rates (these need real sessions);
  - the evidence ladder and Memory Spirit schedule;
  - 注音 data;
  - the content-check rules for simplified or mainland words, missing 注音, level budgets and story lines;
  - the strings table.
- Plan 3:
  - back up and restore;
  - the parent screen;
  - offline PWA;
  - GitHub Pages.

## Global Constraints

- Script and standard: Traditional, Taiwan MOE 國字標準字體. Stroke counts and stroke order follow MOE 筆順.
- Stroke data from AnimCJK `zhHant`, each character verified against MOE 筆順. hanzi-writer-data is allowed as a
  second source only when its stroke count equals the MOE count. A mismatched source is never used silently.
- Handwriting: Hanzi Writer quiz mode. A stroke is accepted only if it is the next stroke in MOE order.
- Tiers are exactly the spec §5 table: 見習 / 修行 / 大師; outline faint/none/none; hint after 1/2/3 misses; tolerance
  loose/medium/tight; the attempt fails at 6/4/2 mistakes; backwards accepted / accepted-and-logged / counts as a
  mistake.
- `markStrokeCorrectAfterMisses` is always `false`. Hanzi Writer must never mark a wrong stroke correct.
- Input is detected on every stroke. While a Pencil is in use, finger/palm touches are ignored.
- No accounts, no analytics, no network calls at run time except loading the app's own files. All child data stays
  on the device.
- No typed names. Profiles use a nickname picked from a fixed list.
- No real child name in any file, test, fixture, commit or doc.
- No pinyin shown to the child.
- Stroke data carries the Arphic Public License notice.
- Data files are JSON (this settles spec §4's "JSON or YAML").
- Every test that guards a bug is proven by re-introducing the bug and watching it fail (spec §8). Steps marked
  **Prove the test** do this.

## Review Focus

These are the five inputs the spec implies but no feature test would naturally hit, most likely first. Each one has
its test in the task named.

1. **A palm resting on the screen while writing with the Pencil.** A finger touch that starts, moves or ends during
   Pencil use must not end or bend the Pencil stroke. Tests: Task 7 (`PalmFilter`) and Task 10 (a blocked palm
   `touchend` never reaches Hanzi Writer).
2. **A tap without moving.** Hanzi Writer silently skips single-point strokes. The raw-stroke log must skip them too,
   or every later stroke's raw points are paired with the wrong stroke. Test: Task 8 (`RawStrokeQueue`).
3. **A hand-made override with the wrong stroke count.** It must fail loudly. It must not quietly fall back to
   mainland-order data. Test: Task 3.
4. **The child leaves mid-character** (navigates away, or the screen unmounts). The attempt is saved as `abandoned`,
   never as `failed` or `passed`. Test: Task 10.
5. **IndexedDB unavailable or persistence refused** (private browsing, storage full). Writing still works, the screen
   says progress will not be kept, and nothing throws. Test: Task 9.

---

## File structure

```
spellscript-chinese/
  package.json, tsconfig.json, vite.config.ts, index.html, .gitignore
  vendor/animcjk/graphicsZhHant.txt     AnimCJK Taiwan stroke data (pinned commit), plus COPYING.txt, APL.txt
  content/
    curricula/*.json                    (exists) 生字 per lesson
    extra-characters.json               look-alike test characters not in any curriculum
    calibration.json                    calibration and look-alike sets
    strokes/compose-recipes.json        hand-composed Taiwan forms (input to the compose tool)
    strokes/overrides/<char>.json       compose-tool output (input to build-strokes)
    strokes/verified.json               characters a person has checked against MOE 筆順
    strokes/report.json                 build-strokes output: where each character's data came from
  public/strokes/<HEX>.json, LICENSE.txt  generated per-character stroke data that the app loads
  tools/
    lib/sources.ts                      read AnimCJK, hanzi-writer-data, overrides from disk
    build-strokes.ts                    CLI: select sources, write public/strokes and report.json
    compose-strokes.ts                  CLI: apply compose recipes, write overrides
    check-content.ts                    CLI: fail on any content problem
    validate_curriculum_source.py       (exists) Unihan check used when transcribing 生字
  src/
    main.tsx, App.tsx                   entry and hash router
    content/types.ts                    shared content types
    content/curriculum.ts               validateCurriculum, writeChars
    content/targets.ts                  collectTargets: every character and its MOE count
    content/strokeSelect.ts             selectStrokeData: source priority with the count rule
    content/strokeFiles.ts              charToFile, loadStrokeJson
    content/compose.ts                  transplant a component's strokes into another character
    content/check.ts                    checkContent: all content rules as one pure function
    writing/tiers.ts                    TIERS, quizOptionsFor, showOutlineFor
    writing/input.ts                    classifyInput, PalmFilter
    writing/rawStrokes.ts               RawStrokeQueue
    writing/attempt.ts                  AttemptRecord and its pure builder
    writing/WritingPad.tsx              Hanzi Writer wrapper
    writing/StrokeDiagram.tsx           numbered static drawing of a character's strokes
    storage/db.ts                       IndexedDB store, memory fallback, persistence request
    storage/profiles.ts                 Profile type, nickname and avatar lists
    lab/InputProbe.tsx                  shows what the iPad reports for finger and Pencil
    lab/StrokeReview.tsx                stroke-order review, with export of verified.json
    lab/calibrationSummary.ts           pure summary of calibration attempts
    lab/Calibration.tsx                 calibration and look-alike session
  docs/calibration/                     results of on-device sessions (no names)
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`,
  `src/App.tsx`, `src/App.test.tsx`

**Interfaces:**
- Produces: `npm test`, `npm run dev`, `npm run dev:ipad`, `npm run build`. The default export `App` from
  `src/App.tsx` (replaced in Task 11).

- [ ] **Step 1: Write the config files**

`package.json`:
```json
{
  "name": "spellscript-chinese",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:ipad": "vite --host",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "build-strokes": "tsx tools/build-strokes.ts",
    "compose-strokes": "tsx tools/compose-strokes.ts",
    "check-content": "tsx tools/check-content.ts"
  },
  "dependencies": {
    "hanzi-writer": "3.7.3",
    "idb": "8.0.3",
    "react": "19.1.0",
    "react-dom": "19.1.0"
  },
  "devDependencies": {
    "@testing-library/react": "16.3.0",
    "@types/node": "22.15.30",
    "@types/react": "19.1.8",
    "@types/react-dom": "19.1.6",
    "@vitejs/plugin-react": "4.5.2",
    "fake-indexeddb": "6.0.1",
    "hanzi-writer-data": "2.0.1",
    "jsdom": "26.1.0",
    "tsx": "4.20.3",
    "typescript": "5.8.3",
    "vite": "6.3.5",
    "vitest": "3.2.4"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client", "node", "vitest/globals"]
  },
  "include": ["src", "tools", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
```

`.gitignore`:
```
node_modules/
dist/
.DS_Store
```

`index.html`:
```html
<!doctype html>
<html lang="zh-Hant-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>SpellScript Chinese</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 2: Write the failing smoke test**

`src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the app name', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('SpellScript Chinese');
});
```

- [ ] **Step 3: Install and run the test to verify it fails**

Run: `npm install && npm test`
Expected: FAIL. `./App` cannot be resolved.

- [ ] **Step 4: Write `src/App.tsx`**

```tsx
export default function App() {
  return (
    <main>
      <h1>SpellScript Chinese</h1>
    </main>
  );
}
```

- [ ] **Step 5: Run tests and the type check**

Run: `npm test && npx tsc --noEmit`
Expected: 1 test passes, and there are no type errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .gitignore src/
git commit -m "Scaffold Vite + React + TypeScript app with Vitest"
```

---

### Task 2: Curriculum types and validation

**Files:**
- Create: `src/content/types.ts`, `src/content/curriculum.ts`, `src/content/curriculum.test.ts`

**Interfaces:**
- Produces:
  - types `CurriculumChar`, `Lesson`, `Curriculum`, `StrokeJson`, `ExtraChar`;
  - `validateCurriculum(c: Curriculum): CurriculumProblem[]`;
  - `writeChars(c: Curriculum): { char: string; totalStrokes: number }[]`.

- [ ] **Step 1: Write the types**

`src/content/types.ts`:
```ts
export type CurriculumChar = {
  char: string;
  radical: string;
  strokesAfterRadical: number;
  totalStrokes: number;
  zhuyin: string | null;
  taiwanStandardDiffers?: boolean;
};

export type Lesson = { lesson: number; title: string; write: CurriculumChar[] };

export type Curriculum = {
  id: string;
  publisher: string;
  grade: number;
  semester: number;
  book: string;
  edition: string;
  sourcePages: string;
  note: string;
  lessons: Lesson[];
};

/** Hanzi Writer / Make Me a Hanzi format: 1024-unit box, y axis up, baseline at y = -124. */
export type StrokeJson = { strokes: string[]; medians: number[][][] };

/** A character needed outside any curriculum (e.g. a look-alike test), with its MOE total stroke count. */
export type ExtraChar = { char: string; totalStrokes: number; why: string };
```

- [ ] **Step 2: Write the failing tests**

`src/content/curriculum.test.ts`:
```ts
import g2 from '../../content/curricula/kangxuan-g2-1.json';
import g4 from '../../content/curricula/kangxuan-g4-1.json';
import { validateCurriculum, writeChars } from './curriculum';
import type { Curriculum } from './types';

const fixture = (chars: { char: string; total?: number; after?: number }[]): Curriculum => ({
  id: 't', publisher: 'p', grade: 1, semester: 1, book: 'b', edition: 'e', sourcePages: 's', note: 'n',
  lessons: [{
    lesson: 1, title: 't',
    write: chars.map(c => ({
      char: c.char, radical: '人', strokesAfterRadical: c.after ?? 1, totalStrokes: c.total ?? 3, zhuyin: null,
    })),
  }],
});

test('the transcribed 康軒 lists are clean', () => {
  expect(validateCurriculum(g2 as unknown as Curriculum)).toEqual([]);
  expect(validateCurriculum(g4 as unknown as Curriculum)).toEqual([]);
  expect(writeChars(g2 as unknown as Curriculum)).toHaveLength(216);
  expect(writeChars(g4 as unknown as Curriculum)).toHaveLength(180);
});

test('punctuation in a write target is a problem (the prototype crashed on ，)', () => {
  expect(validateCurriculum(fixture([{ char: '，' }]))[0]?.problem).toBe('not a single Han character');
});

test('two characters in one entry is a problem', () => {
  expect(validateCurriculum(fixture([{ char: '小狗' }]))).toHaveLength(1);
});

test('a duplicate character is a problem', () => {
  expect(validateCurriculum(fixture([{ char: '人' }, { char: '人' }]))[0]?.problem).toBe('duplicate of lesson 1');
});

test('impossible stroke counts are a problem', () => {
  expect(validateCurriculum(fixture([{ char: '人', total: 2, after: 5 }]))[0]?.problem).toBe('impossible stroke counts');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/content/curriculum.test.ts`
Expected: FAIL. `./curriculum` cannot be resolved.

- [ ] **Step 4: Implement**

`src/content/curriculum.ts`:
```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/content/curriculum.test.ts`
Expected: 5 pass.

- [ ] **Step 6: Prove the test.** Temporarily change `HAN` to `/^./u`. Run the test file. Expected: the punctuation
  test and the two-character test FAIL. Revert and confirm all 5 pass.

- [ ] **Step 7: Commit**

```bash
git add src/content
git commit -m "Add curriculum types and validation"
```

---

### Task 3: Stroke source selection with the count rule

**Files:**
- Create: `src/content/strokeSelect.ts`, `src/content/strokeSelect.test.ts`

**Interfaces:**
- Consumes: `StrokeJson` (Task 2).
- Produces:
  - `type StrokeSourceName = 'override' | 'animcjk-zhHant' | 'hanzi-writer-data'`;
  - `type Selection = { char; expected; chosen: { source; data } | null; rejected: { source; count }[]; overrideMismatch: boolean }`;
  - `selectStrokeData(char: string, expected: number, candidates: Partial<Record<StrokeSourceName, StrokeJson>>): Selection`.

- [ ] **Step 1: Write the failing tests**

`src/content/strokeSelect.test.ts`:
```ts
import { selectStrokeData } from './strokeSelect';
import type { StrokeJson } from './types';

const data = (n: number): StrokeJson => ({
  strokes: Array.from({ length: n }, (_, i) => `M ${i} 0 L ${i} 10 Z`),
  medians: Array.from({ length: n }, (_, i) => [[i, 0], [i, 10]]),
});

test('prefers AnimCJK Taiwan data when its count matches MOE', () => {
  const s = selectStrokeData('花', 8, { 'animcjk-zhHant': data(8), 'hanzi-writer-data': data(8) });
  expect(s.chosen?.source).toBe('animcjk-zhHant');
});

test('falls back to hanzi-writer-data only when its count matches', () => {
  const s = selectStrokeData('追', 9, { 'animcjk-zhHant': data(10), 'hanzi-writer-data': data(9) });
  expect(s.chosen?.source).toBe('hanzi-writer-data');
  expect(s.rejected).toEqual([{ source: 'animcjk-zhHant', count: 10 }]);
});

test('chooses nothing when no source matches MOE', () => {
  const s = selectStrokeData('茄', 9, { 'hanzi-writer-data': data(8) });
  expect(s.chosen).toBeNull();
  expect(s.rejected).toEqual([{ source: 'hanzi-writer-data', count: 8 }]);
});

test('a hand-made override with the wrong count fails loudly and does not fall back', () => {
  const s = selectStrokeData('茄', 9, { override: data(8), 'animcjk-zhHant': data(9) });
  expect(s.chosen).toBeNull();
  expect(s.overrideMismatch).toBe(true);
});

test('an override with the right count wins over everything', () => {
  const s = selectStrokeData('茄', 9, { override: data(9), 'animcjk-zhHant': data(9) });
  expect(s.chosen?.source).toBe('override');
});

test('strokes and medians must both match the count', () => {
  const broken = { strokes: data(9).strokes, medians: data(8).medians };
  expect(selectStrokeData('茄', 9, { 'animcjk-zhHant': broken }).chosen).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/content/strokeSelect.test.ts`
Expected: FAIL. The module is not found.

- [ ] **Step 3: Implement**

`src/content/strokeSelect.ts`:
```ts
import type { StrokeJson } from './types';

export type StrokeSourceName = 'override' | 'animcjk-zhHant' | 'hanzi-writer-data';

export type Selection = {
  char: string;
  expected: number;
  chosen: { source: StrokeSourceName; data: StrokeJson } | null;
  rejected: { source: StrokeSourceName; count: number }[];
  overrideMismatch: boolean;
};

const ORDER: StrokeSourceName[] = ['override', 'animcjk-zhHant', 'hanzi-writer-data'];

export function selectStrokeData(
  char: string,
  expected: number,
  candidates: Partial<Record<StrokeSourceName, StrokeJson>>,
): Selection {
  const rejected: Selection['rejected'] = [];
  for (const source of ORDER) {
    const d = candidates[source];
    if (!d) continue;
    if (d.strokes.length === expected && d.medians.length === expected) {
      return { char, expected, chosen: { source, data: { strokes: d.strokes, medians: d.medians } }, rejected, overrideMismatch: false };
    }
    rejected.push({ source, count: d.strokes.length });
    // A person made this file on purpose; a wrong count means the recipe is wrong. Never paper over it with mainland data.
    if (source === 'override') return { char, expected, chosen: null, rejected, overrideMismatch: true };
  }
  return { char, expected, chosen: null, rejected, overrideMismatch: false };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/content/strokeSelect.test.ts`
Expected: 6 pass.

- [ ] **Step 5: Prove the test.** Delete the `if (source === 'override') return …` line. Expected: the "fails loudly"
  test FAILS (it picks `animcjk-zhHant`). Restore the line.

- [ ] **Step 6: Commit**

```bash
git add src/content/strokeSelect.ts src/content/strokeSelect.test.ts
git commit -m "Select stroke data by source priority, accepting only MOE stroke counts"
```

---

### Task 4: Build the stroke files, and the content check

**Files:**
- Create:
  - `vendor/animcjk/graphicsZhHant.txt`, `vendor/animcjk/COPYING.txt`, `vendor/animcjk/APL.txt`,
    `vendor/animcjk/SOURCE.md`;
  - `content/extra-characters.json`, `content/calibration.json`, `content/strokes/verified.json`,
    `content/strokes/overrides/.gitkeep`, `content/strokes/compose-recipes.json`;
  - `src/content/targets.ts`, `src/content/targets.test.ts`;
  - `src/content/strokeFiles.ts`, `src/content/strokeFiles.test.ts`;
  - `src/content/check.ts`, `src/content/check.test.ts`;
  - `tools/lib/sources.ts`, `tools/build-strokes.ts`, `tools/check-content.ts`;
  - generated: `public/strokes/*.json`, `public/strokes/LICENSE.txt`, `content/strokes/report.json`.

**Interfaces:**
- Consumes: `Curriculum`, `ExtraChar`, `StrokeJson`, `writeChars`, `validateCurriculum`, `selectStrokeData`,
  `StrokeSourceName`.
- Produces:
  - `collectTargets(curricula: Curriculum[], extras: ExtraChar[]): { targets: Map<string, number>; conflicts: string[] }`;
  - `charToFile(char: string): string` (e.g. `'年'` → `'5E74.json'`);
  - `loadStrokeJson(char: string): Promise<StrokeJson>` (browser);
  - `type StrokeReport = { generatedAt: string; chars: ReportEntry[] }`, where
    `ReportEntry = { char; expected; source: StrokeSourceName | null; rejected; overrideMismatch }`;
  - `type Verified = Record<string, { by: string; date: string }>`;
  - `checkContent(input): string[]`;
  - `type CalibrationSet = { tiers: Record<'apprentice'|'practice'|'master', string[]>; lookalikes: [string, string][] }`;
  - CLIs `npm run build-strokes` and `npm run check-content [-- --require-verified=calibration]`.

- [ ] **Step 1: Vendor AnimCJK at a pinned commit**

```bash
mkdir -p vendor/animcjk
SHA=ec5e17cca76c87587790bcbce5ea0b4d4fb753d6
curl -sSfL -o vendor/animcjk/graphicsZhHant.txt https://raw.githubusercontent.com/parsimonhi/animCJK/$SHA/graphicsZhHant.txt
curl -sSfL -o vendor/animcjk/COPYING.txt https://raw.githubusercontent.com/parsimonhi/animCJK/$SHA/licenses/COPYING.txt
curl -sSfL -o vendor/animcjk/APL.txt https://raw.githubusercontent.com/parsimonhi/animCJK/$SHA/licenses/APL
wc -l vendor/animcjk/graphicsZhHant.txt
```
Expected: `1013 vendor/animcjk/graphicsZhHant.txt`. If `licenses/APL` is a folder rather than a file, list it with
`curl -s https://api.github.com/repos/parsimonhi/animCJK/contents/licenses/APL?ref=$SHA` and fetch the licence text
file inside it.

`vendor/animcjk/SOURCE.md`:
```markdown
# AnimCJK (vendored)

`graphicsZhHant.txt` is from https://github.com/parsimonhi/animCJK at commit
ec5e17cca76c87587790bcbce5ea0b4d4fb753d6 (2026-05-13). Licence: Arphic Public License (see `APL.txt`, `COPYING.txt`).
One JSON object per line: `{"character", "strokes", "medians"}`, in the Make Me a Hanzi coordinate system.
Do not edit. Corrections go in `content/strokes/compose-recipes.json` or `content/strokes/overrides/`.
```

- [ ] **Step 2: Write the content data files**

`content/extra-characters.json`. These are MOE totals; the reviewer confirms each one against
https://stroke-order.learningweb.moe.edu.tw during Task 13.
```json
[
  { "char": "土", "totalStrokes": 3, "why": "look-alike test 土/士" },
  { "char": "士", "totalStrokes": 3, "why": "look-alike test 土/士" },
  { "char": "人", "totalStrokes": 2, "why": "look-alike test 人/入" },
  { "char": "入", "totalStrokes": 2, "why": "look-alike test 人/入" },
  { "char": "大", "totalStrokes": 3, "why": "look-alike test 大/太/犬" },
  { "char": "太", "totalStrokes": 4, "why": "look-alike test 大/太/犬" },
  { "char": "犬", "totalStrokes": 4, "why": "look-alike test 大/太/犬" },
  { "char": "日", "totalStrokes": 4, "why": "look-alike test 日/目" },
  { "char": "目", "totalStrokes": 5, "why": "look-alike test 日/目" },
  { "char": "未", "totalStrokes": 5, "why": "look-alike test 未/末" },
  { "char": "末", "totalStrokes": 5, "why": "look-alike test 未/末" },
  { "char": "己", "totalStrokes": 3, "why": "look-alike test 己/已" },
  { "char": "已", "totalStrokes": 3, "why": "look-alike test 己/已" },
  { "char": "午", "totalStrokes": 4, "why": "look-alike test 午/牛" }
]
```

`content/calibration.json`. All of these are grade-2 生字 that both children already write well. The look-alike pair
is `[expected, written]`: the pad expects the first character and the adult writes the second.
```json
{
  "tiers": {
    "apprentice": ["木", "田", "中", "力", "用"],
    "practice": ["方", "只", "本", "火", "月"],
    "master": ["牛", "年", "打", "全", "石"]
  },
  "lookalikes": [["土", "士"], ["士", "土"], ["人", "入"], ["大", "太"], ["大", "犬"], ["日", "目"], ["未", "末"], ["己", "已"], ["午", "牛"]]
}
```

`content/strokes/verified.json`: `{}`

`content/strokes/compose-recipes.json`: `[]` (filled in Tasks 5 and 12).

`content/strokes/overrides/.gitkeep`: empty file.

- [ ] **Step 3: Write the failing tests for `collectTargets`, `charToFile` and `checkContent`**

`src/content/targets.test.ts`:
```ts
import { collectTargets } from './targets';
import type { Curriculum, ExtraChar } from './types';

const cur = (chars: [string, number][]): Curriculum => ({
  id: 'c', publisher: 'p', grade: 2, semester: 1, book: 'b', edition: 'e', sourcePages: 's', note: 'n',
  lessons: [{ lesson: 1, title: 't', write: chars.map(([char, totalStrokes]) => ({ char, radical: '人', strokesAfterRadical: 0, totalStrokes, zhuyin: null })) }],
});

test('merges curricula and extras into one character → MOE count map', () => {
  const extras: ExtraChar[] = [{ char: '士', totalStrokes: 3, why: 'x' }];
  const { targets, conflicts } = collectTargets([cur([['年', 6]]), cur([['花', 8]])], extras);
  expect([...targets]).toEqual([['年', 6], ['花', 8], ['士', 3]]);
  expect(conflicts).toEqual([]);
});

test('the same character with two different counts is a conflict', () => {
  const { conflicts } = collectTargets([cur([['年', 6]])], [{ char: '年', totalStrokes: 5, why: 'x' }]);
  expect(conflicts).toEqual(['年: 6 in one source, 5 in another']);
});
```

`src/content/strokeFiles.test.ts`:
```ts
import { charToFile } from './strokeFiles';

test('file names are the upper-case hex code point', () => {
  expect(charToFile('年')).toBe('5E74.json');
  expect(charToFile('𠂤')).toBe('200A4.json');
});

test('rejects anything that is not exactly one character', () => {
  expect(() => charToFile('小狗')).toThrow();
  expect(() => charToFile('')).toThrow();
});
```

`src/content/check.test.ts`:
```ts
import { checkContent, type StrokeReport } from './check';
import type { Curriculum } from './types';

const cur: Curriculum = {
  id: 'c', publisher: 'p', grade: 2, semester: 1, book: 'b', edition: 'e', sourcePages: 's', note: 'n',
  lessons: [{ lesson: 1, title: 't', write: [
    { char: '年', radical: '干', strokesAfterRadical: 3, totalStrokes: 6, zhuyin: null },
    { char: '茄', radical: '艸', strokesAfterRadical: 5, totalStrokes: 9, zhuyin: null },
  ] }],
};
const report = (entries: StrokeReport['chars']): StrokeReport => ({ generatedAt: 'x', chars: entries });
const ok = (char: string, expected: number) => ({ char, expected, source: 'animcjk-zhHant' as const, rejected: [], overrideMismatch: false });

test('clean content has no problems', () => {
  expect(checkContent({ curricula: [cur], extras: [], report: report([ok('年', 6), ok('茄', 9)]), verified: {}, requireVerified: [] })).toEqual([]);
});

test('a character with no MOE-count data is a problem, naming what was rejected', () => {
  const r = report([ok('年', 6), { char: '茄', expected: 9, source: null, rejected: [{ source: 'hanzi-writer-data', count: 8 }], overrideMismatch: false }]);
  expect(checkContent({ curricula: [cur], extras: [], report: r, verified: {}, requireVerified: [] }))
    .toEqual(['茄: no stroke data with the MOE count 9 (rejected: hanzi-writer-data 8)']);
});

test('a stale report (character missing from it) is a problem', () => {
  expect(checkContent({ curricula: [cur], extras: [], report: report([ok('年', 6)]), verified: {}, requireVerified: [] }))
    .toEqual(['茄: not in content/strokes/report.json — run npm run build-strokes']);
});

test('an override with the wrong count is a problem', () => {
  const r = report([ok('年', 6), { char: '茄', expected: 9, source: null, rejected: [{ source: 'override', count: 8 }], overrideMismatch: true }]);
  expect(checkContent({ curricula: [cur], extras: [], report: r, verified: {}, requireVerified: [] }))
    .toContain('茄: override has 8 strokes but MOE says 9 — fix its compose recipe');
});

test('a required character that nobody has verified is a problem', () => {
  expect(checkContent({ curricula: [cur], extras: [], report: report([ok('年', 6), ok('茄', 9)]), verified: { 年: { by: 'founder', date: '2026-10-11' } }, requireVerified: ['年', '茄'] }))
    .toEqual(['茄: stroke order not yet verified against MOE 筆順']);
});

test('curriculum problems are reported', () => {
  const bad: Curriculum = { ...cur, lessons: [{ lesson: 1, title: 't', write: [{ char: '，', radical: '人', strokesAfterRadical: 0, totalStrokes: 1, zhuyin: null }] }] };
  expect(checkContent({ curricula: [bad], extras: [], report: report([]), verified: {}, requireVerified: [] })[0])
    .toBe('c lesson 1 「，」: not a single Han character');
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/content`
Expected: the three new files FAIL with "module not found". The Task 2 and Task 3 tests still pass.

- [ ] **Step 5: Implement the pure modules**

`src/content/targets.ts`:
```ts
import { writeChars } from './curriculum';
import type { Curriculum, ExtraChar } from './types';

export function collectTargets(curricula: Curriculum[], extras: ExtraChar[]) {
  const targets = new Map<string, number>();
  const conflicts: string[] = [];
  const add = (char: string, n: number) => {
    const prev = targets.get(char);
    if (prev === undefined) targets.set(char, n);
    else if (prev !== n) conflicts.push(`${char}: ${prev} in one source, ${n} in another`);
  };
  for (const c of curricula) for (const w of writeChars(c)) add(w.char, w.totalStrokes);
  for (const e of extras) add(e.char, e.totalStrokes);
  return { targets, conflicts };
}
```

`src/content/strokeFiles.ts`:
```ts
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
```

`src/content/check.ts`:
```ts
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
  for (const char of input.requireVerified) {
    if (!input.verified[char]) problems.push(`${char}: stroke order not yet verified against MOE 筆順`);
  }
  return problems;
}

export function calibrationChars(set: CalibrationSet): string[] {
  return [...new Set([...Object.values(set.tiers).flat(), ...set.lookalikes.flat()])];
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/content`
Expected: all pass (5 + 6 + 2 + 2 + 6).

- [ ] **Step 7: Prove the test.** In `checkContent`, change `if (!e || e.expected !== expected)` to `if (!e)`. Then
  add this test temporarily:
  ```ts
  test('tmp', () => { expect(checkContent({ curricula: [cur], extras: [], report: report([ok('年', 5), ok('茄', 9)]), verified: {}, requireVerified: [] })).toHaveLength(1); });
  ```
  Expected: it FAILS with 0 problems. A report built for an old count must count as stale. Restore the condition,
  keep the test, and rename it `'a report built for a different count is stale'`.

- [ ] **Step 8: Write the disk readers and the two CLIs**

`tools/lib/sources.ts`:
```ts
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
```

`tools/build-strokes.ts`:
```ts
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
```

`tools/check-content.ts`:
```ts
import { calibrationChars, checkContent, type CalibrationSet, type StrokeReport, type Verified } from '../src/content/check';
import { contentPath, loadCurricula, loadExtras, readJson } from './lib/sources';

const report = readJson<StrokeReport>(contentPath('strokes/report.json'));
const verified = readJson<Verified>(contentPath('strokes/verified.json'));
const requireCalibration = process.argv.includes('--require-verified=calibration');
const requireVerified = requireCalibration ? calibrationChars(readJson<CalibrationSet>(contentPath('calibration.json'))) : [];

const problems = checkContent({ curricula: loadCurricula(), extras: loadExtras(), report, verified, requireVerified });
const unverified = report.chars.filter(c => !verified[c.char]).length;
console.log(`stroke order verified against MOE: ${report.chars.length - unverified} of ${report.chars.length}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n` + problems.join('\n'));
  process.exit(1);
}
console.log('content check passed');
```

- [ ] **Step 9: Generate and check**

Run: `npm run build-strokes`
Expected (counted on 2026-10-10 against these exact sources):
```
characters: 410
  animcjk-zhHant: 227  hanzi-writer-data: 162  override: 0
  missing: 21  茄慌敬滑遨陀邀與遙蓓蕾薄郁阻塔逛芝邁搓謎鎚
```
The 410 characters are the 396 生字 plus the 14 extras. The split was counted in advance: 216 curriculum characters
and 11 extras from AnimCJK; 159 curriculum characters (including 追, whose AnimCJK count is wrong) and 士 犬 未 from
hanzi-writer-data. If the numbers differ, find out why before continuing. The 21 missing characters must be exactly
these. Any other missing character means a source failed to
load. Stop and investigate.

Run: `npm run check-content`
Expected: exit 1, with 21 lines `…: no stroke data with the MOE count …`. This is correct at this point; Tasks 5 and 12
fix them.

- [ ] **Step 10: Commit** (generated files included, so the app needs no build step to have data)

```bash
git add vendor content src/content tools public/strokes
git commit -m "Generate Taiwan stroke data per character with MOE count check; add content check"
```

---

### Task 5: Compose tool for Taiwan forms missing from both sources

**Files:**
- Create: `src/content/compose.ts`, `src/content/compose.test.ts`, `tools/compose-strokes.ts`
- Modify: `content/strokes/compose-recipes.json` (first recipe)

**Interfaces:**
- Consumes: `StrokeJson`, `loadZhHant`, `hanziWriterData`, `contentPath`, `readJson`.
- Produces:
  - `type Box = { minX: number; minY: number; maxX: number; maxY: number }`;
  - `medianBox(medians: number[][][]): Box`;
  - `transformPath(d: string, f: (x: number, y: number) => [number, number]): string`;
  - `type ComposeOp = { remove: number[]; insertAt: number; donor: { char: string; strokes: number[] | 'all' }; targetBox?: Box }`;
  - `type Recipe = { char: string; baseChar: string | null; ops: ComposeOp[]; note: string }`;
  - `compose(base: StrokeJson | null, ops: { op: ComposeOp; donor: StrokeJson }[]): StrokeJson`;
  - CLI `npm run compose-strokes`.

The idea: most of the 21 differ from mainland data by one component (艹 is 4 strokes in Taiwan, 辶 is 4, 阝 is 3). A
recipe removes that component's strokes from the mainland character and inserts the Taiwan component's strokes taken
from a character that AnimCJK already has right. The donor's strokes are scaled into the box the removed strokes
occupied.

- [ ] **Step 1: Write the failing tests**

`src/content/compose.test.ts`:
```ts
import { compose, medianBox, transformPath } from './compose';
import type { StrokeJson } from './types';

const line = (x1: number, y1: number, x2: number, y2: number) => ({ d: `M ${x1} ${y1} L ${x2} ${y2} Z`, m: [[x1, y1], [x2, y2]] });
const char = (...ls: ReturnType<typeof line>[]): StrokeJson => ({ strokes: ls.map(l => l.d), medians: ls.map(l => l.m) });

test('medianBox spans all median points', () => {
  expect(medianBox([[[0, 10], [5, 20]], [[3, -4]]])).toEqual({ minX: 0, minY: -4, maxX: 5, maxY: 20 });
});

test('transformPath maps every coordinate pair and keeps commands', () => {
  expect(transformPath('M 1 2 Q 3 4 5 6 L 7,8 Z', (x, y) => [x * 10, y + 1])).toBe('M 10 3 Q 30 5 50 7 L 70 9 Z');
  expect(transformPath('M435,513C476,579 516,656 533,680Z', (x, y) => [x, y])).toBe('M 435 513 C 476 579 516 656 533 680 Z');
});

test('replaces the removed strokes with donor strokes scaled into their box, in order', () => {
  const base = char(line(0, 0, 100, 0), line(0, 50, 100, 50), line(500, 0, 500, 900));
  const donor = char(line(0, 0, 10, 0), line(0, 5, 10, 5), line(0, 10, 10, 10), line(99, 99, 99, 99));
  const out = compose(base, [{ op: { remove: [0, 1], insertAt: 0, donor: { char: 'x', strokes: [0, 1, 2] } }, donor }]);
  expect(out.strokes).toHaveLength(4);
  expect(out.medians[0]).toEqual([[0, 0], [100, 0]]);
  expect(out.medians[1]).toEqual([[0, 25], [100, 25]]);
  expect(out.medians[2]).toEqual([[0, 50], [100, 50]]);
  expect(out.medians[3]).toEqual([[500, 0], [500, 900]]);
  expect(out.strokes[1]).toBe('M 0 25 L 100 25 Z');
});

test('inserting after the last base stroke appends', () => {
  const base = char(line(0, 0, 10, 0));
  const donor = char(line(0, 0, 1, 1));
  const out = compose(base, [{ op: { remove: [], insertAt: 1, donor: { char: 'x', strokes: 'all' }, targetBox: { minX: 0, minY: 0, maxX: 100, maxY: 100 } }, donor }]);
  expect(out.medians).toEqual([[[0, 0], [10, 0]], [[0, 0], [100, 100]]]);
});

test('rejects an out-of-range stroke index', () => {
  const base = char(line(0, 0, 10, 0));
  expect(() => compose(base, [{ op: { remove: [3], insertAt: 0, donor: { char: 'x', strokes: 'all' } }, donor: base }])).toThrow(/out of range/);
});

test('rejects an op with nothing removed and no target box', () => {
  const base = char(line(0, 0, 10, 0));
  expect(() => compose(base, [{ op: { remove: [], insertAt: 0, donor: { char: 'x', strokes: 'all' } }, donor: base }])).toThrow(/targetBox/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/content/compose.test.ts`
Expected: FAIL. The module is not found.

- [ ] **Step 3: Implement**

`src/content/compose.ts`:
```ts
import type { StrokeJson } from './types';

export type Box = { minX: number; minY: number; maxX: number; maxY: number };
export type ComposeOp = { remove: number[]; insertAt: number; donor: { char: string; strokes: number[] | 'all' }; targetBox?: Box };
export type Recipe = { char: string; baseChar: string | null; ops: ComposeOp[]; note: string };

export function medianBox(medians: number[][][]): Box {
  const pts = medians.flat();
  if (!pts.length) throw new Error('medianBox of no points');
  const xs = pts.map(p => p[0]!), ys = pts.map(p => p[1]!);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

const axis = (v: number, a0: number, a1: number, b0: number, b1: number) =>
  a1 === a0 ? (b0 + b1) / 2 : b0 + ((v - a0) * (b1 - b0)) / (a1 - a0);

function mapper(from: Box, to: Box) {
  return (x: number, y: number): [number, number] => [
    Math.round(axis(x, from.minX, from.maxX, to.minX, to.maxX)),
    Math.round(axis(y, from.minY, from.maxY, to.minY, to.maxY)),
  ];
}

/** Path data in these datasets uses only absolute M/L/Q/C/Z, so every number is part of an x,y pair. */
export function transformPath(d: string, f: (x: number, y: number) => [number, number]): string {
  const tokens = d.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g) ?? [];
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (/[A-Za-z]/.test(t)) { out.push(t); continue; }
    const [x, y] = f(Number(t), Number(tokens[++i]));
    out.push(String(x), String(y));
  }
  return out.join(' ');
}

export function compose(base: StrokeJson | null, ops: { op: ComposeOp; donor: StrokeJson }[]): StrokeJson {
  const n = base?.strokes.length ?? 0;
  const removed = new Set<number>();
  const inserts = new Map<number, StrokeJson[]>();
  for (const { op, donor } of ops) {
    for (const i of op.remove) {
      if (i < 0 || i >= n) throw new Error(`remove index ${i} out of range (base has ${n} strokes)`);
      removed.add(i);
    }
    if (op.insertAt < 0 || op.insertAt > n) throw new Error(`insertAt ${op.insertAt} out of range`);
    const idx = op.donor.strokes === 'all' ? donor.strokes.map((_, i) => i) : op.donor.strokes;
    for (const i of idx) if (i < 0 || i >= donor.strokes.length) throw new Error(`donor ${op.donor.char} index ${i} out of range`);
    let to = op.targetBox;
    if (!to) {
      if (!op.remove.length || !base) throw new Error('an op that removes nothing needs a targetBox');
      to = medianBox(op.remove.map(i => base.medians[i]!));
    }
    const f = mapper(medianBox(idx.map(i => donor.medians[i]!)), to);
    const part: StrokeJson = {
      strokes: idx.map(i => transformPath(donor.strokes[i]!, f)),
      medians: idx.map(i => donor.medians[i]!.map(([x, y]) => f(x!, y!))),
    };
    inserts.set(op.insertAt, [...(inserts.get(op.insertAt) ?? []), part]);
  }
  const out: StrokeJson = { strokes: [], medians: [] };
  const flush = (at: number) => {
    for (const p of inserts.get(at) ?? []) { out.strokes.push(...p.strokes); out.medians.push(...p.medians); }
  };
  for (let i = 0; i < n; i++) {
    flush(i);
    if (!removed.has(i)) { out.strokes.push(base!.strokes[i]!); out.medians.push(base!.medians[i]!); }
  }
  flush(n);
  return out;
}
```

Note on the test expectations: the donor's three strokes span y 0–10, and they are mapped onto the removed box y 0–50.
So the donor's y = 5 lands at 25, and its x 0–10 lands at 0–100.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/content/compose.test.ts`
Expected: 6 pass.

- [ ] **Step 5: Prove the test.** In `compose`, swap the order inside the loop (push the base stroke before
  `flush(i)`). Expected: the "in order" test FAILS. Revert.

- [ ] **Step 6: Write the CLI**

`tools/compose-strokes.ts`:
```ts
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
```

- [ ] **Step 7: Add the first recipe (茄 = Taiwan 艹 from 花 + mainland 加 from hanzi-writer-data)**

`content/strokes/compose-recipes.json`:
```json
[
  {
    "char": "茄",
    "baseChar": "茄",
    "ops": [{ "remove": [0, 1, 2], "insertAt": 0, "donor": { "char": "花", "strokes": [0, 1, 2, 3] } }],
    "note": "Mainland 艹 is 3 strokes; Taiwan 艹 is 4 (from AnimCJK 花, MOE 8 strokes)."
  }
]
```

Run: `npm run compose-strokes && npm run build-strokes && npm run check-content`
Expected: `茄: 9 strokes`. build-strokes now reports `override: 1` and lists 20 missing characters, without 茄.
check-content shows 20 problems.

- [ ] **Step 8: Commit**

```bash
git add src/content/compose.ts src/content/compose.test.ts tools/compose-strokes.ts content/strokes public/strokes
git commit -m "Add component compose tool for Taiwan forms; compose 茄"
```

---

### Task 6: Tier settings

**Files:**
- Create: `src/writing/tiers.ts`, `src/writing/tiers.test.ts`

**Interfaces:**
- Produces:
  - `type TierId = 'apprentice' | 'practice' | 'master'`;
  - `type InputKind = 'pen' | 'finger' | 'mouse'`;
  - `TIERS: Record<TierId, TierSettings>`;
  - `TIER_ORDER: TierId[]`;
  - `FINGER_LENIENCY_BONUS`;
  - `quizOptionsFor(tier: TierId, input: InputKind): { leniency: number; showHintAfterMisses: number; acceptBackwardsStrokes: boolean; markStrokeCorrectAfterMisses: false; highlightOnComplete: true }`;
  - `showOutlineFor(tier: TierId): boolean`.

- [ ] **Step 1: Write the failing tests**

`src/writing/tiers.test.ts`:
```ts
import { FINGER_LENIENCY_BONUS, TIERS, quizOptionsFor, showOutlineFor } from './tiers';

test('the three tiers match the spec table', () => {
  expect([TIERS.apprentice.labelZh, TIERS.practice.labelZh, TIERS.master.labelZh]).toEqual(['見習', '修行', '大師']);
  expect([showOutlineFor('apprentice'), showOutlineFor('practice'), showOutlineFor('master')]).toEqual([true, false, false]);
  expect([TIERS.apprentice.showHintAfterMisses, TIERS.practice.showHintAfterMisses, TIERS.master.showHintAfterMisses]).toEqual([1, 2, 3]);
  expect([TIERS.apprentice.maxMistakes, TIERS.practice.maxMistakes, TIERS.master.maxMistakes]).toEqual([6, 4, 2]);
  expect([TIERS.apprentice.acceptBackwardsStrokes, TIERS.practice.acceptBackwardsStrokes, TIERS.master.acceptBackwardsStrokes]).toEqual([true, true, false]);
  expect(TIERS.apprentice.leniency).toBeGreaterThan(TIERS.practice.leniency);
  expect(TIERS.practice.leniency).toBeGreaterThan(TIERS.master.leniency);
});

test('finger input adds a fixed tolerance allowance; pen and mouse do not', () => {
  expect(quizOptionsFor('practice', 'finger').leniency).toBeCloseTo(TIERS.practice.leniency + FINGER_LENIENCY_BONUS);
  expect(quizOptionsFor('practice', 'pen').leniency).toBe(TIERS.practice.leniency);
  expect(quizOptionsFor('practice', 'mouse').leniency).toBe(TIERS.practice.leniency);
});

test('Hanzi Writer is never allowed to mark a wrong stroke correct', () => {
  for (const t of ['apprentice', 'practice', 'master'] as const) {
    expect(quizOptionsFor(t, 'finger').markStrokeCorrectAfterMisses).toBe(false);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/writing/tiers.test.ts`
Expected: FAIL. The module is not found.

- [ ] **Step 3: Implement**

`src/writing/tiers.ts`:
```ts
export type TierId = 'apprentice' | 'practice' | 'master';
export type InputKind = 'pen' | 'finger' | 'mouse';

export type TierSettings = {
  id: TierId;
  labelZh: string;
  labelEn: string;
  showOutline: boolean;
  showHintAfterMisses: number;
  /** Hanzi Writer leniency: bigger is looser. Starting values; tuned after calibration (spec §5). */
  leniency: number;
  /** The attempt fails when total mistakes reach this number. */
  maxMistakes: number;
  acceptBackwardsStrokes: boolean;
};

export const TIERS: Record<TierId, TierSettings> = {
  apprentice: { id: 'apprentice', labelZh: '見習', labelEn: 'Apprentice', showOutline: true, showHintAfterMisses: 1, leniency: 1.4, maxMistakes: 6, acceptBackwardsStrokes: true },
  practice: { id: 'practice', labelZh: '修行', labelEn: 'Practice', showOutline: false, showHintAfterMisses: 2, leniency: 1.0, maxMistakes: 4, acceptBackwardsStrokes: true },
  master: { id: 'master', labelZh: '大師', labelEn: 'Master', showOutline: false, showHintAfterMisses: 3, leniency: 0.75, maxMistakes: 2, acceptBackwardsStrokes: false },
};

export const TIER_ORDER: TierId[] = ['apprentice', 'practice', 'master'];

/** Fingertips are less precise than a Pencil (spec §5). Starting value; tuned after calibration. */
export const FINGER_LENIENCY_BONUS = 0.2;

export function quizOptionsFor(tier: TierId, input: InputKind) {
  const t = TIERS[tier];
  return {
    leniency: t.leniency + (input === 'finger' ? FINGER_LENIENCY_BONUS : 0),
    showHintAfterMisses: t.showHintAfterMisses,
    acceptBackwardsStrokes: t.acceptBackwardsStrokes,
    markStrokeCorrectAfterMisses: false as const,
    highlightOnComplete: true as const,
  };
}

export const showOutlineFor = (tier: TierId) => TIERS[tier].showOutline;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/writing/tiers.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/writing/tiers.ts src/writing/tiers.test.ts
git commit -m "Add the three difficulty tiers and finger allowance"
```

---

### Task 7: Input classification and palm rejection

**Files:**
- Create: `src/writing/input.ts`, `src/writing/input.test.ts`

**Interfaces:**
- Consumes: `InputKind` (Task 6).
- Produces:
  - `type TouchKind = 'stylus' | 'direct'`;
  - `touchKinds(list: TouchList | ArrayLike<{ touchType?: string }>): TouchKind[]`;
  - `classifyPointer(pointerType: string): InputKind | null`;
  - `classifyTouch(kinds: TouchKind[]): InputKind | null`;
  - `class PalmFilter { notePen(now: number): void; shouldBlock(e: { primary: TouchKind | undefined; now: number }): boolean }`;
  - `PEN_GRACE_MS = 1500`.

iPadOS Safari reports an Apple Pencil touch with `Touch.touchType === 'stylus'` and a finger with `'direct'`. It also
reports `PointerEvent.pointerType` as `'pen'` and `'touch'`. Task 13 Step 2 proves this on the actual iPad before
anything depends on it.

- [ ] **Step 1: Write the failing tests**

`src/writing/input.test.ts`:
```ts
import { PEN_GRACE_MS, PalmFilter, classifyPointer, classifyTouch, touchKinds } from './input';

test('pointer types map to input kinds', () => {
  expect(classifyPointer('pen')).toBe('pen');
  expect(classifyPointer('touch')).toBe('finger');
  expect(classifyPointer('mouse')).toBe('mouse');
  expect(classifyPointer('')).toBeNull();
});

test('a stylus touch is a pen; a direct touch is a finger; unknown is null', () => {
  expect(classifyTouch(['stylus'])).toBe('pen');
  expect(classifyTouch(['direct'])).toBe('finger');
  expect(classifyTouch([])).toBeNull();
});

test('touchKinds reads Safari touchType and treats a missing value as direct', () => {
  expect(touchKinds([{ touchType: 'stylus' }, {}])).toEqual(['stylus', 'direct']);
});

test('after the Pencil is used, a finger or palm is blocked during the grace period', () => {
  const f = new PalmFilter();
  f.notePen(1000);
  expect(f.shouldBlock({ primary: 'direct', now: 1000 + PEN_GRACE_MS - 1 })).toBe(true);
  expect(f.shouldBlock({ primary: 'stylus', now: 1100 })).toBe(false);
});

test('a finger is allowed again once the Pencil has been idle for the grace period', () => {
  const f = new PalmFilter();
  f.notePen(1000);
  expect(f.shouldBlock({ primary: 'direct', now: 1000 + PEN_GRACE_MS + 1 })).toBe(false);
});

test('with no Pencil seen, fingers are never blocked', () => {
  expect(new PalmFilter().shouldBlock({ primary: 'direct', now: 5 })).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/writing/input.test.ts`
Expected: FAIL. The module is not found.

- [ ] **Step 3: Implement**

`src/writing/input.ts`:
```ts
import type { InputKind } from './tiers';

export type TouchKind = 'stylus' | 'direct';
export const PEN_GRACE_MS = 1500;

export function touchKinds(list: TouchList | ArrayLike<{ touchType?: string }>): TouchKind[] {
  return Array.from(list as ArrayLike<{ touchType?: string }>, t => (t.touchType === 'stylus' ? 'stylus' : 'direct'));
}

export function classifyPointer(pointerType: string): InputKind | null {
  if (pointerType === 'pen') return 'pen';
  if (pointerType === 'touch') return 'finger';
  if (pointerType === 'mouse') return 'mouse';
  return null;
}

export function classifyTouch(kinds: TouchKind[]): InputKind | null {
  if (!kinds.length) return null;
  return kinds[0] === 'stylus' ? 'pen' : 'finger';
}

/** While the Pencil is in use, ignore finger touches: they are almost always a resting palm (spec §5). */
export class PalmFilter {
  private lastPen = -Infinity;
  notePen(now: number) { this.lastPen = now; }
  shouldBlock(e: { primary: TouchKind | undefined; now: number }): boolean {
    return e.primary === 'direct' && e.now - this.lastPen <= PEN_GRACE_MS;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/writing/input.test.ts`
Expected: 6 pass.

- [ ] **Step 5: Prove the test.** Change `<=` to `<` and set the first grace-period assertion to `now: 1000 + PEN_GRACE_MS`.
  Confirm you understand which side of the boundary is tested. Revert both changes. Then change `'direct'` to
  `'stylus'` in `shouldBlock`. Expected: the "blocked during the grace period" test FAILS. Revert.

- [ ] **Step 6: Commit**

```bash
git add src/writing/input.ts src/writing/input.test.ts
git commit -m "Classify finger vs Pencil and reject palms while the Pencil is in use"
```

---

### Task 8: Raw stroke queue and the attempt record

**Files:**
- Create: `src/writing/rawStrokes.ts`, `src/writing/rawStrokes.test.ts`, `src/writing/attempt.ts`,
  `src/writing/attempt.test.ts`

**Interfaces:**
- Consumes: `TierId`, `InputKind`, `TIERS` (Task 6).
- Produces:
  - `type RawPoint = { x: number; y: number; t: number }`;
  - `type RawStroke = { input: InputKind; points: RawPoint[] }`;
  - `class RawStrokeQueue { begin(input, p): void; move(p): void; end(): void; take(): RawStroke | null; get pending(): number }`;
  - `type AttemptContext = 'calibration' | 'lookalike' | 'lesson' | 'seal' | 'story' | 'memory'`;
  - `type AttemptResult = 'passed' | 'failed' | 'abandoned'`;
  - `type StrokeEvent = { strokeNum: number; isCorrect: boolean; isBackwards: boolean; mistakesOnStroke: number; totalMistakes: number; drawn: { x: number; y: number }[] }`;
  - `type StrokeResult = { strokeNum; accepted; backwards; mistakesOnStroke; drawn; raw: RawStroke | null; hintShownAfter: boolean }`;
  - `type AttemptRecord = { id; profileId; char; expectedChar: string | null; word: string | null; context; tier; leniencyInput: InputKind; inputs: InputKind[]; outlineVisible: boolean; hintShown: boolean; strokes: StrokeResult[]; totalMistakes: number; result: AttemptResult; checker: string; startedAt: number; endedAt: number }`;
  - `startAttempt(init): AttemptState`;
  - `recordStroke(s: AttemptState, e: StrokeEvent, raw: RawStroke | null): AttemptState`;
  - `isOverMistakeLimit(s: AttemptState): boolean`;
  - `finishAttempt(s: AttemptState, result: AttemptResult, now: number): AttemptRecord`;
  - `CHECKER_VERSION`.

- [ ] **Step 1: Write the failing tests**

`src/writing/rawStrokes.test.ts`:
```ts
import { RawStrokeQueue } from './rawStrokes';

const p = (x: number, t: number) => ({ x, y: 0, t });

test('completed strokes come out in order with their input kind', () => {
  const q = new RawStrokeQueue();
  q.begin('pen', p(0, 0)); q.move(p(1, 10)); q.end();
  q.begin('finger', p(5, 20)); q.move(p(6, 30)); q.end();
  expect(q.take()).toEqual({ input: 'pen', points: [p(0, 0), p(1, 10)] });
  expect(q.take()?.input).toBe('finger');
  expect(q.take()).toBeNull();
});

test('a tap without moving is dropped, as Hanzi Writer drops it, so later strokes stay aligned', () => {
  const q = new RawStrokeQueue();
  q.begin('finger', p(0, 0)); q.end();                        // tap: Hanzi Writer fires no callback
  q.begin('finger', p(1, 1)); q.move(p(2, 2)); q.end();       // real stroke
  expect(q.pending).toBe(1);
  expect(q.take()?.points[0]).toEqual(p(1, 1));
});

test('move or end without begin is ignored', () => {
  const q = new RawStrokeQueue();
  q.move(p(1, 1)); q.end();
  expect(q.take()).toBeNull();
});
```

`src/writing/attempt.test.ts`:
```ts
import { CHECKER_VERSION, finishAttempt, isOverMistakeLimit, recordStroke, startAttempt, type StrokeEvent } from './attempt';
import type { RawStroke } from './rawStrokes';

const init = { id: 'a1', profileId: 'p1', char: '木', expectedChar: null, word: null, context: 'calibration' as const, tier: 'practice' as const, leniencyInput: 'finger' as const, outlineVisible: false, now: 100 };
const ev = (o: Partial<StrokeEvent>): StrokeEvent => ({ strokeNum: 0, isCorrect: true, isBackwards: false, mistakesOnStroke: 0, totalMistakes: 0, drawn: [{ x: 1, y: 1 }], ...o });
const raw = (input: RawStroke['input']): RawStroke => ({ input, points: [{ x: 0, y: 0, t: 0 }, { x: 1, y: 1, t: 5 }] });

test('a clean pass records every stroke and the inputs used', () => {
  let s = startAttempt(init);
  s = recordStroke(s, ev({ strokeNum: 0 }), raw('pen'));
  s = recordStroke(s, ev({ strokeNum: 1 }), raw('finger'));
  const r = finishAttempt(s, 'passed', 900);
  expect(r.strokes.map(x => x.accepted)).toEqual([true, true]);
  expect(r.inputs).toEqual(['pen', 'finger']);
  expect(r.hintShown).toBe(false);
  expect(r.totalMistakes).toBe(0);
  expect(r.checker).toBe(CHECKER_VERSION);
  expect([r.startedAt, r.endedAt, r.result]).toEqual([100, 900, 'passed']);
});

test('a hint is recorded once mistakes on a stroke reach the tier threshold (修行: 2)', () => {
  let s = startAttempt(init);
  s = recordStroke(s, ev({ isCorrect: false, mistakesOnStroke: 1, totalMistakes: 1 }), raw('finger'));
  expect(s.hintShown).toBe(false);
  s = recordStroke(s, ev({ isCorrect: false, mistakesOnStroke: 2, totalMistakes: 2 }), raw('finger'));
  expect(s.hintShown).toBe(true);
  expect(s.strokes[1]?.hintShownAfter).toBe(true);
});

test('the attempt is over the limit when total mistakes reach the tier maximum (修行: 4)', () => {
  let s = startAttempt(init);
  for (let m = 1; m <= 3; m++) s = recordStroke(s, ev({ isCorrect: false, mistakesOnStroke: m, totalMistakes: m }), null);
  expect(isOverMistakeLimit(s)).toBe(false);
  s = recordStroke(s, ev({ isCorrect: false, mistakesOnStroke: 4, totalMistakes: 4 }), null);
  expect(isOverMistakeLimit(s)).toBe(true);
});

test('a backwards stroke accepted at 修行 is kept and flagged', () => {
  const s = recordStroke(startAttempt(init), ev({ isCorrect: true, isBackwards: true }), raw('pen'));
  expect(s.strokes[0]).toMatchObject({ accepted: true, backwards: true });
});

test('a missing raw stroke is recorded as null, not invented', () => {
  const s = recordStroke(startAttempt(init), ev({}), null);
  expect(s.strokes[0]?.raw).toBeNull();
  expect(finishAttempt(s, 'passed', 1).inputs).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/writing/rawStrokes.test.ts src/writing/attempt.test.ts`
Expected: FAIL. The modules are not found.

- [ ] **Step 3: Implement**

`src/writing/rawStrokes.ts`:
```ts
import type { InputKind } from './tiers';

export type RawPoint = { x: number; y: number; t: number };
export type RawStroke = { input: InputKind; points: RawPoint[] };

/**
 * Records the child's actual strokes with timestamps. Hanzi Writer reports each evaluated stroke through a callback
 * but skips single-point taps without one, so taps are dropped here too. That keeps take() paired with the callbacks.
 */
export class RawStrokeQueue {
  private current: RawStroke | null = null;
  private done: RawStroke[] = [];
  begin(input: InputKind, p: RawPoint) { this.current = { input, points: [p] }; }
  move(p: RawPoint) { this.current?.points.push(p); }
  end() {
    if (this.current && this.current.points.length > 1) this.done.push(this.current);
    this.current = null;
  }
  take(): RawStroke | null { return this.done.shift() ?? null; }
  get pending() { return this.done.length; }
}
```

`src/writing/attempt.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/writing/rawStrokes.test.ts src/writing/attempt.test.ts`
Expected: 8 pass.

- [ ] **Step 5: Prove the test.** In `RawStrokeQueue.end`, change `> 1` to `> 0`. Expected: the tap test FAILS. Revert.
  In `recordStroke`, change `>=` to `>`. Expected: the hint test FAILS. Revert.

- [ ] **Step 6: Commit**

```bash
git add src/writing/rawStrokes.ts src/writing/rawStrokes.test.ts src/writing/attempt.ts src/writing/attempt.test.ts
git commit -m "Add raw stroke queue and attempt record builder"
```

---

### Task 9: Storage: profiles and attempts on the device

**Files:**
- Create: `src/storage/profiles.ts`, `src/storage/db.ts`, `src/storage/db.test.ts`

**Interfaces:**
- Consumes: `AttemptRecord` (Task 8), `TierId`, `InputKind` (Task 6).
- Produces:
  - `type Profile = { id: string; nickname: string; avatar: string; curriculumId: string; lesson: number; tier: TierId; lastInput: InputKind; createdAt: number }`;
  - `NICKNAMES`, `AVATARS`;
  - `interface Store { putProfile(p): Promise<void>; listProfiles(): Promise<Profile[]>; deleteProfile(id): Promise<void>; addAttempt(a): Promise<void>; attemptsFor(profileId): Promise<AttemptRecord[]> }`;
  - `openStoreOrMemory(name?: string): Promise<{ store: Store; persistent: boolean; reason: string | null }>`;
  - `requestPersistence(): Promise<'granted' | 'denied' | 'unsupported'>`;
  - `newId(): string`.

- [ ] **Step 1: Write the profiles module**

`src/storage/profiles.ts`:
```ts
import type { InputKind, TierId } from '../writing/tiers';

export type Profile = {
  id: string;
  nickname: string;
  avatar: string;
  curriculumId: string;
  lesson: number;
  tier: TierId;
  lastInput: InputKind;
  createdAt: number;
};

/** Picked from a list, never typed: no real names on the device (spec §6). */
export const NICKNAMES = ['小猴', '小龍', '小鶴', '小虎', '小兔', '小熊', '小鹿', '小魚'] as const;
export const AVATARS = ['🐒', '🐉', '🦢', '🐯', '🐰', '🐻', '🦌', '🐟'] as const;

export const newId = () => crypto.randomUUID();
```

- [ ] **Step 2: Write the failing tests**

`src/storage/db.test.ts`:
```ts
import 'fake-indexeddb/auto';
import { openStoreOrMemory } from './db';
import type { Profile } from './profiles';
import type { AttemptRecord } from '../writing/attempt';

const profile = (id: string): Profile => ({ id, nickname: '小猴', avatar: '🐒', curriculumId: 'kangxuan-g2-1', lesson: 3, tier: 'practice', lastInput: 'finger', createdAt: 1 });
const attempt = (id: string, profileId: string): AttemptRecord => ({
  id, profileId, char: '木', expectedChar: null, word: null, context: 'calibration', tier: 'practice', leniencyInput: 'finger',
  inputs: ['finger'], outlineVisible: false, hintShown: false, strokes: [], totalMistakes: 0, result: 'passed',
  checker: 'x', startedAt: 1, endedAt: 2,
});

test('profiles and attempts round-trip through IndexedDB', async () => {
  const { store, persistent } = await openStoreOrMemory('t1');
  expect(persistent).toBe(true);
  await store.putProfile(profile('p1'));
  await store.addAttempt(attempt('a1', 'p1'));
  await store.addAttempt(attempt('a2', 'p2'));
  expect((await store.listProfiles()).map(p => p.id)).toEqual(['p1']);
  expect((await store.attemptsFor('p1')).map(a => a.id)).toEqual(['a1']);
});

test('deleting a profile deletes its attempts and nothing else', async () => {
  const { store } = await openStoreOrMemory('t2');
  await store.putProfile(profile('p1'));
  await store.putProfile(profile('p2'));
  await store.addAttempt(attempt('a1', 'p1'));
  await store.addAttempt(attempt('a2', 'p2'));
  await store.deleteProfile('p1');
  expect((await store.listProfiles()).map(p => p.id)).toEqual(['p2']);
  expect(await store.attemptsFor('p1')).toEqual([]);
  expect((await store.attemptsFor('p2')).map(a => a.id)).toEqual(['a2']);
});

test('with no IndexedDB, writing still works in memory and says progress will not be kept', async () => {
  const saved = globalThis.indexedDB;
  // @ts-expect-error simulate a browser without IndexedDB (private mode, blocked storage)
  delete globalThis.indexedDB;
  try {
    const { store, persistent, reason } = await openStoreOrMemory('t3');
    expect(persistent).toBe(false);
    expect(reason).toMatch(/IndexedDB/);
    await store.addAttempt(attempt('a1', 'p1'));
    expect(await store.attemptsFor('p1')).toHaveLength(1);
  } finally {
    globalThis.indexedDB = saved;
  }
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/storage/db.test.ts`
Expected: FAIL. `./db` is not found.

- [ ] **Step 4: Implement**

`src/storage/db.ts`:
```ts
import { openDB, type DBSchema } from 'idb';
import type { AttemptRecord } from '../writing/attempt';
import type { Profile } from './profiles';

interface Schema extends DBSchema {
  profiles: { key: string; value: Profile };
  attempts: { key: string; value: AttemptRecord; indexes: { byProfile: string } };
}

export interface Store {
  putProfile(p: Profile): Promise<void>;
  listProfiles(): Promise<Profile[]>;
  deleteProfile(id: string): Promise<void>;
  addAttempt(a: AttemptRecord): Promise<void>;
  attemptsFor(profileId: string): Promise<AttemptRecord[]>;
}

async function openIdb(name: string): Promise<Store> {
  const db = await openDB<Schema>(name, 1, {
    upgrade(db) {
      db.createObjectStore('profiles', { keyPath: 'id' });
      db.createObjectStore('attempts', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
    },
  });
  return {
    async putProfile(p) { await db.put('profiles', p); },
    listProfiles: () => db.getAll('profiles'),
    async deleteProfile(id) {
      const tx = db.transaction(['profiles', 'attempts'], 'readwrite');
      await tx.objectStore('profiles').delete(id);
      const idx = tx.objectStore('attempts').index('byProfile');
      for (let c = await idx.openCursor(id); c; c = await c.continue()) await c.delete();
      await tx.done;
    },
    async addAttempt(a) { await db.put('attempts', a); },
    attemptsFor: id => db.getAllFromIndex('attempts', 'byProfile', id),
  };
}

function memoryStore(): Store {
  const profiles = new Map<string, Profile>();
  const attempts = new Map<string, AttemptRecord>();
  return {
    async putProfile(p) { profiles.set(p.id, p); },
    async listProfiles() { return [...profiles.values()]; },
    async deleteProfile(id) {
      profiles.delete(id);
      for (const [k, a] of attempts) if (a.profileId === id) attempts.delete(k);
    },
    async addAttempt(a) { attempts.set(a.id, a); },
    async attemptsFor(id) { return [...attempts.values()].filter(a => a.profileId === id); },
  };
}

/** Never throws: if IndexedDB is unavailable, writing still works and the caller shows `reason` (Review Focus 5). */
export async function openStoreOrMemory(name = 'spellscript') {
  if (typeof indexedDB === 'undefined') {
    return { store: memoryStore(), persistent: false, reason: 'IndexedDB is not available, so progress will not be kept.' };
  }
  try {
    return { store: await openIdb(name), persistent: true, reason: null as string | null };
  } catch (err) {
    return { store: memoryStore(), persistent: false, reason: `IndexedDB failed to open (${String(err)}), so progress will not be kept.` };
  }
}

export async function requestPersistence(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!navigator.storage?.persist) return 'unsupported';
  try { return (await navigator.storage.persist()) ? 'granted' : 'denied'; } catch { return 'denied'; }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/storage/db.test.ts`
Expected: 3 pass.

- [ ] **Step 6: Prove the test.** Remove the `for (let c = …)` cursor loop in `deleteProfile`. Expected: the deletion
  test FAILS. Revert.

- [ ] **Step 7: Commit**

```bash
git add src/storage
git commit -m "Store profiles and attempts in IndexedDB with an in-memory fallback"
```

---

### Task 10: WritingPad component

**Files:**
- Create: `src/writing/WritingPad.tsx`, `src/writing/WritingPad.test.tsx`, `src/writing/StrokeDiagram.tsx`

**Interfaces:**
- Consumes: `quizOptionsFor`, `showOutlineFor`, `TIERS` (Task 6); `PalmFilter`, `touchKinds`, `classifyTouch`,
  `classifyPointer` (Task 7); `RawStrokeQueue`, `startAttempt`, `recordStroke`, `isOverMistakeLimit`,
  `finishAttempt`, `AttemptRecord`, `AttemptContext` (Task 8); `loadStrokeJson` (Task 4); `newId` (Task 9).
- Produces:
  - `<WritingPad char tier profileId context word expectedChar leniencyInput size onFinish onInputSeen loader? />`, where:
    - `onFinish(record: AttemptRecord): void` is called exactly once per attempt;
    - `onInputSeen(kind: InputKind): void` is called on every stroke start;
    - `loader` defaults to `loadStrokeJson`;
  - `<StrokeDiagram data={StrokeJson} size={number} />`, which draws the strokes with their numbers (used in Task 11).

- [ ] **Step 1: Write the failing tests** (Hanzi Writer is mocked; real drawing is tested on the iPad in Task 13)

`src/writing/WritingPad.test.tsx`:
```tsx
import { act, render, screen } from '@testing-library/react';
import type { AttemptRecord } from './attempt';
import { WritingPad } from './WritingPad';

type Opts = Record<string, any>;
const h = vi.hoisted(() => ({ create: vi.fn(), quizOpts: null as Opts | null, cancelQuiz: vi.fn(), createOpts: null as Opts | null }));
vi.mock('hanzi-writer', () => ({
  default: {
    create: (el: HTMLElement, char: string, opts: Opts) => {
      h.create(el, char, opts);
      h.createOpts = opts;
      return { quiz: (q: Opts) => { h.quizOpts = q; return Promise.resolve(); }, cancelQuiz: h.cancelQuiz };
    },
  },
}));

const loader = vi.fn(async () => ({ strokes: ['M 0 0 Z'], medians: [[[0, 0], [1, 1]]] }));
const base = { char: '木', profileId: 'p1', context: 'calibration' as const, word: null, expectedChar: null, leniencyInput: 'finger' as const, size: 300, loader, onInputSeen: () => {} };
const stroke = (o: Opts) => ({ character: '木', strokeNum: 0, mistakesOnStroke: 0, totalMistakes: 0, strokesRemaining: 3, isBackwards: false, drawnPath: { pathString: '', points: [{ x: 1, y: 1 }] }, ...o });

beforeEach(() => { h.quizOpts = null; h.cancelQuiz.mockClear(); loader.mockClear(); });

test('starts the quiz with the tier settings and never auto-accepts', async () => {
  render(<WritingPad {...base} tier="master" onFinish={() => {}} />);
  await act(async () => {});
  expect(h.createOpts?.showOutline).toBe(false);
  expect(h.createOpts?.showCharacter).toBe(false);
  expect(h.quizOpts).toMatchObject({ showHintAfterMisses: 3, acceptBackwardsStrokes: false, markStrokeCorrectAfterMisses: false });
});

test('reaching the tier mistake limit cancels the quiz and reports failed', async () => {
  const done: AttemptRecord[] = [];
  render(<WritingPad {...base} tier="master" onFinish={r => done.push(r)} />);
  await act(async () => {});
  act(() => { h.quizOpts!.onMistake(stroke({ mistakesOnStroke: 1, totalMistakes: 1 })); });
  expect(done).toHaveLength(0);
  act(() => { h.quizOpts!.onMistake(stroke({ mistakesOnStroke: 2, totalMistakes: 2 })); });
  expect(h.cancelQuiz).toHaveBeenCalledTimes(1);
  expect(done.map(d => d.result)).toEqual(['failed']);
});

test('completing the quiz reports passed exactly once', async () => {
  const done: AttemptRecord[] = [];
  render(<WritingPad {...base} tier="practice" onFinish={r => done.push(r)} />);
  await act(async () => {});
  act(() => { h.quizOpts!.onCorrectStroke(stroke({ strokesRemaining: 0 })); h.quizOpts!.onComplete({ character: '木', totalMistakes: 0 }); });
  expect(done.map(d => [d.result, d.strokes.length])).toEqual([['passed', 1]]);
});

test('leaving mid-character saves the attempt as abandoned (Review Focus 4)', async () => {
  const done: AttemptRecord[] = [];
  const { unmount } = render(<WritingPad {...base} tier="practice" onFinish={r => done.push(r)} />);
  await act(async () => {});
  act(() => { h.quizOpts!.onCorrectStroke(stroke({})); });
  unmount();
  expect(done.map(d => d.result)).toEqual(['abandoned']);
});

test('leaving before any stroke saves nothing', async () => {
  const done: AttemptRecord[] = [];
  const { unmount } = render(<WritingPad {...base} tier="practice" onFinish={r => done.push(r)} />);
  await act(async () => {});
  unmount();
  expect(done).toEqual([]);
});

test('a palm touchend during Pencil use never reaches Hanzi Writer (Review Focus 1)', async () => {
  render(<WritingPad {...base} tier="practice" onFinish={() => {}} />);
  await act(async () => {});
  const pad = screen.getByTestId('writing-pad');
  const reached = vi.fn();
  document.addEventListener('touchend', reached); // Hanzi Writer listens on document
  const touch = (type: string, touchType: string) => {
    const e = new Event(type, { bubbles: true, cancelable: true }) as any;
    const list = [{ clientX: 10, clientY: 10, touchType }];
    e.touches = type === 'touchend' ? [] : list; e.changedTouches = list;
    return e;
  };
  pad.dispatchEvent(touch('touchstart', 'stylus'));
  pad.dispatchEvent(touch('touchend', 'direct'));
  expect(reached).not.toHaveBeenCalled();
  pad.dispatchEvent(touch('touchend', 'stylus'));
  expect(reached).toHaveBeenCalledTimes(1);
  document.removeEventListener('touchend', reached);
});

test('missing stroke data shows a message instead of a blank pad', async () => {
  render(<WritingPad {...base} tier="practice" loader={async () => { throw new Error('404'); }} onFinish={() => {}} />);
  await act(async () => {});
  expect(screen.getByRole('alert').textContent).toContain('找不到「木」的筆順資料');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/writing/WritingPad.test.tsx`
Expected: FAIL. `./WritingPad` is not found.

- [ ] **Step 3: Implement `WritingPad`**

`src/writing/WritingPad.tsx`:
```tsx
import HanziWriter from 'hanzi-writer';
import { useEffect, useRef, useState } from 'react';
import { loadStrokeJson } from '../content/strokeFiles';
import type { StrokeJson } from '../content/types';
import { newId } from '../storage/profiles';
import { finishAttempt, isOverMistakeLimit, recordStroke, startAttempt, type AttemptContext, type AttemptRecord, type AttemptState } from './attempt';
import { PalmFilter, classifyPointer, classifyTouch, touchKinds } from './input';
import { RawStrokeQueue } from './rawStrokes';
import { quizOptionsFor, showOutlineFor, type InputKind, type TierId } from './tiers';

type Props = {
  char: string;
  tier: TierId;
  profileId: string;
  context: AttemptContext;
  word: string | null;
  expectedChar: string | null;
  leniencyInput: InputKind;
  size: number;
  onFinish: (r: AttemptRecord) => void;
  onInputSeen: (k: InputKind) => void;
  loader?: (char: string) => Promise<StrokeJson>;
};

type HwStroke = { strokeNum: number; mistakesOnStroke: number; totalMistakes: number; isBackwards: boolean; drawnPath: { points: { x: number; y: number }[] } };

export function WritingPad(p: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(p);
  latest.current = p;

  useEffect(() => {
    const el = host.current!;
    const t0 = performance.now();
    const queue = new RawStrokeQueue();
    const palm = new PalmFilter();
    let state: AttemptState | null = startAttempt({
      id: newId(), profileId: p.profileId, char: p.char, expectedChar: p.expectedChar, word: p.word, context: p.context,
      tier: p.tier, leniencyInput: p.leniencyInput, outlineVisible: showOutlineFor(p.tier), now: Date.now(),
    });
    let finished = false;
    const finish = (result: AttemptRecord['result']) => {
      if (finished || !state) return;
      finished = true;
      latest.current.onFinish(finishAttempt(state, result, Date.now()));
    };
    const local = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      return { x: x - r.left, y: y - r.top, t: Math.round(performance.now() - t0) };
    };

    // Capture-phase listeners on the host run before Hanzi Writer's listeners on its inner node (start, move), and the
    // window capture listener runs before its document listener (end). Blocking here keeps palms out of its strokes.
    const onTouchStart = (e: TouchEvent) => {
      lastTouch = performance.now();
      const kinds = touchKinds(e.touches);
      if (kinds[0] === 'stylus') palm.notePen(performance.now());
      if (palm.shouldBlock({ primary: kinds[0], now: performance.now() })) { e.stopPropagation(); e.preventDefault(); return; }
      const kind = classifyTouch(kinds) ?? 'finger';
      latest.current.onInputSeen(kind);
      const t = e.touches[0]!;
      queue.begin(kind, local(t.clientX, t.clientY));
    };
    const onTouchMove = (e: TouchEvent) => {
      const kinds = touchKinds(e.touches);
      if (kinds[0] === 'stylus') palm.notePen(performance.now());
      if (palm.shouldBlock({ primary: kinds[0], now: performance.now() })) { e.stopPropagation(); e.preventDefault(); return; }
      const t = e.touches[0];
      if (t) queue.move(local(t.clientX, t.clientY));
    };
    const onTouchEnd = (e: TouchEvent) => {
      lastTouch = performance.now();
      const kinds = touchKinds(e.changedTouches);
      if (palm.shouldBlock({ primary: kinds[0], now: performance.now() })) { e.stopPropagation(); return; }
      if (kinds[0] === 'stylus') palm.notePen(performance.now());
      queue.end();
    };
    // Safari fires compatibility mouse events after a touch; recording them would add a phantom stroke to the queue.
    let lastTouch = -Infinity;
    let mouseDown = false;
    const onMouseDown = (e: MouseEvent) => {
      if (performance.now() - lastTouch < 800) return;
      mouseDown = true;
      latest.current.onInputSeen('mouse');
      queue.begin('mouse', local(e.clientX, e.clientY));
    };
    const onMouseMove = (e: MouseEvent) => { if (mouseDown) queue.move(local(e.clientX, e.clientY)); };
    const onMouseUp = () => { if (mouseDown) { mouseDown = false; queue.end(); } };
    const onPointerDown = (e: PointerEvent) => { if (classifyPointer(e.pointerType) === 'pen') palm.notePen(performance.now()); };

    el.addEventListener('pointerdown', onPointerDown, true);
    el.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
    el.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    window.addEventListener('touchend', onTouchEnd, true);
    el.addEventListener('mousedown', onMouseDown, true);
    el.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('mouseup', onMouseUp, true);

    const onStroke = (isCorrect: boolean) => (s: HwStroke) => {
      if (!state || finished) return;
      state = recordStroke(state, {
        strokeNum: s.strokeNum, isCorrect, isBackwards: s.isBackwards, mistakesOnStroke: s.mistakesOnStroke,
        totalMistakes: s.totalMistakes, drawn: s.drawnPath.points.map(({ x, y }) => ({ x, y })),
      }, queue.take());
      if (!isCorrect && isOverMistakeLimit(state)) { writer.cancelQuiz(); finish('failed'); }
    };

    const loader = p.loader ?? loadStrokeJson;
    const hwEl = el.querySelector<HTMLDivElement>('[data-hw]')!;
    const writer = HanziWriter.create(hwEl, p.char, {
      width: p.size, height: p.size, padding: Math.round(p.size * 0.06),
      showOutline: showOutlineFor(p.tier), showCharacter: false, renderer: 'svg',
      outlineColor: '#DDD', drawingColor: '#222', drawingWidth: Math.max(8, Math.round(p.size / 30)),
      charDataLoader: (c: string, onLoad: (d: StrokeJson) => void, onError: (e?: unknown) => void) => {
        loader(c).then(onLoad, err => { setError(`找不到「${c}」的筆順資料`); onError(err); });
      },
    });
    void writer.quiz({
      ...quizOptionsFor(p.tier, p.leniencyInput),
      onCorrectStroke: onStroke(true),
      onMistake: onStroke(false),
      onComplete: () => finish('passed'),
    });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown, true);
      el.removeEventListener('touchstart', onTouchStart, true);
      el.removeEventListener('touchmove', onTouchMove, true);
      window.removeEventListener('touchend', onTouchEnd, true);
      el.removeEventListener('mousedown', onMouseDown, true);
      el.removeEventListener('mousemove', onMouseMove, true);
      window.removeEventListener('mouseup', onMouseUp, true);
      if (!finished && state && state.strokes.length > 0) finish('abandoned');
      state = null;
      try { writer.cancelQuiz(); } catch { /* writer may not have finished loading */ }
      hwEl.replaceChildren(); // StrictMode remounts in development; never leave two drawings stacked
    };
    // One effect run per attempt: the parent remounts the pad (key) for a new character or tier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-testid="writing-pad" ref={host} style={{ position: 'relative', width: p.size, height: p.size, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}>
      <TianZiGe size={p.size} />
      <div data-hw style={{ position: 'absolute', inset: 0 }} />
      {error && <p role="alert" style={{ position: 'absolute', inset: 0, margin: 0, display: 'grid', placeItems: 'center', color: '#a00' }}>{error}</p>}
    </div>
  );
}

function TianZiGe({ size }: { size: number }) {
  const s = size;
  return (
    <svg width={s} height={s} style={{ position: 'absolute', inset: 0 }} aria-hidden>
      <rect x="1" y="1" width={s - 2} height={s - 2} fill="#FFFDF8" stroke="#C8322B" strokeWidth="2" />
      <line x1={s / 2} y1="0" x2={s / 2} y2={s} stroke="#E9B8B5" strokeDasharray="8 6" />
      <line x1="0" y1={s / 2} x2={s} y2={s / 2} stroke="#E9B8B5" strokeDasharray="8 6" />
    </svg>
  );
}
```

React StrictMode runs effects twice in development, as mount → cleanup → mount. The first cleanup sees no strokes and
saves nothing (the "before any stroke" test). The second mount is the real attempt.

- [ ] **Step 4: Implement `StrokeDiagram`**

`src/writing/StrokeDiagram.tsx`:
```tsx
import type { StrokeJson } from '../content/types';

/** Static drawing with each stroke numbered at its start, in Make Me a Hanzi coordinates (y up, baseline -124). */
export function StrokeDiagram({ data, size }: { data: StrokeJson; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" role="img" aria-label="筆順圖">
      <g transform="translate(0, 900) scale(1, -1)">
        {data.strokes.map((d, i) => <path key={i} d={d} fill={`hsl(${(i * 47) % 360} 60% 45%)`} opacity={0.85} />)}
      </g>
      {data.medians.map((m, i) => {
        const [x, y] = m[0]!;
        return <text key={i} x={x} y={900 - y!} fontSize="64" fontWeight="700" fill="#000" stroke="#fff" strokeWidth="10" paintOrder="stroke">{i + 1}</text>;
      })}
    </svg>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/writing && npx tsc --noEmit`
Expected: all writing tests pass, and there are no type errors.

- [ ] **Step 6: Prove the test.**
  1. In `onTouchEnd`, delete `e.stopPropagation();`. Expected: the palm test FAILS (`reached` is called twice). Revert.
  2. Delete `if (!finished && state && state.strokes.length > 0) finish('abandoned');`. Expected: the abandoned test
     FAILS. Revert.

- [ ] **Step 7: Commit**

```bash
git add src/writing/WritingPad.tsx src/writing/WritingPad.test.tsx src/writing/StrokeDiagram.tsx
git commit -m "Add WritingPad: Hanzi Writer quiz with tiers, palm rejection and attempt logging"
```

---

### Task 11: Lab screens: input probe, stroke review, calibration

**Files:**
- Create: `src/lab/InputProbe.tsx`, `src/lab/StrokeReview.tsx`, `src/lab/calibrationSummary.ts`,
  `src/lab/calibrationSummary.test.ts`, `src/lab/Calibration.tsx`, `src/lab/download.ts`
- Modify: `src/App.tsx` (replace), `src/App.test.tsx` (replace)

**Interfaces:**
- Consumes: `WritingPad`, `StrokeDiagram`, `TIERS`, `TIER_ORDER`, `openStoreOrMemory`, `requestPersistence`,
  `NICKNAMES`, `AVATARS`, `newId`, `Profile`, `loadStrokeJson`, `CalibrationSet`, `AttemptRecord`.
- Produces:
  - `summarizeCalibration(attempts: AttemptRecord[]): CalibrationSummary`;
  - `downloadJson(name: string, data: unknown): string` (returns the JSON text it offered for download);
  - the routes `#/probe`, `#/review`, `#/calibrate`.

- [ ] **Step 1: Write the failing summary tests**

`src/lab/calibrationSummary.test.ts`:
```ts
import { summarizeCalibration } from './calibrationSummary';
import type { AttemptRecord } from '../writing/attempt';

const a = (o: Partial<AttemptRecord>): AttemptRecord => ({
  id: 'x', profileId: 'p', char: '木', expectedChar: null, word: null, context: 'calibration', tier: 'practice', leniencyInput: 'finger',
  inputs: ['finger'], outlineVisible: false, hintShown: false, strokes: [], totalMistakes: 0, result: 'passed', checker: 'c', startedAt: 0, endedAt: 1, ...o,
});
const s = (accepted: boolean) => ({ strokeNum: 0, accepted, backwards: false, mistakesOnStroke: accepted ? 0 : 1, drawn: [], raw: null, hintShownAfter: false });

test('rejection rate is rejected strokes over all evaluated strokes, per tier and input', () => {
  const sum = summarizeCalibration([
    a({ tier: 'practice', strokes: [s(true), s(false), s(true), s(true)] }),
    a({ tier: 'practice', strokes: [s(true), s(true)], inputs: ['pen'] }),
    a({ tier: 'master', result: 'failed', strokes: [s(false), s(false)] }),
  ]);
  expect(sum.byTier.practice).toMatchObject({ attempts: 2, passed: 2, passedFirstTry: 1, strokesEvaluated: 6, strokesRejected: 1 });
  expect(sum.byTier.practice.rejectionRate).toBeCloseTo(1 / 6);
  expect(sum.byTier.master).toMatchObject({ attempts: 1, passed: 0, strokesRejected: 2 });
  expect(sum.byInput.pen?.strokesEvaluated).toBe(2);
});

test('a tier with no attempts reports zero, not NaN', () => {
  expect(summarizeCalibration([]).byTier.apprentice.rejectionRate).toBe(0);
});

test('look-alike attempts count false accepts and are kept out of the rejection figures', () => {
  const sum = summarizeCalibration([
    a({ context: 'lookalike', char: '土', expectedChar: '士', result: 'passed' }),
    a({ context: 'lookalike', char: '人', expectedChar: '入', result: 'failed' }),
  ]);
  expect(sum.lookalikes).toEqual([
    { asked: '土', written: '士', tier: 'practice', falseAccept: true },
    { asked: '人', written: '入', tier: 'practice', falseAccept: false },
  ]);
  expect(sum.byTier.practice.attempts).toBe(0);
});

test('abandoned attempts are listed but not counted as passes or failures', () => {
  const sum = summarizeCalibration([a({ result: 'abandoned', strokes: [s(true)] })]);
  expect(sum.abandoned).toBe(1);
  expect(sum.byTier.practice.attempts).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lab/calibrationSummary.test.ts`
Expected: FAIL. The module is not found.

- [ ] **Step 3: Implement the summary**

`src/lab/calibrationSummary.ts`:
```ts
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
```

Note: `passedFirstTry` checks both `totalMistakes === 0` and every stroke accepted. That makes the first test's practice
figures 1 of 2: the first attempt has a rejected stroke but a `totalMistakes` of 0 in the fixture, and it does not
count.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lab/calibrationSummary.test.ts`
Expected: 4 pass.

- [ ] **Step 5: Prove the test.** Remove `if (a.context === 'lookalike') {…}`. Expected: the look-alike test FAILS.
  Revert.

- [ ] **Step 6: Write the download helper.** It always returns the text, so a page can show it if the download does
  not start. There is no clipboard: a failed copy cannot be detected reliably.

`src/lab/download.ts`:
```ts
export function downloadJson(name: string, data: unknown): string {
  const text = JSON.stringify(data, null, 1);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return text;
}
```

- [ ] **Step 7: Write the input probe**

`src/lab/InputProbe.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { touchKinds } from '../writing/input';

/** Spec §5: prove on the iPad that the Pencil reports as stylus/pen before anything relies on it. */
export function InputProbe() {
  const area = useRef<HTMLDivElement>(null);
  const [log, setLog] = useState<string[]>([]);
  const [seen, setSeen] = useState<Record<string, number>>({});
  useEffect(() => {
    const el = area.current!;
    const note = (line: string, key: string) => {
      setLog(l => [line, ...l].slice(0, 25));
      setSeen(s => ({ ...s, [key]: (s[key] ?? 0) + 1 }));
    };
    const onPointer = (e: PointerEvent) => note(`${e.type} pointerType=${e.pointerType} pressure=${e.pressure.toFixed(2)}`, `pointer:${e.pointerType}`);
    const onTouch = (e: TouchEvent) => { e.preventDefault(); note(`${e.type} touches=${e.touches.length} touchType=${touchKinds(e.changedTouches).join(',')}`, `touch:${touchKinds(e.changedTouches)[0]}`); };
    el.addEventListener('pointerdown', onPointer);
    el.addEventListener('touchstart', onTouch, { passive: false });
    el.addEventListener('touchend', onTouch, { passive: false });
    return () => { el.removeEventListener('pointerdown', onPointer); el.removeEventListener('touchstart', onTouch); el.removeEventListener('touchend', onTouch); };
  }, []);
  return (
    <section>
      <h2>Input probe</h2>
      <p>Draw here with a finger, then with the Apple Pencil, then rest a palm while drawing with the Pencil.</p>
      <div ref={area} style={{ height: 300, border: '2px dashed #888', touchAction: 'none' }} />
      <p><strong>Seen:</strong> {Object.entries(seen).map(([k, n]) => `${k} ×${n}`).join('   ') || 'nothing yet'}</p>
      <pre style={{ fontSize: 12 }}>{log.join('\n')}</pre>
    </section>
  );
}
```

- [ ] **Step 8: Write the stroke review screen**

`src/lab/StrokeReview.tsx`:
```tsx
import HanziWriter from 'hanzi-writer';
import { useEffect, useMemo, useRef, useState } from 'react';
import calibration from '../../content/calibration.json';
import g2 from '../../content/curricula/kangxuan-g2-1.json';
import g4 from '../../content/curricula/kangxuan-g4-1.json';
import extras from '../../content/extra-characters.json';
import report from '../../content/strokes/report.json';
import verifiedFile from '../../content/strokes/verified.json';
import { calibrationChars, type CalibrationSet, type StrokeReport, type Verified } from '../content/check';
import { loadStrokeJson } from '../content/strokeFiles';
import type { Curriculum, StrokeJson } from '../content/types';
import { StrokeDiagram } from '../writing/StrokeDiagram';
import { downloadJson } from './download';

const KEY = 'ssc-stroke-review-v1';
const load = (): Verified => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } };
const save = (v: Verified) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage blocked: export still works */ } };

type Group = { id: string; label: string; chars: string[] };

export function StrokeReview() {
  const groups: Group[] = useMemo(() => [
    { id: 'calibration', label: 'Calibration + look-alikes (must be verified first)', chars: calibrationChars(calibration as unknown as CalibrationSet) },
    ...([g2, g4] as unknown as Curriculum[]).flatMap(c => c.lessons.map(l => ({ id: `${c.id}-${l.lesson}`, label: `${c.book} 第${l.lesson}課 ${l.title}`, chars: l.write.map(w => w.char) }))),
    { id: 'extras', label: 'Extra characters', chars: (extras as { char: string }[]).map(e => e.char) },
  ], []);
  const [groupId, setGroupId] = useState('calibration');
  const [verified, setVerified] = useState<Verified>(() => ({ ...(verifiedFile as unknown as Verified), ...load() }));
  const [exported, setExported] = useState<string | null>(null);
  const sources = useMemo(() => new Map((report as unknown as StrokeReport).chars.map(c => [c.char, c])), []);
  const group = groups.find(g => g.id === groupId)!;
  const toggle = (char: string, on: boolean) => {
    const next = { ...verified };
    if (on) next[char] = { by: 'founder', date: new Date().toISOString().slice(0, 10) }; else delete next[char];
    setVerified(next); save(next);
  };
  return (
    <section>
      <h2>Stroke-order review</h2>
      <p>Compare each animation with the numbered stroke order on the textbook's 我會寫字 page, or with
        <a href="https://stroke-order.learningweb.moe.edu.tw" target="_blank" rel="noreferrer"> MOE 筆順學習網</a>.
        Tick only when every stroke's order, direction and shape match.</p>
      <select value={groupId} onChange={e => setGroupId(e.target.value)}>
        {groups.map(g => <option key={g.id} value={g.id}>{g.label} ({g.chars.filter(c => verified[c]).length}/{g.chars.length})</option>)}
      </select>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
        {group.chars.map(c => <ReviewCard key={c} char={c} source={sources.get(c)?.source ?? null} expected={sources.get(c)?.expected ?? 0} checked={!!verified[c]} onToggle={on => toggle(c, on)} />)}
      </div>
      <p><button onClick={() => setExported(downloadJson('verified.json', verified))}>Export verified.json ({Object.keys(verified).length})</button></p>
      {exported && <><p>If no file downloaded, copy this text into <code>content/strokes/verified.json</code>:</p><textarea readOnly value={exported} rows={8} style={{ width: '100%' }} /></>}
    </section>
  );
}

function ReviewCard({ char, source, expected, checked, onToggle }: { char: string; source: string | null; expected: number; checked: boolean; onToggle: (on: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const writer = useRef<ReturnType<typeof HanziWriter.create> | null>(null);
  const [data, setData] = useState<StrokeJson | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    loadStrokeJson(char).then(d => {
      setData(d);
      writer.current = HanziWriter.create(box.current!, char, { width: 160, height: 160, padding: 8, showOutline: true, showCharacter: false, charDataLoader: (_c: string, ok: (x: StrokeJson) => void) => ok(d) });
    }, () => setMissing(true));
  }, [char]);
  return (
    <figure style={{ border: '1px solid #ccc', padding: 8, margin: 0, width: 340 }}>
      <figcaption style={{ fontSize: 28 }}>{char} <small style={{ fontSize: 12 }}>{expected} strokes · {source ?? 'NO DATA'}</small></figcaption>
      {missing ? <p role="alert">No stroke data</p> : (
        <div style={{ display: 'flex', gap: 8 }}>
          <div ref={box} onClick={() => writer.current?.animateCharacter()} style={{ cursor: 'pointer' }} title="Tap to play" />
          {data && <StrokeDiagram data={data} size={160} />}
        </div>
      )}
      <label><input type="checkbox" checked={checked} disabled={missing} onChange={e => onToggle(e.target.checked)} /> matches MOE 筆順</label>
    </figure>
  );
}
```

- [ ] **Step 9: Write the calibration screen**

`src/lab/Calibration.tsx`:
```tsx
import { useEffect, useState } from 'react';
import calibration from '../../content/calibration.json';
import type { CalibrationSet } from '../content/check';
import { openStoreOrMemory, requestPersistence, type Store } from '../storage/db';
import { AVATARS, NICKNAMES, newId, type Profile } from '../storage/profiles';
import type { AttemptRecord } from '../writing/attempt';
import { TIERS, TIER_ORDER, type InputKind, type TierId } from '../writing/tiers';
import { WritingPad } from '../writing/WritingPad';
import { summarizeCalibration } from './calibrationSummary';
import { downloadJson } from './download';

const SET = calibration as unknown as CalibrationSet;
type Step = { tier: TierId; char: string; expectedChar: string | null; context: 'calibration' | 'lookalike' };

/** Children write tiers in order, easiest first; then an adult runs the look-alike pairs at 見習 and 修行. */
const childSteps = (): Step[] => TIER_ORDER.flatMap(tier => SET.tiers[tier].map(char => ({ tier, char, expectedChar: null, context: 'calibration' as const })));
const adultSteps = (): Step[] => (['apprentice', 'practice'] as TierId[]).flatMap(tier => SET.lookalikes.map(([asked, written]) => ({ tier, char: asked, expectedChar: written, context: 'lookalike' as const })));

export function Calibration() {
  const [store, setStore] = useState<Store | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<'child' | 'adult' | null>(null);
  const [i, setI] = useState(0);
  const [lastInput, setLastInput] = useState<InputKind>('finger');
  const [results, setResults] = useState<AttemptRecord[]>([]);
  const [exported, setExported] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { store, reason } = await openStoreOrMemory();
      const persist = await requestPersistence();
      setStore(store);
      setWarning(reason ?? (persist === 'denied' ? 'The browser may clear this data later (storage persistence was refused).' : null));
      setProfiles(await store.listProfiles());
    })();
  }, []);

  if (!store) return <p>Loading…</p>;
  const steps = mode === 'adult' ? adultSteps() : childSteps();

  if (!profile) {
    return (
      <section>
        <h2>Calibration: who is writing?</h2>
        {warning && <p role="alert">{warning}</p>}
        {profiles.map(p => <button key={p.id} onClick={() => setProfile(p)} style={{ fontSize: 24, margin: 4 }}>{p.avatar} {p.nickname}</button>)}
        <p>New profile:</p>
        {NICKNAMES.map((n, k) => (
          <button key={n} style={{ margin: 4 }} onClick={async () => {
            const p: Profile = { id: newId(), nickname: n, avatar: AVATARS[k]!, curriculumId: 'kangxuan-g2-1', lesson: 1, tier: 'practice', lastInput: 'finger', createdAt: Date.now() };
            await store.putProfile(p); setProfiles([...profiles, p]); setProfile(p);
          }}>{AVATARS[k]} {n}</button>
        ))}
      </section>
    );
  }

  if (!mode) {
    return (
      <section>
        <h2>{profile.avatar} {profile.nickname}</h2>
        <button onClick={() => setMode('child')}>Child run: {childSteps().length} characters, copy each one</button>{' '}
        <button onClick={() => setMode('adult')}>Adult look-alike run: {adultSteps().length} characters</button>
      </section>
    );
  }

  if (i >= steps.length) {
    const sum = summarizeCalibration(results);
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    return (
      <section>
        <h2>Done</h2>
        <table><thead><tr><th>Tier</th><th>Attempts</th><th>Passed</th><th>First try</th><th>Correct strokes rejected</th></tr></thead>
          <tbody>{TIER_ORDER.map(t => { const f = sum.byTier[t]; return <tr key={t}><td>{TIERS[t].labelZh}</td><td>{f.attempts}</td><td>{f.passed}</td><td>{f.passedFirstTry}</td><td>{f.strokesRejected} of {f.strokesEvaluated} ({pct(f.rejectionRate)})</td></tr>; })}</tbody></table>
        {sum.lookalikes.length > 0 && <p>Look-alikes wrongly accepted: {sum.lookalikes.filter(l => l.falseAccept).map(l => `${l.written} for ${l.asked} (${TIERS[l.tier].labelZh})`).join(', ') || 'none'}</p>}
        <button onClick={() => setExported(downloadJson(`calibration-${profile.nickname}-${mode}.json`, { profile: { nickname: profile.nickname }, summary: sum, attempts: results }))}>Export results</button>
        {exported && <textarea readOnly value={exported} rows={6} style={{ width: '100%' }} />}
      </section>
    );
  }

  const step = steps[i]!;
  return (
    <section>
      {warning && <p role="alert">{warning}</p>}
      <p>{i + 1} / {steps.length} · {TIERS[step.tier].labelZh} · input: {lastInput}</p>
      {step.context === 'calibration'
        ? <p style={{ fontSize: 20 }}>看著寫：<span style={{ fontSize: 64 }}>{step.char}</span></p>
        : <p style={{ fontSize: 20 }}>Adult: the pad expects <b style={{ fontSize: 40 }}>{step.char}</b>. Carefully write <b style={{ fontSize: 40 }}>{step.expectedChar}</b> instead.</p>}
      <WritingPad
        key={`${i}-${step.char}`}
        char={step.char} tier={step.tier} profileId={profile.id} context={step.context} word={null} expectedChar={step.expectedChar}
        leniencyInput={lastInput} size={Math.min(420, window.innerWidth - 32)}
        onInputSeen={setLastInput}
        onFinish={async r => {
          await store.addAttempt(r);
          if (r.result !== 'abandoned') { setResults(x => [...x, r]); setTimeout(() => setI(n => n + 1), 600); }
        }}
      />
      <p><button onClick={() => setI(n => n + 1)}>Skip</button></p>
    </section>
  );
}
```

- [ ] **Step 10: Replace `App` with a hash router, and update its test**

`src/App.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { Calibration } from './lab/Calibration';
import { InputProbe } from './lab/InputProbe';
import { StrokeReview } from './lab/StrokeReview';

const ROUTES = { '#/probe': InputProbe, '#/review': StrokeReview, '#/calibrate': Calibration } as const;

export default function App() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const Page = ROUTES[hash as keyof typeof ROUTES];
  return (
    <main style={{ fontFamily: 'system-ui, "PingFang TC", sans-serif', padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <h1>SpellScript Chinese</h1>
      <nav style={{ display: 'flex', gap: 16 }}>
        <a href="#/probe">Input probe</a><a href="#/review">Stroke review</a><a href="#/calibrate">Calibration</a>
      </nav>
      {Page ? <Page /> : <p>Writing lab. Pick a screen above.</p>}
    </main>
  );
}
```

`src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the app name and the three lab screens', () => {
  window.location.hash = '';
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('SpellScript Chinese');
  expect(screen.getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(['#/probe', '#/review', '#/calibrate']);
});
```

- [ ] **Step 11: Run all tests, type-check and build**

Run: `npm test && npm run build`
Expected: every test passes; the build writes `dist/` with no type errors.

- [ ] **Step 12: Exercise it in a desktop browser** (CLAUDE.md: do not hand over a screen that has not been used)

Run: `npm run dev`. Open `http://localhost:5173/#/review` and `#/calibrate`, and check:
- `#/review`, "Calibration" group: each card shows an animation (tap plays it), a numbered diagram and a stroke count.
- Ticking a box and clicking Export downloads `verified.json`, and the text box shows the same JSON.
- `#/calibrate`: creating a profile and writing the first character with the mouse moves on to the next. Writing
  nonsense several times at 大師 fails it.
- Reload the page: the profile is still listed (IndexedDB).

Record anything that does not behave this way, and fix it before committing.

- [ ] **Step 13: Commit**

```bash
git add src/lab src/App.tsx src/App.test.tsx
git commit -m "Add lab screens: input probe, stroke-order review, calibration"
```

---

### Task 12: Compose the remaining Taiwan forms

**Files:**
- Modify: `content/strokes/compose-recipes.json`
- Generated: `content/strokes/overrides/*.json`, `public/strokes/*.json`, `content/strokes/report.json`

**Interfaces:**
- Consumes: `npm run compose-strokes`, `npm run build-strokes`, `npm run check-content`, and the `#/review` screen's
  numbered diagram (Task 11).
- Produces: stroke data, at the MOE count, for all 21 characters that Task 4 found missing.

There is one recipe per character. Before writing each recipe, find the stroke indices to remove: open a scratch page
that renders `<StrokeDiagram>` for the base character from `hanzi-writer-data`, or read its `medians` start points.
The donor characters below are already correct at the MOE count in AnimCJK or hanzi-writer-data (Task 4's report
confirms this). Check that before relying on one.

| Character (MOE count) | Difference from mainland data | Suggested donor for the Taiwan part |
|---|---|---|
| 蓓 14, 蕾 17, 薄 17, 芝 8 | 艹 on top | 花 strokes 0–3 (AnimCJK) |
| 慌 13, 敬 13, 塔 13 | 艹 inside the character | 花 strokes 0–3, inserted where the mainland 艹 starts |
| 遨 15, 邀 17, 遙 14, 逛 11, 邁 17 | 辶 is 4 strokes | 近 strokes 4–7 (AnimCJK, 近 = 斤 + 辶) |
| 謎 17 | 辶 inside 迷 | 近 strokes 4–7 |
| 陀 8, 阻 8 | left 阝 is 3 strokes | 防 strokes 0–2 |
| 郁 9 | right 阝 is 3 strokes | 部 strokes 8–10 |
| 滑 13 | 骨 has a different Taiwan form | 骨 (AnimCJK `zhHant`) all strokes, mapped onto 滑's mainland 骨 strokes |
| 搓 13 | 差 has a different Taiwan form | 差 all strokes (whichever source has the MOE count) |
| 與 14 | the inner form differs | inspect first; candidates 興, 舉 |
| 鎚 18 | missing everywhere | base 鎖 (keep 金, strokes 0–7), replace strokes 8–17 with 追 (MOE 9) all strokes |
| 遨 | also check 敖 against MOE | if the count is still off after the 辶 fix, compose 敖 too |

- [ ] **Step 1: Write the recipes for the 艹 group** (蓓 蕾 薄 芝 慌 敬 塔), following 茄's pattern. Run
  `npm run compose-strokes && npm run build-strokes`. Expected: each prints the MOE count, and build-strokes reports
  them as `override`.
- [ ] **Step 2: Write the recipes for the 辶 group** (遨 邀 遙 逛 邁 謎). Run the same commands. Expected: the MOE
  counts.
- [ ] **Step 3: Write the recipes for the 阝 group** (陀 阻 郁). Run the same commands.
- [ ] **Step 4: Write the recipes for 滑, 搓, 與 and 鎚.** For 與, write down in the recipe `note` exactly what
  differs, once found.
- [ ] **Step 5: Check visually.** Open `#/review` and pick each affected lesson. Every composed character must look
  like one character: no overlapping parts, nothing outside the box, and the parts proportioned like the textbook
  card. Adjust a recipe with an explicit `targetBox` where the scaled part looks wrong.
- [ ] **Step 6: Run the check**

Run: `npm run check-content`
Expected: `content check passed` (no missing characters). The verified count is still low; that is Task 13's job.

- [ ] **Step 7: Commit**

```bash
git add content/strokes public/strokes
git commit -m "Compose Taiwan stroke data for the 20 remaining characters"
```

---

### Task 13: On the iPad: prove input, verify stroke order, run calibration

This task is mostly done with the founder and the children. Claude prepares each session and records the results.
Nothing here is reported as done until the founder has seen it on the iPad.

**Files:**
- Modify: `content/strokes/verified.json`
- Create: `docs/calibration/2026-10-XX-input-probe.md`, `docs/calibration/2026-10-XX-calibration.md` (use the real
  date) and the exported result JSON files next to them. Nicknames only, never real names.
- Possibly modify: `src/writing/tiers.ts` (leniency values and finger allowance only), with the founder's agreement.

- [ ] **Step 1: Serve the lab to the iPad on the home network**

Run: `npm run dev:ipad`. Vite prints a `Network:` address such as `http://192.168.1.20:5173/`. On the iPad (same
Wi-Fi), open that address plus `#/probe`. If it does not load, check that the Mac firewall allows incoming
connections for Node.

- [ ] **Step 2: Prove Pencil detection (spec §5)**

With the founder, on `#/probe`:
1. draw with a finger;
2. draw with the Apple Pencil;
3. draw with the Pencil while resting a palm on the screen.

Expected "Seen" line: `pointer:touch` and `touch:direct` for the finger, `pointer:pen` and `touch:stylus` for the
Pencil. Record the exact output and the iPad and iPadOS version in `docs/calibration/…-input-probe.md`.

**If the Pencil does not show as `pen`/`stylus`, stop.** Tell the founder that the spec's fallback (a finger/pen
toggle on the trial screen) is needed, and add it before continuing.

- [ ] **Step 3: Verify stroke order for the calibration set**

Run: `npm run check-content -- --require-verified=calibration`
Expected now: it fails, listing the 29 calibration and look-alike characters as not verified.

With the founder at the Mac, on `#/review`, "Calibration" group: compare each animation with the 康軒 card or the MOE
site, and tick it only if it matches. A character that does not match is not ticked. Its fix becomes a compose recipe
or an override, and it is re-reviewed.

Export, and save the file as `content/strokes/verified.json`. Run the check again.
Expected: `content check passed`.

- [ ] **Step 4: Commit the verification**

```bash
git add content/strokes/verified.json docs/calibration
git commit -m "Verify calibration characters against MOE stroke order; record input probe"
```

- [ ] **Step 5: Run calibration with each child, using their usual input**

On `#/calibrate`, each child picks a nickname and does the child run (15 characters, copying each one). Then the
founder does the adult look-alike run once. Export each result. Do not coach during the run. Note how each child
reacted, for example "frustrated at 大師, asked to stop", in the founder's words.

- [ ] **Step 6: Write up the results** in `docs/calibration/…-calibration.md`:
- a table per child and tier: correct strokes rejected (x of y);
- look-alikes wrongly accepted, per tier;
- input types used;
- the founder's notes.

Starting targets to compare against. These are proposals for the founder to accept or change, not established
thresholds:
- correct-stroke rejection at most 10% at 修行 with the child's usual input;
- 0 look-alikes accepted at 修行;
- 大師 noticeably stricter than 修行.

- [ ] **Step 7: Tune only with the founder's agreement**

If a target is missed:
1. propose a specific change to `TIERS[*].leniency` or `FINGER_LENIENCY_BONUS`;
2. explain what the data shows;
3. change the value and re-run only the affected part.

Every change, and the numbers behind it, goes in the write-up.

- [ ] **Step 8: Commit**

```bash
git add docs/calibration src/writing/tiers.ts
git commit -m "Record calibration results and tier tuning"
```

Plan 1 is complete when Step 6's write-up exists and the founder has agreed the tiers are good enough to build the game
on. Then Plan 2 is written.
