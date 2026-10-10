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
