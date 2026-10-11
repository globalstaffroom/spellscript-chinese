import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Calibration } from './Calibration';

const m = vi.hoisted(() => ({
  saved: false,
  persist: 'granted' as 'granted' | 'denied' | 'unsupported',
  putProfile: vi.fn(async (_p: unknown) => {}),
  padProps: [] as { char: string; leniencyInput: string; alternates?: number[][] }[],
}));
const profile = { id: 'p1', nickname: '小猴', avatar: '🐒', curriculumId: 'kangxuan-g2-1', lesson: 1, tier: 'practice', lastInput: 'pen', createdAt: 0 };
vi.mock('../storage/db', () => ({
  openStoreOrMemory: async () => ({
    reason: null,
    store: {
      listProfiles: async () => [profile], putProfile: m.putProfile, addAttempt: async () => { m.saved = true; },
      warning: () => (m.saved ? 'Saving to IndexedDB failed (x), so progress will not be kept.' : null),
    },
  }),
  requestPersistence: async () => m.persist,
}));
vi.mock('../writing/WritingPad', () => ({
  WritingPad: (p: { char: string; leniencyInput: string; alternates?: number[][]; onFinish: (r: unknown) => void }) => {
    m.padProps.push({ char: p.char, leniencyInput: p.leniencyInput, alternates: p.alternates });
    const rec = (result: string, inputs: string[]) => ({ id: 'a', profileId: 'p1', char: p.char, expectedChar: null, word: null, context: 'calibration', tier: 'apprentice', leniencyInput: p.leniencyInput, inputs, outlineVisible: false, hintShown: false, strokes: [], totalMistakes: 0, result, checker: 'c', startedAt: 0, endedAt: 1 });
    return (
      <>
        <button onClick={() => p.onFinish(rec('passed', ['finger']))}>finish pad</button>
        <button onClick={() => p.onFinish(rec('abandoned', []))}>abandon pad</button>
      </>
    );
  },
}));
vi.mock('./download', () => ({ downloadJson: (_name: string, data: unknown) => JSON.stringify(data) }));

beforeEach(() => { m.saved = false; m.persist = 'granted'; m.putProfile.mockClear(); m.padProps = []; });

const startChildRun = async () => {
  render(<Calibration />);
  fireEvent.click((await screen.findAllByText(/小猴/))[0]!);
  fireEvent.click(screen.getByText(/Child run/));
};

test('the save warning is shown after an attempt is saved', async () => {
  await startChildRun();
  expect(screen.queryByRole('alert')).toBeNull();
  fireEvent.click(screen.getByText('finish pad'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Saving to IndexedDB failed/));
});

test('an abandoned attempt reaches the Done summary and the export (item 5)', async () => {
  await startChildRun();
  fireEvent.click(screen.getByText('abandon pad'));
  await waitFor(() => expect(m.saved).toBe(true));
  for (let n = 0; n < 200 && !screen.queryByText('Done'); n++) fireEvent.click(screen.getByText('Skip'));
  expect(screen.getByText('Done')).toBeTruthy();
  await waitFor(() => expect(screen.getByText(/Left unfinished/).textContent).toMatch(/: 1$/));
  fireEvent.click(screen.getByText('Export results'));
  const exported = JSON.parse((screen.getByRole('textbox') as HTMLTextAreaElement).value);
  expect(exported.summary.abandoned).toBe(1);
  expect(exported.attempts.map((a: { result: string }) => a.result)).toEqual(['abandoned']);
});

test('the run starts from the profile\'s last input and saves the input seen (item 8)', async () => {
  await startChildRun();
  expect(m.padProps.at(-1)?.leniencyInput).toBe('pen');
  expect(screen.getByText(/input: pen/)).toBeTruthy();
  fireEvent.click(screen.getByText('finish pad'));
  await waitFor(() => expect(m.putProfile).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1', lastInput: 'finger' })));
});

test('an attempt with no inputs does not touch the profile', async () => {
  await startChildRun();
  fireEvent.click(screen.getByText('abandon pad'));
  await waitFor(() => expect(m.saved).toBe(true));
  expect(m.putProfile).not.toHaveBeenCalled();
});

test('the running step blocks page scrolling so a palm cannot scroll it (item 9)', async () => {
  await startChildRun();
  expect(screen.getByTestId('calibration-running').style.touchAction).toBe('none');
});

test('a browser without persistent storage shows a warning (item 10)', async () => {
  m.persist = 'unsupported';
  render(<Calibration />);
  expect((await screen.findByRole('alert')).textContent).toBe('This browser cannot promise to keep this data (no persistent storage).');
});

test('the pad gets the second official MOE order for 方, and none for a character without one', async () => {
  await startChildRun();
  expect(m.padProps.at(-1)).toMatchObject({ char: '木', alternates: [] });
  for (let n = 0; n < 10 && m.padProps.at(-1)?.char !== '方'; n++) fireEvent.click(screen.getByText('Skip'));
  expect(m.padProps.at(-1)).toMatchObject({ char: '方', alternates: [[0, 1, 3, 2]] });
});
