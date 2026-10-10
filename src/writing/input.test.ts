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
