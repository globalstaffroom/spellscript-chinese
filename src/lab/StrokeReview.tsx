import HanziWriter from 'hanzi-writer';
import { useEffect, useMemo, useRef, useState } from 'react';
import calibration from '../../content/calibration.json';
import g2 from '../../content/curricula/kangxuan-g2-1.json';
import g4 from '../../content/curricula/kangxuan-g4-1.json';
import extras from '../../content/extra-characters.json';
import report from '../../content/strokes/report.json';
import verifiedFile from '../../content/strokes/verified.json';
import { calibrationChars, type CalibrationSet, type StrokeReport, type Verified } from '../content/check';
import { loadStrokeJson } from '../content/strokeFiles';
import type { Curriculum, StrokeJson } from '../content/types';
import { StrokeDiagram } from '../writing/StrokeDiagram';
import { downloadJson } from './download';

const KEY = 'ssc-stroke-review-v1';
const load = (): Verified => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } };
const save = (v: Verified) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage blocked: export still works */ } };

type Group = { id: string; label: string; chars: string[] };

export function StrokeReview() {
  const groups: Group[] = useMemo(() => [
    { id: 'calibration', label: 'Calibration + look-alikes (must be verified first)', chars: calibrationChars(calibration as unknown as CalibrationSet) },
    ...([g2, g4] as unknown as Curriculum[]).flatMap(c => c.lessons.map(l => ({ id: `${c.id}-${l.lesson}`, label: `${c.book} 第${l.lesson}課 ${l.title}`, chars: l.write.map(w => w.char) }))),
    { id: 'extras', label: 'Extra characters', chars: (extras as { char: string }[]).map(e => e.char) },
  ], []);
  const [groupId, setGroupId] = useState('calibration');
  const [verified, setVerified] = useState<Verified>(() => ({ ...(verifiedFile as unknown as Verified), ...load() }));
  const [exported, setExported] = useState<string | null>(null);
  const sources = useMemo(() => new Map((report as unknown as StrokeReport).chars.map(c => [c.char, c])), []);
  const group = groups.find(g => g.id === groupId)!;
  const toggle = (char: string, on: boolean) => {
    const next = { ...verified };
    if (on) next[char] = { by: 'founder', date: new Date().toISOString().slice(0, 10) }; else delete next[char];
    setVerified(next); save(next);
  };
  return (
    <section>
      <h2>Stroke-order review</h2>
      <p>Compare each animation with the numbered stroke order on the textbook's 我會寫字 page, or with
        <a href="https://stroke-order.learningweb.moe.edu.tw" target="_blank" rel="noreferrer"> MOE 筆順學習網</a>.
        Tick only when every stroke's order, direction and shape match.</p>
      <select value={groupId} onChange={e => setGroupId(e.target.value)}>
        {groups.map(g => <option key={g.id} value={g.id}>{g.label} ({g.chars.filter(c => verified[c]).length}/{g.chars.length})</option>)}
      </select>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
        {group.chars.map(c => <ReviewCard key={c} char={c} source={sources.get(c)?.source ?? null} expected={sources.get(c)?.expected ?? 0} checked={!!verified[c]} onToggle={on => toggle(c, on)} />)}
      </div>
      <p><button onClick={() => setExported(downloadJson('verified.json', verified))}>Export verified.json ({Object.keys(verified).length})</button></p>
      {exported && <><p>If no file downloaded, copy this text into <code>content/strokes/verified.json</code>:</p><textarea readOnly value={exported} rows={8} style={{ width: '100%' }} /></>}
    </section>
  );
}

function ReviewCard({ char, source, expected, checked, onToggle }: { char: string; source: string | null; expected: number; checked: boolean; onToggle: (on: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const writer = useRef<ReturnType<typeof HanziWriter.create> | null>(null);
  const [data, setData] = useState<StrokeJson | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    loadStrokeJson(char).then(d => {
      setData(d);
      writer.current = HanziWriter.create(box.current!, char, { width: 160, height: 160, padding: 8, showOutline: true, showCharacter: false, charDataLoader: (_c: string, ok: (x: StrokeJson) => void) => ok(d) });
    }, () => setMissing(true));
  }, [char]);
  return (
    <figure style={{ border: '1px solid #ccc', padding: 8, margin: 0, width: 340 }}>
      <figcaption style={{ fontSize: 28 }}>{char} <small style={{ fontSize: 12 }}>{expected} strokes · {source ?? 'NO DATA'}</small></figcaption>
      {missing ? <p role="alert">No stroke data</p> : (
        <div style={{ display: 'flex', gap: 8 }}>
          <div ref={box} onClick={() => writer.current?.animateCharacter()} style={{ cursor: 'pointer' }} title="Tap to play" />
          {data && <StrokeDiagram data={data} size={160} />}
        </div>
      )}
      <label><input type="checkbox" checked={checked} disabled={missing} onChange={e => onToggle(e.target.checked)} /> matches MOE 筆順</label>
    </figure>
  );
}
