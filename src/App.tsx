import { useEffect, useState } from 'react';
import { Calibration } from './lab/Calibration';
import { InputProbe } from './lab/InputProbe';
import { StrokeReview } from './lab/StrokeReview';

const ROUTES = { '#/probe': InputProbe, '#/review': StrokeReview, '#/calibrate': Calibration } as const;

export default function App() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const Page = ROUTES[hash as keyof typeof ROUTES];
  return (
    <main style={{ fontFamily: 'system-ui, "PingFang TC", sans-serif', padding: 16, maxWidth: 1100, margin: '0 auto' }}>
      <h1>SpellScript Chinese</h1>
      <nav style={{ display: 'flex', gap: 16 }}>
        <a href="#/probe">Input probe</a><a href="#/review">Stroke review</a><a href="#/calibrate">Calibration</a>
      </nav>
      {Page ? <Page /> : <p>Writing lab. Pick a screen above.</p>}
    </main>
  );
}
