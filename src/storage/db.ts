import { openDB, type DBSchema } from 'idb';
import type { AttemptRecord } from '../writing/attempt';
import type { Profile } from './profiles';

interface Schema extends DBSchema {
  profiles: { key: string; value: Profile };
  attempts: { key: string; value: AttemptRecord; indexes: { byProfile: string } };
}

export interface Store {
  putProfile(p: Profile): Promise<void>;
  listProfiles(): Promise<Profile[]>;
  deleteProfile(id: string): Promise<void>;
  addAttempt(a: AttemptRecord): Promise<void>;
  attemptsFor(profileId: string): Promise<AttemptRecord[]>;
}

async function openIdb(name: string): Promise<Store> {
  const db = await openDB<Schema>(name, 1, {
    upgrade(db) {
      db.createObjectStore('profiles', { keyPath: 'id' });
      db.createObjectStore('attempts', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
    },
  });
  return {
    async putProfile(p) { await db.put('profiles', p); },
    listProfiles: () => db.getAll('profiles'),
    async deleteProfile(id) {
      const tx = db.transaction(['profiles', 'attempts'], 'readwrite');
      await tx.objectStore('profiles').delete(id);
      const idx = tx.objectStore('attempts').index('byProfile');
      for (let c = await idx.openCursor(id); c; c = await c.continue()) await c.delete();
      await tx.done;
    },
    async addAttempt(a) { await db.put('attempts', a); },
    attemptsFor: id => db.getAllFromIndex('attempts', 'byProfile', id),
  };
}

function memoryStore(): Store {
  const profiles = new Map<string, Profile>();
  const attempts = new Map<string, AttemptRecord>();
  return {
    async putProfile(p) { profiles.set(p.id, p); },
    async listProfiles() { return [...profiles.values()]; },
    async deleteProfile(id) {
      profiles.delete(id);
      for (const [k, a] of attempts) if (a.profileId === id) attempts.delete(k);
    },
    async addAttempt(a) { attempts.set(a.id, a); },
    async attemptsFor(id) { return [...attempts.values()].filter(a => a.profileId === id); },
  };
}

/** Never throws: if IndexedDB is unavailable, writing still works and the caller shows `reason` (Review Focus 5). */
export async function openStoreOrMemory(name = 'spellscript') {
  if (typeof indexedDB === 'undefined') {
    return { store: memoryStore(), persistent: false, reason: 'IndexedDB is not available, so progress will not be kept.' };
  }
  try {
    return { store: await openIdb(name), persistent: true, reason: null as string | null };
  } catch (err) {
    return { store: memoryStore(), persistent: false, reason: `IndexedDB failed to open (${String(err)}), so progress will not be kept.` };
  }
}

export async function requestPersistence(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!navigator.storage?.persist) return 'unsupported';
  try { return (await navigator.storage.persist()) ? 'granted' : 'denied'; } catch { return 'denied'; }
}
