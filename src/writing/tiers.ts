export type TierId = 'apprentice' | 'practice' | 'master';
export type InputKind = 'pen' | 'finger' | 'mouse';

export type TierSettings = {
  id: TierId;
  labelZh: string;
  labelEn: string;
  showOutline: boolean;
  showHintAfterMisses: number;
  /** Hanzi Writer leniency: bigger is looser. Starting values; tuned after calibration (spec §5). */
  leniency: number;
  /** The attempt fails when total mistakes reach this number. */
  maxMistakes: number;
  acceptBackwardsStrokes: boolean;
};

export const TIERS: Record<TierId, TierSettings> = {
  apprentice: { id: 'apprentice', labelZh: '見習', labelEn: 'Apprentice', showOutline: true, showHintAfterMisses: 1, leniency: 1.4, maxMistakes: 6, acceptBackwardsStrokes: true },
  practice: { id: 'practice', labelZh: '修行', labelEn: 'Practice', showOutline: false, showHintAfterMisses: 2, leniency: 1.0, maxMistakes: 4, acceptBackwardsStrokes: true },
  master: { id: 'master', labelZh: '大師', labelEn: 'Master', showOutline: false, showHintAfterMisses: 3, leniency: 0.75, maxMistakes: 2, acceptBackwardsStrokes: false },
};

export const TIER_ORDER: TierId[] = ['apprentice', 'practice', 'master'];

/** Fingertips are less precise than a Pencil (spec §5). Starting value; tuned after calibration. */
export const FINGER_LENIENCY_BONUS = 0.2;

export function quizOptionsFor(tier: TierId, input: InputKind) {
  const t = TIERS[tier];
  return {
    leniency: t.leniency + (input === 'finger' ? FINGER_LENIENCY_BONUS : 0),
    showHintAfterMisses: t.showHintAfterMisses,
    acceptBackwardsStrokes: t.acceptBackwardsStrokes,
    markStrokeCorrectAfterMisses: false as const,
    highlightOnComplete: true as const,
  };
}

export const showOutlineFor = (tier: TierId) => TIERS[tier].showOutline;
