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
