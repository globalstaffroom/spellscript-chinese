import { render, screen } from '@testing-library/react';
import App from './App';

test('shows the app name and the three lab screens', () => {
  window.location.hash = '';
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('SpellScript Chinese');
  expect(screen.getAllByRole('link').map(a => a.getAttribute('href'))).toEqual(['#/probe', '#/review', '#/calibrate']);
});
