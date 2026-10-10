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
  /** null while writes reach IndexedDB; otherwise the sentence the screen shows (Review Focus 5). Sticky once set. */
  warning(): string | null;
}

type Ops = Omit<Store, 'warning'>;

const UNAVAILABLE = 'IndexedDB is not available, so progress will not be kept.';
const saveFailed = (err: unknown) => `Saving to IndexedDB failed (${String(err)}), so progress will not be kept.`;

function memoryOps() {
  const profiles = new Map<string, Profile>();
  const attempts = new Map<string, AttemptRecord>();
  const ops: Ops = {
    async putProfile(p) { profiles.set(p.id, p); },
    async listProfiles() { return [...profiles.values()]; },
    async deleteProfile(id) {
      profiles.delete(id);
      for (const [k, a] of attempts) if (a.profileId === id) attempts.delete(k);
    },
    async addAttempt(a) { attempts.set(a.id, a); },
    async attemptsFor(id) { return [...attempts.values()].filter(a => a.profileId === id); },
  };
  return {
    ops,
    forgetProfile: (id: string) => { profiles.delete(id); },
    forgetAttempt: (id: string) => { attempts.delete(id); },
  };
}

function memoryStore(reason: string): Store {
  return { ...memoryOps().ops, warning: () => reason };
}

/** Durable rows win; memory rows are added only when their id is not already durable. */
function mergeById<T extends { id: string }>(durable: T[], memory: T[]): T[] {
  const ids = new Set(durable.map(x => x.id));
  return [...durable, ...memory.filter(x => !ids.has(x.id))];
}

async function openIdb(name: string): Promise<Store> {
  const db = await openDB<Schema>(name, 1, {
    upgrade(db) {
      db.createObjectStore('profiles', { keyPath: 'id' });
      db.createObjectStore('attempts', { keyPath: 'id' }).createIndex('byProfile', 'profileId');
    },
  });
  const mem = memoryOps();
  let warning: string | null = null;
  const failed = (err: unknown) => { warning = saveFailed(err); };
  return {
    async putProfile(p) {
      try { await db.put('profiles', p); mem.forgetProfile(p.id); }
      catch (err) { failed(err); await mem.ops.putProfile(p); }
    },
    async listProfiles() {
      let durable: Profile[];
      try { durable = await db.getAll('profiles'); }
      catch (err) { failed(err); return mem.ops.listProfiles(); }
      return mergeById(durable, await mem.ops.listProfiles());
    },
    async deleteProfile(id) {
      try {
        const tx = db.transaction(['profiles', 'attempts'], 'readwrite');
        await tx.objectStore('profiles').delete(id);
        const idx = tx.objectStore('attempts').index('byProfile');
        for (let c = await idx.openCursor(id); c; c = await c.continue()) await c.delete();
        await tx.done;
      } catch (err) { failed(err); }
      await mem.ops.deleteProfile(id);
    },
    async addAttempt(a) {
      try { await db.put('attempts', a); mem.forgetAttempt(a.id); }
      catch (err) { failed(err); await mem.ops.addAttempt(a); }
    },
    async attemptsFor(profileId) {
      let durable: AttemptRecord[];
      try { durable = await db.getAllFromIndex('attempts', 'byProfile', profileId); }
      catch (err) { failed(err); return mem.ops.attemptsFor(profileId); }
      return mergeById(durable, await mem.ops.attemptsFor(profileId));
    },
    warning: () => warning,
  };
}

/** Never throws: if IndexedDB is unavailable or fails, writing still works and the caller shows `reason` (Review Focus 5). */
export async function openStoreOrMemory(name = 'spellscript') {
  try {
    if (typeof indexedDB === 'undefined') {
      return { store: memoryStore(UNAVAILABLE), persistent: false, reason: UNAVAILABLE as string | null };
    }
    return { store: await openIdb(name), persistent: true, reason: null as string | null };
  } catch (err) {
    const reason = `IndexedDB failed to open (${String(err)}), so progress will not be kept.`;
    return { store: memoryStore(reason), persistent: false, reason: reason as string | null };
  }
}

export async function requestPersistence(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!navigator.storage?.persist) return 'unsupported';
  try { return (await navigator.storage.persist()) ? 'granted' : 'denied'; } catch { return 'denied'; }
}
