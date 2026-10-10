# Glyph Quest rebuild: design

**Date:** 2026-10-09
**Status:** superseded by `docs/superpowers/specs/2026-10-09-spellscript-chinese-design.md`. Kept as history.
Written in a parallel session; on reconciling (2026-10-10) the founder chose the main spec's 3 parent-confirmed tiers
and newly written Chinese-first story text over this draft's 4 child-chosen levels and hand-converted story.
**Replaces:** "Magic Chinese / SpellScript China" on Base44 (glyph-magic-quest.base44.app). The captured build, content
extraction and panel notes are in `../glyph-magic-quest-build/` (panel notes: `docs/panel/`).

## 1. Purpose and players

A handwriting-magic adventure game, based on *Journey to the West*, that gives two children extra practice on the
characters they are learning in school that week.

- **Players:** the founder's two children, in Taiwanese schools: grade 2 (age 7) and grade 4 (age 9).
- **Curriculum:** 康軒 國語 textbook, followed lesson by lesson.
- **Standard:** Taiwan 國字標準字體, Ministry of Education (MOE) stroke counts and 筆順, 注音 as the phonetic system,
  zh-TW speech.
- **Device:** iPad, with a finger or a stylus. Children switch between the two from one session to the next.
- **Later:** a public release, so the design must not depend on this one family. Publishers are swappable, and no
  child data leaves the device.

**What success looks like for the first slice:** both children choose to play again on a later day, without being
asked, and neither gets frustrated with the writing. The parent screen shows which of this week's characters each
child can write from memory.

## 2. Founder rulings this design rests on

From the 2026-10-09 panel, nine reviewers (`../glyph-magic-quest-build/docs/panel/`):

- **Handwriting:** strict and Taiwan-style, checked stroke by stroke including stroke order, with difficulty
  settings so both children want more and neither gets frustrated.
- **Size:** build a 9-episode slice first. The final version is realigned to the novel's canonical 81 tribulations.
- **Coins, shop and streak:** rework them, designed later with the game designer and child-development panellists
  using real play data. They are not part of v1.
- **Language:** Traditional Chinese with 注音 (注音國字) by default, with an English toggle and an English parent view.
- **Build:** Claude writes the code; the founder and partner direct and playtest. It is an offline web app (PWA)
  installed to the iPad home screen.

## 3. Play session

- **Profiles:** each child picks a profile, an avatar plus a nickname chosen from a list (no real names). A profile
  stores the publisher, grade, current lesson and difficulty.
- **Shared story, each child's own characters:** both children walk the same episode. Every spell is filled from
  *that child's* current and earlier lessons.
- **Episode:** about 10 minutes and 4–6 encounters. At each encounter:
  1. A story moment needs magic.
  2. The child hears the word (zh-TW) and sees its 注音, but not the character (聽寫).
  3. The child writes it stroke by stroke.
  4. The spell lands and the world changes.
- **Spells are generic word magic.** Special effects play when the word happens to fit the moment (for example, 水
  calms the river).
- **Introducing new characters:** a new 生字 is introduced by Guanyin: hear it, see its 注音 and meaning, then trace
  it with the outline showing. This counts as **introduced**, not learned.
- **Memory Spirits:** a character the child stumbles on comes back as a Memory Spirit, in the same episode or the
  next, until it is written cleanly.
- **Failure:** the only fail state is fainting. Guanyin carries the child back to the start, and cleared encounters
  stay cleared.

## 4. Handwriting and difficulty

- **Engine:** Hanzi Writer quiz mode (per-stroke matching, MIT licence).
- **Stroke data:** Taiwan-standard data (section 5).

| Level | Outline | Matching | Wrong stroke order | Next-stroke hint |
|---|---|---|---|---|
| 1 Apprentice | faint | lenient | corrected, not counted against them | after 1 miss |
| 2 Student | none | lenient | corrected | after 2 misses |
| 3 Scholar | none | normal | counts as a miss | after 3 misses |
| 4 Master | none | strict | counts as a miss | none |

- **Raising the level:** after a run of clean characters the game *offers* the next level, and the child chooses.
  It asks again later if declined.
- **Quiet help:** if a child keeps missing one character, that character gets more help for that attempt only. The
  child's level is unchanged and nothing announces it.
- **Parent control:** the parent can set or lock each child's level.
- **No sibling comparison:** the game never shows the two children's levels side by side.
- **Input detection:** checked on every stroke from the pointer type. An Apple Pencil gets pen tolerances, and
  finger or palm contact is ignored while the pen is in use. A finger or a capacitive stylus gets the more forgiving
  touch tolerances. If iPadOS does not report the pen as expected, the fallback is a pen/finger toggle on the writing
  screen. This must be proven on the device in build step 1.
- **Tolerances:** the numbers for each level and each input type are tuned from the children's real writing during
  playtesting, not set in advance.
- **Attempt log:** every attempt records the character, difficulty level, input type, whether a hint was used,
  which strokes were missed, the raw strokes, a timestamp and the checker version. Keeping the raw strokes lets old
  attempts be re-graded when the checker changes.
- **The learning ladder:**
  - **introduced:** traced with the outline;
  - **written with help:** written at level 1–2, or with a hint;
  - **written from memory:** written at level 3+ with no hint, on a later calendar day than it was introduced.

  Only "written from memory" counts as learned.

## 5. Content

All content is plain data files, kept separate from code and editable by the founder and partner.

- **Lesson lists** (per publisher, grade and lesson): 生字 to write, and 認讀字 to recognise only, where the textbook
  makes that split. v1 covers 康軒 grades 2 and 4.
