import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { StrokeReview } from './StrokeReview';

const created: HTMLElement[] = [];
vi.mock('hanzi-writer', () => ({
  default: { create: (el: HTMLElement) => { created.push(el); el.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg')); return { animateCharacter: () => {} }; } },
}));
vi.mock('../content/strokeFiles', () => ({
  loadStrokeJson: async () => ({ strokes: ['M0 0'], medians: [[[0, 0]]] }),
}));

test('under StrictMode each review card holds exactly one drawing', async () => {
  created.length = 0;
  render(<StrictMode><StrokeReview /></StrictMode>);
  const cards = screen.getAllByRole('figure');
  await waitFor(() => expect(cards.every(c => c.querySelector('svg[role="img"]'))).toBe(true));
  await new Promise(r => setTimeout(r, 20));
  for (const c of cards) expect(c.querySelectorAll('div[title="Tap to play"] > svg').length).toBe(1);
});
