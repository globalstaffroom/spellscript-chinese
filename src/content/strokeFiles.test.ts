import { charToFile } from './strokeFiles';

test('file names are the upper-case hex code point', () => {
  expect(charToFile('年')).toBe('5E74.json');
  expect(charToFile('𠂤')).toBe('200A4.json');
});

test('rejects anything that is not exactly one character', () => {
  expect(() => charToFile('小狗')).toThrow();
  expect(() => charToFile('')).toThrow();
});
