import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { calibrationChars, type CalibrationSet } from '../content/check';
import calibration from '../../content/calibration.json';
import { StrokeReview } from './StrokeReview';

const first = calibrationChars(calibration as unknown as CalibrationSet)[0]!;
vi.mock('../../content/strokes/verified.json', async () => {
  const cal = (await import('../../content/calibration.json')).default as unknown as CalibrationSet;
  const { calibrationChars: cc } = await import('../content/check');
  return { default: { [cc(cal)[0]!]: { by: 'founder', date: '2026-01-01' } } };
});
vi.mock('hanzi-writer', () => ({ default: { create: () => ({ animateCharacter: () => {} }) } }));
vi.mock('../content/strokeFiles', () => ({ loadStrokeJson: async () => ({ strokes: ['M0 0'], medians: [[[0, 0]]] }) }));

const box = () => screen.getAllByRole('checkbox')[0] as HTMLInputElement;

test('un-ticking a committed character survives a reload', async () => {
  const mem = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); } });
  render(<StrokeReview />);
  await waitFor(() => expect(box().checked).toBe(true));
  fireEvent.click(box());
  expect(box().checked).toBe(false);
  cleanup();
  render(<StrokeReview />);
  expect(box().checked).toBe(false);
  expect(first).toBeTruthy();
});
