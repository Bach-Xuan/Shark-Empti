import SetupView from '@/components/setup-view';
import { translations } from '@/lib/translations';
import { act,cleanup,fireEvent,render,screen } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';

const mocks = vi.hoisted(() => ({ validate: vi.fn(), error: vi.fn(), toast: vi.fn() }));
vi.mock('@/ai/client-flows', () => ({ validateAcademicTopic: mocks.validate }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/error-toast', () => ({ showErrorToast: mocks.error }));
vi.mock('@/components/feature-help', () => ({ default: () => null }));
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

function deferred() {
  let resolve!: (result: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function start(container: HTMLElement) {
  fireEvent.change(container.querySelector('input')!, { target: { value: 'Algebra' } });
  fireEvent.submit(container.querySelector('form')!);
}

it('starts once with the validated snapshot and rejects duplicate submits', async () => {
  const task = deferred(); mocks.validate.mockReturnValue(task.promise);
  const onStart = vi.fn();
  const view = render(<SetupView t={translations.en} lang="en" onStart={onStart} />);
  start(view.container);
  fireEvent.submit(view.container.querySelector('form')!);
  expect(mocks.validate).toHaveBeenCalledTimes(1);
  await act(async () => task.resolve({ ok: true, data: { isValid: true } }));
  expect(onStart).toHaveBeenCalledTimes(1);
  expect(onStart.mock.calls[0][0].topic).toBe('Algebra');
});

it.each(['success', 'failure'])('ignores late %s after unmount', async outcome => {
  const task = deferred(); mocks.validate.mockReturnValue(task.promise);
  const onStart = vi.fn();
  const view = render(<SetupView t={translations.en} lang="en" onStart={onStart} />);
  start(view.container); view.unmount();
  await act(async () => outcome === 'success' ? task.resolve({ ok: true, data: { isValid: true } }) : task.reject(new Error('late')));
  expect(onStart).not.toHaveBeenCalled(); expect(mocks.error).not.toHaveBeenCalled();
});

it('revokes an older locale request without releasing the newer request lock', async () => {
  const old = deferred(); const current = deferred();
  mocks.validate.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const onStart = vi.fn();
  const view = render(<SetupView t={translations.en} lang="en" onStart={onStart} />);
  start(view.container);
  view.rerender(<SetupView t={translations.vi} lang="vi" onStart={onStart} />);
  fireEvent.submit(view.container.querySelector('form')!);
  await act(async () => old.resolve({ ok: true, data: { isValid: true } }));
  expect(onStart).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: new RegExp(translations.vi.analyzing, 'i') }).hasAttribute('disabled')).toBe(true);
  await act(async () => current.resolve({ ok: true, data: { isValid: true } }));
  expect(onStart).toHaveBeenCalledTimes(1);
});

it('invalidates a response when configuration changes and preserves the new draft', async () => {
  const task = deferred(); mocks.validate.mockReturnValue(task.promise);
  const onStart = vi.fn();
  const view = render(<SetupView t={translations.en} lang="en" onStart={onStart} />);
  start(view.container);
  fireEvent.change(view.container.querySelector('input')!, { target: { value: 'Geometry' } });
  await act(async () => task.resolve({ ok: true, data: { isValid: true } }));
  expect(onStart).not.toHaveBeenCalled();
  expect((view.container.querySelector('input') as HTMLInputElement).value).toBe('Geometry');
});
