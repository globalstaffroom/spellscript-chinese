import type { InputKind, TierId } from '../writing/tiers';

export type Profile = {
  id: string;
  nickname: string;
  avatar: string;
  curriculumId: string;
  lesson: number;
  tier: TierId;
  lastInput: InputKind;
  createdAt: number;
};

/** Picked from a list, never typed: no real names on the device (spec §6). */
export const NICKNAMES = ['小猴', '小龍', '小鶴', '小虎', '小兔', '小熊', '小鹿', '小魚'] as const;
export const AVATARS = ['🐒', '🐉', '🦢', '🐯', '🐰', '🐻', '🦌', '🐟'] as const;

/** crypto.randomUUID only exists in secure contexts; the iPad sessions load the app over plain HTTP on the LAN. */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40; // version 4
  b[8] = (b[8]! & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
