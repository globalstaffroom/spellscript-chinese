import { useEffect, useRef, useState } from 'react';
import { touchKinds } from '../writing/input';

/** Spec §5: prove on the iPad that the Pencil reports as stylus/pen before anything relies on it. */
export function InputProbe() {
  const area = useRef<HTMLDivElement>(null);
  const [log, setLog] = useState<string[]>([]);
  const [seen, setSeen] = useState<Record<string, number>>({});
  useEffect(() => {
    const el = area.current!;
    const note = (line: string, key: string) => {
      setLog(l => [line, ...l].slice(0, 25));
      setSeen(s => ({ ...s, [key]: (s[key] ?? 0) + 1 }));
    };
    const onPointer = (e: PointerEvent) => note(`${e.type} pointerType=${e.pointerType} pressure=${e.pressure.toFixed(2)}`, `pointer:${e.pointerType}`);
    const onTouch = (e: TouchEvent) => { e.preventDefault(); note(`${e.type} touches=${e.touches.length} touchType=${touchKinds(e.changedTouches).join(',')}`, `touch:${touchKinds(e.changedTouches)[0]}`); };
    el.addEventListener('pointerdown', onPointer);
    el.addEventListener('touchstart', onTouch, { passive: false });
    el.addEventListener('touchend', onTouch, { passive: false });
    return () => { el.removeEventListener('pointerdown', onPointer); el.removeEventListener('touchstart', onTouch); el.removeEventListener('touchend', onTouch); };
  }, []);
  return (
    <section>
      <h2>Input probe</h2>
      <p>Draw here with a finger, then with the Apple Pencil, then rest a palm while drawing with the Pencil.</p>
      <div ref={area} style={{ height: 300, border: '2px dashed #888', touchAction: 'none' }} />
      <p><strong>Seen:</strong> {Object.entries(seen).map(([k, n]) => `${k} ×${n}`).join('   ') || 'nothing yet'}</p>
      <pre style={{ fontSize: 12 }}>{log.join('\n')}</pre>
    </section>
  );
}
