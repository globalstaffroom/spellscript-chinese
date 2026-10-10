import { useCallback, useEffect, useRef, useState } from 'react';
import calibration from '../../content/calibration.json';
import type { CalibrationSet } from '../content/check';
import { openStoreOrMemory, requestPersistence, type Store } from '../storage/db';
import { AVATARS, NICKNAMES, newId, type Profile } from '../storage/profiles';
import type { AttemptRecord } from '../writing/attempt';
import { TIERS, TIER_ORDER, type InputKind, type TierId } from '../writing/tiers';
import { WritingPad } from '../writing/WritingPad';
import { summarizeCalibration } from './calibrationSummary';
import { downloadJson } from './download';

const SET = calibration as unknown as CalibrationSet;
type Step = { tier: TierId; char: string; expectedChar: string | null; context: 'calibration' | 'lookalike' };

/** Children write tiers in order, easiest first; then an adult runs the look-alike pairs at 見習 and 修行. */
const childSteps = (): Step[] => TIER_ORDER.flatMap(tier => SET.tiers[tier].map(char => ({ tier, char, expectedChar: null, context: 'calibration' as const })));
const adultSteps = (): Step[] => (['apprentice', 'practice'] as TierId[]).flatMap(tier => SET.lookalikes.map(([asked, written]) => ({ tier, char: asked, expectedChar: written, context: 'lookalike' as const })));

export function Calibration() {
  const [store, setStore] = useState<Store | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<'child' | 'adult' | null>(null);
  const [i, setI] = useState(0);
  const [lastInput, setLastInput] = useState<InputKind>('finger');
  const [results, setResults] = useState<AttemptRecord[]>([]);
  const [exported, setExported] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useCallback(() => { if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; } }, []);
  const advance = useCallback(() => { clearTimer(); setI(n => n + 1); }, [clearTimer]);
  useEffect(() => clearTimer, [clearTimer]);

  useEffect(() => {
    void (async () => {
      const { store, reason } = await openStoreOrMemory();
      const persist = await requestPersistence();
      setStore(store);
      setWarning(reason ?? (persist === 'denied' ? 'The browser may clear this data later (storage persistence was refused).'
        : persist === 'unsupported' ? 'This browser cannot promise to keep this data (no persistent storage).' : null));
      setProfiles(await store.listProfiles());
    })();
  }, []);

  if (!store) return <p>Loading…</p>;
  const choose = (p: Profile) => { setProfile(p); setLastInput(p.lastInput); };
  const steps = mode === 'adult' ? adultSteps() : childSteps();

  if (!profile) {
    return (
      <section>
        <h2>Calibration: who is writing?</h2>
        {warning && <p role="alert">{warning}</p>}
        {profiles.map(p => <button key={p.id} onClick={() => choose(p)} style={{ fontSize: 24, margin: 4 }}>{p.avatar} {p.nickname}</button>)}
        <p>New profile:</p>
        {NICKNAMES.map((n, k) => (
          <button key={n} style={{ margin: 4 }} onClick={async () => {
            const p: Profile = { id: newId(), nickname: n, avatar: AVATARS[k]!, curriculumId: 'kangxuan-g2-1', lesson: 1, tier: 'practice', lastInput: 'finger', createdAt: Date.now() };
            await store.putProfile(p); setProfiles([...profiles, p]); choose(p);
            const w = store.warning(); if (w) setWarning(w);
          }}>{AVATARS[k]} {n}</button>
        ))}
      </section>
    );
  }

  if (!mode) {
    return (
      <section>
        <h2>{profile.avatar} {profile.nickname}</h2>
        {warning && <p role="alert">{warning}</p>}
        <button onClick={() => setMode('child')}>Child run: {childSteps().length} characters, copy each one</button>{' '}
        <button onClick={() => setMode('adult')}>Adult look-alike run: {adultSteps().length} characters</button>
      </section>
    );
  }

  if (i >= steps.length) {
    const sum = summarizeCalibration(results);
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    return (
      <section>
        <h2>Done</h2>
        {warning && <p role="alert">{warning}</p>}
        <table><thead><tr><th>Tier</th><th>Attempts</th><th>Passed</th><th>First try</th><th>Strokes rejected</th></tr></thead>
          <tbody>{TIER_ORDER.map(t => { const f = sum.byTier[t]; return <tr key={t}><td>{TIERS[t].labelZh}</td><td>{f.attempts}</td><td>{f.passed}</td><td>{f.passedFirstTry}</td><td>{f.strokesRejected} of {f.strokesEvaluated} ({pct(f.rejectionRate)})</td></tr>; })}</tbody></table>
        <p>Includes strokes the child genuinely wrote wrong; compare tiers on the same child, not against an absolute target.</p>
        <p>Left unfinished (skipped after writing): {sum.abandoned}</p>
        {sum.lookalikes.length > 0 && <p>Look-alikes wrongly accepted: {sum.lookalikes.filter(l => l.falseAccept).map(l => `${l.written} for ${l.asked} (${TIERS[l.tier].labelZh})`).join(', ') || 'none'}</p>}
        <button onClick={() => setExported(downloadJson(`calibration-${profile.nickname}-${mode}.json`, { profile: { nickname: profile.nickname }, summary: sum, attempts: results }))}>Export results</button>
        {exported && <textarea readOnly value={exported} rows={6} style={{ width: '100%' }} />}
      </section>
    );
  }

  const step = steps[i]!;
  return (
    <section data-testid="calibration-running" style={{ touchAction: 'none' }}>
      {warning && <p role="alert">{warning}</p>}
      <p>{i + 1} / {steps.length} · {TIERS[step.tier].labelZh} · input: {lastInput}</p>
      {step.context === 'calibration'
        ? <p style={{ fontSize: 20 }}>看著寫：<span style={{ fontSize: 64 }}>{step.char}</span></p>
        : <p style={{ fontSize: 20 }}>Adult: the pad expects <b style={{ fontSize: 40 }}>{step.char}</b>. Carefully write <b style={{ fontSize: 40 }}>{step.expectedChar}</b> instead.</p>}
      <WritingPad
        key={`${i}-${step.char}`}
        char={step.char} tier={step.tier} profileId={profile.id} context={step.context} word={null} expectedChar={step.expectedChar}
        leniencyInput={lastInput} size={Math.min(420, window.innerWidth - 32)}
        onInputSeen={setLastInput}
        onFinish={async r => {
          await store.addAttempt(r);
          const w = store.warning(); if (w) setWarning(w);
          // Abandoned attempts (Skip after writing, which unmounts the pad) belong in the summary and the export too.
          setResults(x => [...x, r]);
          const seen = r.inputs.at(-1);
          if (seen) {
            const updated = { ...profile, lastInput: seen };
            await store.putProfile(updated);
            setProfile(updated); setProfiles(ps => ps.map(x => (x.id === updated.id ? updated : x)));
          }
          if (r.result !== 'abandoned') { clearTimer(); timer.current = setTimeout(advance, 600); }
        }}
      />
      <p><button onClick={advance}>Skip</button></p>
    </section>
  );
}
