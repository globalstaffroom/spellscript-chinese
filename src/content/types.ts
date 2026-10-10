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
