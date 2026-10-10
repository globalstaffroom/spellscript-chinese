import 'fake-indexeddb/auto';
import { openStoreOrMemory, requestPersistence } from './db';
import type { Profile } from './profiles';
import type { AttemptRecord } from '../writing/attempt';

const profile = (id: string): Profile => ({ id, nickname: '小猴', avatar: '🐒', curriculumId: 'kangxuan-g2-1', lesson: 3, tier: 'practice', lastInput: 'finger', createdAt: 1 });
const attempt = (id: string, profileId: string): AttemptRecord => ({
  id, profileId, char: '木', expectedChar: null, word: null, context: 'calibration', tier: 'practice', leniencyInput: 'finger',
  inputs: ['finger'], outlineVisible: false, hintShown: false, strokes: [], totalMistakes: 0, result: 'passed',
  checker: 'x', startedAt: 1, endedAt: 2,
});

const realIndexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
const realStorage = Object.getOwnPropertyDescriptor(navigator, 'storage');

function setStorage(value: unknown) {
  Object.defineProperty(navigator, 'storage', { value, configurable: true });
}
function restoreStorage() {
  if (realStorage) Object.defineProperty(navigator, 'storage', realStorage);
  else delete (navigator as unknown as Record<string, unknown>).storage;
}

test('profiles and attempts round-trip through IndexedDB', async () => {
  const { store, persistent } = await openStoreOrMemory('t1');
  expect(persistent).toBe(true);
  await store.putProfile(profile('p1'));
  await store.addAttempt(attempt('a1', 'p1'));
  await store.addAttempt(attempt('a2', 'p2'));
  expect((await store.listProfiles()).map(p => p.id)).toEqual(['p1']);
  expect((await store.attemptsFor('p1')).map(a => a.id)).toEqual(['a1']);
  expect(store.warning()).toBeNull();
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
    expect(reason).toMatch(/not available/);
    expect(store.warning()).toMatch(/not available/);
    await store.addAttempt(attempt('a1', 'p1'));
    expect(await store.attemptsFor('p1')).toHaveLength(1);
  } finally {
    globalThis.indexedDB = saved;
  }
});

test('an indexedDB getter that throws falls back instead of rejecting', async () => {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, get() { throw new Error('storage blocked'); } });
  try {
    const { store, persistent, reason } = await openStoreOrMemory('t4');
    expect(persistent).toBe(false);
    expect(reason).toMatch(/failed to open/);
    await store.addAttempt(attempt('a1', 'p1'));
    expect(await store.attemptsFor('p1')).toHaveLength(1);
  } finally {
    if (realIndexedDB) Object.defineProperty(globalThis, 'indexedDB', realIndexedDB);
  }
});

test('when opening IndexedDB fails, the reason says it failed to open and writing still works', async () => {
  const spy = vi.spyOn(indexedDB, 'open').mockImplementation(() => { throw new Error('blocked'); });
  try {
    const { store, persistent, reason } = await openStoreOrMemory('t5');
    expect(persistent).toBe(false);
    expect(reason).toMatch(/failed to open/);
    await store.addAttempt(attempt('a1', 'p1'));
    expect((await store.attemptsFor('p1')).map(a => a.id)).toEqual(['a1']);
  } finally {
    spy.mockRestore();
  }
});

test('a write that fails after IndexedDB opened resolves, keeps the attempt visible, and sets a warning', async () => {
  const { store, persistent } = await openStoreOrMemory('tw');
  expect(persistent).toBe(true);
  expect(store.warning()).toBeNull();
  const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new Error('storage full'); });
  try {
    await expect(store.addAttempt(attempt('a1', 'p1'))).resolves.toBeUndefined();
    expect((await store.attemptsFor('p1')).map(a => a.id)).toEqual(['a1']);
    expect(store.warning()).toMatch(/Saving to IndexedDB failed/);
  } finally {
    spy.mockRestore();
  }
});

test('requestPersistence reports unsupported when navigator.storage has no persist', async () => {
  try {
    setStorage({});
    expect(await requestPersistence()).toBe('unsupported');
  } finally {
    restoreStorage();
  }
});

test('requestPersistence reports granted and denied from persist()', async () => {
  try {
    setStorage({ persist: async () => true });
    expect(await requestPersistence()).toBe('granted');
    setStorage({ persist: async () => false });
    expect(await requestPersistence()).toBe('denied');
  } finally {
    restoreStorage();
  }
});

test('requestPersistence reports denied when persist() throws', async () => {
  try {
    setStorage({ persist: async () => { throw new Error('not allowed'); } });
    expect(await requestPersistence()).toBe('denied');
  } finally {
    restoreStorage();
  }
});

test('memory-only store deleteProfile removes that profile and its attempts only', async () => {
  const saved = globalThis.indexedDB;
  // @ts-expect-error simulate a browser without IndexedDB
  delete globalThis.indexedDB;
  try {
    const { store } = await openStoreOrMemory('t6');
    await store.putProfile(profile('p1'));
    await store.putProfile(profile('p2'));
    await store.addAttempt(attempt('a1', 'p1'));
    await store.addAttempt(attempt('a2', 'p2'));
    await store.deleteProfile('p1');
    expect((await store.listProfiles()).map(p => p.id)).toEqual(['p2']);
    expect(await store.attemptsFor('p1')).toEqual([]);
    expect((await store.attemptsFor('p2')).map(a => a.id)).toEqual(['a2']);
  } finally {
    globalThis.indexedDB = saved;
  }
});
