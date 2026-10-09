# SpellScript Chinese — design (v1)

Date: 2026-10-09 · Status: approved in conversation, section by section; awaiting review of this written spec.

## 1. Purpose and audience

A handwriting game for learning Traditional Chinese characters, set in *Journey to the West*. The player writes
characters to make the story happen.

- **First players:** the founder's two children, ages 7 and 9, attending school in Taiwan, in grade 2 and grade 4.
  Both use the 康軒 (Kang Hsuan) 國語 textbook.
- **Later:** a public release.
- **Success for v1:** both children choose to come back to it. Each child's 生字 for the current lesson move from
  "met" to "learned" (§3) at a rate the parent can see on the parent screen. Neither child is regularly frustrated:
  first-try success sits around 80% (§5).

This rebuilds a Base44 prototype built by the founder's partner. That prototype used simplified characters and
pinyin, and the founder judged that a major mistake. The rebuild starts from scratch, informed by a 9-member design
panel review (2026-10-09). The panel's notes are in `glyph-magic-quest-build/docs/panel/`. The prototype's compiled
build and extracted content are in `glyph-magic-quest-build/`. That content is reference material only and is not
reused verbatim (see §4).

## 2. Fixed decisions

| Topic | Decision |
|---|---|
| Script and standard | Traditional, Taiwan MOE 國字標準字體. Stroke counts and stroke order follow MOE 筆順. |
| Phonetics | 注音符號 everywhere. No pinyin shown to the child. |
| Prompting | Spoken dictation (聽寫), using a zh-TW voice. |
| Curriculum | Follows each child's 康軒 lesson. Only the 生字 lists are used; lesson texts are never reproduced. |
| Language of story/UI | Traditional Chinese with 注音 above it (注音國字) by default. English toggle, and English available on the parent screen. |
| Device | iPad, used with a finger or an Apple Pencil. |
| Platform | Installable offline web app (PWA). Claude writes the code; the founder and partner direct and playtest. |
| Handwriting | Hanzi Writer quiz mode. Stroke data from AnimCJK `zhHant`, each character verified against MOE 筆順. |
| Strictness | Strict and Taiwan-style, with per-child difficulty tiers (§5). |
| Scope | v1 = 9 levels (the novel's tribulations 1–9). The final game = 81 levels aligned to the novel's canonical list (ch. 99). |
| Economy | No coins, shop, streak or ink in v1. They will be redesigned after v1 playtesting, with the game-designer and child-development panellists. |
| Accounts / data | No accounts and no analytics. All data stays on the device. |
| Repository | `spellscript-chinese`, public on GitHub (globalstaffroom), hosted on GitHub Pages. Other repositories stay private. |

## 3. Core loop and the learning model

**Loop:** the story needs something to happen. The game speaks a word aloud. The child writes the target character
from memory, one stroke at a time. The world visibly changes.

**Meeting a character:** before a trial that needs a character the child has never met, Guanyin teaches it. She
shows the character with its 注音, plays the sound, animates the stroke order, and has the child trace it twice.

**Evidence ladder.** Stored per child, per character. Each stage is only ever reached, never lost.

1. **Met:** traced in a lesson.
2. **Written unaided:** passed a trial with no outline and no hint.
3. **Learned:** written unaided again in a later session, on a different calendar day from the first unaided pass.

Only "learned" is reported to a parent as known. The parent screen reports all three stages, each as "x of N".

**Memory Spirits** are the review mechanism. They are not decoration. A Memory Spirit appears on the path:

- for a character the child failed or needed a hint for, in this level or an earlier one;
- for any character that is due on its review schedule after an unaided pass: 1 day, then 3, 7, 14, 30. A failure
  resets the character to 1 day.

A Memory Spirit never shows an outline at any tier. Its prompt is the sound, plus the help that tier allows on the
"Write:" line (§6). The scheduler is fed only by writing results; there is no self-grading anywhere in the game.

**Failure:** hearts are lost only by failing a trial, not by failing a lesson. A character's first failure in a
session costs no heart. Instead the game shows the full stroke animation and a retry. At 0 hearts the child
"faints": Guanyin carries them back to the start of the level, hearts refill, and cleared trials stay cleared.

## 4. Content model

**Two kinds of trial:**

- **Word seal:** most of each level's writing. The story frames it so that any character fits ("this chain is locked
  with a word"). The target comes from the child's curriculum pool: current lesson first, then review of earlier
  lessons. Siblings face the same seal but write different characters.
- **Story moment:** 2–3 per level. A hand-authored beat where a specific character fits the story (水 calms the
  river). These characters are chosen to be easy and close to both children's grades. They are taught if not yet met,
  and are tracked separately from textbook progress.

**Budget per level:** at most 6 newly met characters and about 25 characters written per child. Checked automatically.

**Data files.** Plain text, editable by hand, all in the repository. JSON or YAML; the final format is chosen in the
implementation plan.

- `characters`: the character, 注音, MOE stroke count, stroke data reference, English meaning, `moeVerified` flag.
- `words`: the word, the per-character reading in context (handles 多音字), English meaning, optional recorded
  audio file.
- `curricula/kangxuan-g2`, `curricula/kangxuan-g4`: lesson → 生字 to write, and the words containing them.
  Transcribed from the founder's photos of the 生字 pages. Structured so another publisher (南一, 翰林) can be added
  later.
- `story/level-NN`: the scenes, every line in Chinese and English, trials, speaker, and canonical tribulation number
  and chapter. Fear-sensitive lines are tagged `threat-to-pilgrims` or `harm-to-bystanders` (§9).
- `strokes/`: generated from AnimCJK `graphicsZhHant.txt`. A small `overrides` set holds characters that are
  hand-corrected or hand-made. Carries the Arphic Public License notice.
- `strings`: every UI string, keyed, in zh-TW and English. One term per concept: 字 always means a written character.

**Content check** (`npm run check-content`, also run in CI). Fails on any of these:

- a character without stroke data, or with `moeVerified` false;
- a character that is simplified or mainland-only (a round-trip check with OpenCC plus a word blocklist, e.g. 這兒,
  短路 used to mean "shortcut", when it actually means "short circuit");
- any non-Han character in a write target (the prototype crashed on ，and ！);
- missing 注音;
- a level over its budget;
- a story line missing its Chinese or English half.

It also prints a report: every 多音字 used, for the founder to check by ear.

**Audio:** the iPad's built-in zh-TW voice speaks whole words. Any word with a recording in `words` plays the
recording instead. If no zh-TW voice is available, the game shows a visible notice and never silently falls back to
zh-CN.

## 5. Handwriting and difficulty

Writing happens on a 田字格 grid using Hanzi Writer's quiz mode. A stroke is accepted only if it is the next stroke in
MOE order and matches its shape and direction within the tier's tolerance. A rejected stroke fades out and counts as
a mistake.

| Setting | 見習 Apprentice | 修行 Practice | 大師 Master |
|---|---|---|---|
| Outline visible | faint outline | none | none |
| Next-stroke hint after | 1 miss | 2 misses | 3 misses |
| Shape tolerance (Hanzi Writer `leniency`) | loose | medium | tight |
| Mistakes before the attempt fails | 6 | 4 | 2 |
| Backwards stroke | accepted | accepted, logged | counts as a mistake |

- **Tier choice:** the tier is set per child by the parent. The game suggests moving up when first-try success has
  stayed above 90% across 3 sessions. When success falls below 65% within a session, it quietly adds hints for the
  rest of that session. The tier itself changes only when the parent confirms. The exact numbers are tuned after
  calibration.
- **Input:** finger mode adds a fixed tolerance allowance on top of the tier. While an Apple Pencil is in use
  (`pointerType: pen`), touch input is ignored, which rejects resting palms.
- **Feedback** names the stroke ("第3筆是撇，從右上開始"). The child's attempt stays visible next to the correct
  form.
- **Calibration (a v1 milestone, before the tiers are trusted):** each child writes about 15 characters they know well,
  using their usual input. Measured: how often correct strokes are rejected at each tier. Separately, look-alike pairs
  are tested to check that wrong characters are rejected (土/士, 人/入, 大/太/犬, 日/目, 未/末, 己/已, 午/牛).

**Attempt log** (on the device). One record per attempt:

- child profile ID, the character, the word, and context (lesson / seal / story moment / Memory Spirit);
- tier, and input type (finger or pen);
- for each stroke: the raw points with timestamps, and accepted or mistake;
- whether a hint was shown and whether the outline was visible;
- the result, the checker version, and the time.

All derived numbers (§3 ladder, §6 parent screen) are computed from this log. Keeping the raw strokes lets a better
checker re-grade old attempts later.

## 6. Screens and interaction

1. **Who's playing:** avatar plus a nickname chosen from a list. No typed names. A parent button sits in the corner.
2. **Journey map:** the 9 levels as stops on the road west, with progress shown per profile.
3. **Level world:** a small tile map. Tap to walk, plus on-screen arrows on any touch device. No input requires a
   keyboard. The companions chat. Progress saves after every trial. Waits before and after a trial are 1 second or
   less, and a tap skips them.
4. **Trial:** a fixed "Write:" line that is never overwritten, holding the word with the target shown as □ and a 🔊
   replay button. Feedback appears in a separate area. What the line shows depends on the tier:
   - 見習: the target's 注音 and the word around it;
   - 修行: the word around it only;
   - 大師: sound only.
5. **Guanyin's lesson:** the character, 注音, sound, the stroke animation, and 2 traces.
6. **Memory Spirit:** as in §3. Never an outline.
7. **Parent screen:** behind a parent gate (hold for 3 seconds, then a simple sum). For each child:
   - met, written unaided and learned, each "x of N" against the current lesson and against all lessons so far;
   - "Struggling with": characters with at least 3 attempts, ranked by failures, with the attempt count shown;
   - minutes practised per day, for the last 14 days;
   - settings for curriculum, lesson and tier;
   - a printable 田字格 sheet of the weak characters;
   - back up / restore;
   - delete a profile, which is permanent and confirmed behind the gate.

**Art:** the partner's character art from the prototype. The founder has confirmed it is free to use. It is
downloaded from media.base44.com into the repository before the Base44 project is retired. Everything else uses a
consistent ink-wash style. Fonts are bundled and nothing is fetched at run time: a Taiwan-standard 楷書 font for the
writing grid and for display, and a TC sans font for the UI. The font licences are chosen in the implementation plan.

## 7. Architecture

- **Stack:** TypeScript, React and Vite. Hanzi Writer for writing. `vite-plugin-pwa` to make the app work offline.
  The level world is rendered with the DOM or a single canvas; this is decided in the plan.
- **Modules,** each testable on its own:
  - `content`: loads the data files and runs the content check.
  - `writing`: wraps Hanzi Writer, applies the tier settings, and emits attempt records.
  - `learning`: the evidence ladder, Memory Spirit scheduling, and the pool of target characters per trial. It is
    pure functions over the attempt log.
  - `storage`: IndexedDB access, persistence, back up and restore.
  - `game`: levels, the map, movement and trial flow.
  - `ui`: the screens and the strings table.
  - `parent`: the parent screen and the printable sheet.
- **Storage:** IndexedDB. On first run the app calls `navigator.storage.persist()`. Back up writes one JSON file
  containing profiles, settings and the attempt log, which the parent saves to iCloud Drive. Restore merges per
  character, keeping the union of attempts, so restoring can never lower progress. Deletion is real and leaves no
  copy that can come back.
- **Hosting:** GitHub Pages, from the public repository. The app makes no network calls at run time other than
  service-worker update checks.

## 8. Testing

- **Unit tests (Vitest)** for the `learning` module (ladder, schedule, pool selection), parent-screen figures, merging
  on back up and restore, and the content check. Each test is proven by re-introducing the bug it guards against and
  confirming it fails.
- **Browser tests (Playwright, WebKit, iPad viewport):** choose a profile, finish a lesson, pass and fail a trial,
  faint, quit and resume mid-level, use the parent gate.
- **Manual checks on the iPad:** calibration (§5), Pencil versus finger, the zh-TW voice, Add to Home Screen, offline
  launch.
- **Panel review:** before the children see each level, the chinese-literacy and culture-story panellists review its
  text. The game-designer and child-development panellists review the first playtest.

## 9. Story rules for v1

- Levels 1–9 follow the novel's tribulations 1–9 (金蟬遭貶 to 陡澗換馬). Each level records its tribulation number
  and chapter.
- Rules for ages 7 and 9:
  - Threats to the pilgrims stay, as in the novel ("the demon wants to eat the Tang monk").
  - Harm actually done to bystanders happens off screen and is described with soft verbs ("took", "locked away").
  - Battles end by naming, sealing or commanding, never by killing.
- Use 大唐 / 東土 and 西天 / 天竺, not "China". Use 觀世音菩薩 / Bodhisattva for Guanyin.
- The prototype's dialogue (`glyph-magic-quest-build/content/`, plus the `Dw` and `IE` blocks in the bundle) is
  reference material. All v1 text is newly written, in Chinese first.

## 10. Out of scope for v1

- Coins, shop, artifacts, streak and ink (§2).
- Levels 10–81.
- Publishers other than 康軒.
- Sync between devices other than a back-up file.
- Any accounts or any server.
- An App Store build.

## 11. Open items (needed during implementation, not blockers for the plan)

- Photos of the 生字 pages for both 康軒 grades. Wanted for the whole year; the current lessons first.
- The partner's agreement that the prototype art will be **publicly** visible in the repository.
- Whether lesson-by-lesson 康軒 生字 lists may be published. Must be checked before any wider public launch.
- The licence for the code (e.g. MIT). Stroke data stays under the Arphic Public License, and fonts under their own
  licences.