- **Character data** (one entry per character):
  - 注音 and pinyin, plus a separate reading wherever a word is read differently (長得 zhǎng versus 很長 cháng);
  - English meaning;
  - MOE stroke count;
  - stroke paths and medians;
  - a `verified` flag recording the source and the date it was checked against MOE 筆順.
- **Story:** episodes with dialogue in 注音國字 plus English, encounter slots, and each episode's canonical
  tribulation number and chapter.
- **Audio:** zh-TW clips for each word, shipped with the app. The browser's speech synthesis is only a fallback.
- **Interface text:** one string table in 注音國字 and English, using one consistent word per idea.
- **Stroke data source:**
  - AnimCJK zhHant (Arphic Public License). It covered 601 of the original game's 639 characters.
  - Characters that exist only in AnimCJK zhHans (30 found, for example 骨) must be checked by hand against MOE.
  - Characters in neither set (8 found: 厲寶獅碼鏡閉霧騙) need hand-made data.
  - Corrected data is published under the same licence.
- **Pipeline for each new lesson:**
  1. The parent sends a photo of the 生字 page.
  2. The 生字 are transcribed and entries built.
  3. The validator refuses any character that does not pass:
     - stroke count equals the MOE figure;
     - stroke data is present;
     - 注音 is present;
     - it contains only Han characters (the original game crashed on `，` and `！`).
  4. Stroke order is spot-checked against MOE 筆順. Characters taken from zhHans and hand-made characters are always
     checked.
- **Sentences:** our own sentences, written around each lesson's words. Textbook lesson texts are never copied.
  Phrasing is reviewed for Taiwan usage.
- **First content job:** convert the original story to Traditional by hand, apply the culture reviewer's must-change
  fixes (`docs/panel/culture-story.md`), and include the `Dw` and `IE` text that the first extraction missed.
  Episodes 1–9 cover tribulations 1–9.

## 6. App structure and data

- **Stack:**
  - TypeScript and Vite;
  - a PWA with a service worker, fully offline once installed;
  - fonts, audio and stroke data bundled with the app;
  - Hanzi Writer for writing;
  - plain HTML and canvas for the map and scenes, with no game engine.
- **Fonts:** a Taiwan 楷書 font for the ghost outlines and character display (全字庫正楷體 / TW-Kai, licence to be
  confirmed), and a Traditional Chinese (TC) font for the interface. Both are self-hosted.
- **Screens:**
  - **Who's playing:** profile tiles.
  - **Journey map:** the 9 episodes, with each child's own progress.
  - **Episode:** tap-to-walk plus an on-screen pad, touch-first on every screen size; story moments; encounters.
  - **Writing panel:** a permanent prompt line, the failed drawing kept visible with feedback, and an Undo button.
  - **Character book:** each child's characters on the three-step ladder.
  - **Parent screen:** behind a hold-to-open or arithmetic gate. It sets the lesson and difficulty for each child,
    shows the evidence view, has backup export and import, and deletes a profile.
- **Storage:**
  - IndexedDB on the device only. No accounts, server, analytics or third-party requests.
  - The game saves after every encounter.
  - The app requests persistent storage, and the parent screen shows whether it was granted.
  - Backup export is in v1, because Safari can evict storage for a site that hasn't been used in a while.
- **Deletion:** removes the profile and all of its attempts. There is no cloud copy that could restore it.

## 7. Testing

Each critical test is proven by deliberately reintroducing the bug it guards against, confirming the test fails,
then reverting. The critical tests:

- The validator rejects a wrong stroke count, missing stroke data, missing 注音 and non-Han characters.
- Saves never lose or roll back progress, including when the app is closed mid-encounter.
- "Written from memory" is recorded only under the ladder rule.
- Deletion leaves no trace of the profile.

Checks that can only be done on the iPad are done with the founder present, and are reported as untested until
then:

- Apple Pencil is reported as a pen, and palm rejection works.
- The app runs offline once installed.
- Storage survives a week without the app being opened.

## 8. Build order

| Step | Deliverable | Playtest question |
|---|---|---|
| 1 | **Writing test:** hear a word and write it, with the four difficulty levels and input detection, on the iPad, using 5 characters from each child's current lesson | Does it feel right with a finger and with a pencil? Are the levels pitched right for each child? |
| 2 | **Content pipeline:** lesson lists from photos, character entries, the validator | Are the 注音 and stroke order correct? |
| 3 | **Episode 1 end to end:** map, story, encounters, Memory Spirits, saving | Do they want to play again tomorrow? |
| 4 | **Profiles and parent screen:** two profiles, settings, the evidence view, backup | Does the parent view tell you anything useful? |
| 5 | **Episodes 2–9:** with the culture fixes applied | Do they finish the slice? |
| 6 | **Rewards:** designed with the game designer and child-development panellists, using play data from steps 3–5 | (decided at that step) |

## 9. Out of scope for v1

- Episodes 10–81.
- Publishers other than 康軒.
- Cloud sync and accounts.
- An App Store build.
- Coins, shop, streak and artifacts (step 6 decides what returns).
- Any data leaving the device.

## 10. Open items

- Each child's current lesson (第幾課), and photos of the 生字 pages. Both are needed for step 1.
- The TW-Kai font licence, and Hanzi Writer behaviour with AnimCJK zhHant data. Both are checked in step 1.
- Whether 認讀字 (recognise only) need a separate reading activity. Deferred until after step 3.
- Rulings on the remaining panel items not covered here. They stay recorded in `docs/panel/` as awaiting a ruling.
