# Curricula

One file per publisher, grade and semester. Each lesson lists the 生字 to write (`write`), in textbook order.

| File | Book | Lessons | 生字 |
|---|---|---|---|
| `kangxuan-g2-1.json` | 康軒 國語 2上 (111學年度 edition) | 12 | 216 |
| `kangxuan-g4-1.json` | 康軒 國語 4上 (2024 printing) | 12 | 180 |

**Source.** Each list was transcribed by eye from the textbook's 「我會寫字」 page. The text layer in the PDFs is
mis-encoded for some characters (希 reads as 溪, 書 as 輸), so the PDF text is never used. The stroke counts are as
the textbook prints them, which follows the MOE standard.

**Check.** Every entry was checked against Unihan `kRSUnicode` (radical number + strokes after radical) with
`tools/validate_curriculum_source.py`.

- The check catches planted errors, including a real misreading (鑣 for 錶).
- Eight entries differ from Unihan because the Taiwan standard form differs: 嘴 充 與 視 朗 母 響 追. Each is marked
  `taiwanStandardDiffers` and was re-checked against the page.
- The check cannot catch a misread character that has the same radical and the same residual stroke count as the
  real one.

**Not yet filled in.** `zhuyin` (to come from a dictionary, by word). Only the 生字 lists are stored here; no lesson
text.
