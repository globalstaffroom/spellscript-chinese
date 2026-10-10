import { newId } from './profiles';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('newId works without crypto.randomUUID (plain-HTTP LAN origin, Critical 2)', () => {
  const had = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true, writable: true });
  try {
    expect(typeof crypto.randomUUID).toBe('undefined');
    const a = newId(); const b = newId();
    expect(a).toMatch(V4);
    expect(b).toMatch(V4);
    expect(a).not.toBe(b);
  } finally {
    if (had) Object.defineProperty(crypto, 'randomUUID', had);
    else delete (crypto as { randomUUID?: unknown }).randomUUID;
  }
  expect(newId()).toMatch(V4);
});
