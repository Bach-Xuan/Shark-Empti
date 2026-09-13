import { ErrorBoundary } from '@/components/error-boundary';
import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('isolates a render failure and retries without requiring Firebase', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let broken = true;
  function Content() { if (broken) throw new Error('private internal error'); return <p>Recovered</p>; }
  render(<ErrorBoundary><Content /></ErrorBoundary>);
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.queryByText('private internal error')).toBeNull();
  broken = false;
  fireEvent.click(screen.getByText('Retry'));
  expect(screen.getByText('Recovered')).toBeTruthy();
});
