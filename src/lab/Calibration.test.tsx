import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Calibration } from './Calibration';

let saved = false;
const profile = { id: 'p1', nickname: '小猴', avatar: '🐒', curriculumId: 'kangxuan-g2-1', lesson: 1, tier: 'practice', lastInput: 'finger', createdAt: 0 };
vi.mock('../storage/db', () => ({
  openStoreOrMemory: async () => ({
    reason: null,
    store: {
      listProfiles: async () => [profile], putProfile: async () => {}, addAttempt: async () => { saved = true; },
      warning: () => (saved ? 'Saving to IndexedDB failed (x), so progress will not be kept.' : null),
    },
  }),
  requestPersistence: async () => 'granted',
}));
vi.mock('../writing/WritingPad', () => ({
  WritingPad: (p: { char: string; onFinish: (r: unknown) => void }) => (
    <button onClick={() => p.onFinish({ id: 'a', profileId: 'p1', char: p.char, expectedChar: null, word: null, context: 'calibration', tier: 'apprentice', leniencyInput: 'finger', inputs: ['finger'], outlineVisible: false, hintShown: false, strokes: [], totalMistakes: 0, result: 'passed', checker: 'c', startedAt: 0, endedAt: 1 })}>finish pad</button>
  ),
}));

test('the save warning is shown after an attempt is saved', async () => {
  saved = false;
  render(<Calibration />);
  fireEvent.click((await screen.findAllByText(/小猴/))[0]!);
  fireEvent.click(screen.getByText(/Child run/));
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.click(screen.getByText('finish pad'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Saving to IndexedDB failed/));
});
