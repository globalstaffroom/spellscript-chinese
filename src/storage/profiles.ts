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

export const newId = () => crypto.randomUUID();
