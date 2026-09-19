import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { FocusFailure, FocusState } from '@/components/focus-tracker-session';
import { focusRecoveryCopy } from '@/components/focus-tracker-session';
import { translations } from '@/lib/translations';
import { uiMessage } from '@/lib/i18n';
import FocusTrackerWidget from '@/components/focus-tracker-widget';

const context = vi.hoisted(() => ({ lang: 'en' as 'en' | 'vi', path: '/', instances: [] as {
  update: (state: FocusState) => void;
  stop: ReturnType<typeof vi.fn>;
  attach: ReturnType<typeof vi.fn>;
  detach: ReturnType<typeof vi.fn>;
}[] }));
vi.mock('@/components/app-preferences', () => ({ useLanguageState: () => [context.lang] }));
vi.mock('next/navigation', () => ({ usePathname: () => context.path }));
vi.mock('@/components/ui-text', () => ({ UiText: ({ id }: { id: string }) => <span>{id}</span> }));
vi.mock('@/components/focus-tracker-session', async importOriginal => {
  const original = await importOriginal<typeof import('@/components/focus-tracker-session')>();
  return { ...original, FocusTrackerSession: class {
    stop = vi.fn();
    detach = vi.fn();
    attach = vi.fn(() => this.detach);
    constructor(public update: (state: FocusState) => void) { context.instances.push(this); }
    start() { this.update({ phase: 'starting', score: 0 }); }
  } };
});
beforeEach(() => { context.lang = 'en'; context.path = '/'; context.instances.length = 0; });
afterEach(cleanup);

function openAndStart() {
  fireEvent.click(screen.getByRole('button', { name: translations[context.lang].focusShield }));
  fireEvent.click(screen.getByRole('switch'));
  return context.instances.at(-1)!;
}

it.each((['en', 'vi'] as const).flatMap(lang =>
  (['model', 'camera', 'playback', 'inference'] as FocusFailure[]).map(error => ({ lang, error }))))(
  'shows recoverable $error in $lang with hidden preview and retries without reload', ({ lang, error }) => {
    context.lang = lang;
    render(<FocusTrackerWidget />);
    const session = openAndStart();
    fireEvent.click(screen.getByRole('button', { name: translations[lang].hideCam }));
    act(() => session.update({ phase: 'error', error, score: 0 }));
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(focusRecoveryCopy[lang][error]);
    expect(alert.closest('.opacity-0')).toBeNull();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: focusRecoveryCopy[lang].retry }));
    expect(session.stop).toHaveBeenCalledOnce();
    expect(context.instances).toHaveLength(2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe(focusRecoveryCopy[lang].starting);
    act(() => context.instances[1].update({ phase: 'active', score: 80 }));
    expect(screen.getByText('80%')).toBeTruthy();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  },
);

it('updates an existing error when language changes', () => {
  const view = render(<FocusTrackerWidget />);
  const session = openAndStart();
  act(() => session.update({ phase: 'error', error: 'camera', score: 0 }));
  context.lang = 'vi';
  view.rerender(<FocusTrackerWidget />);
  expect(screen.getByRole('alert').textContent).toContain(focusRecoveryCopy.vi.camera);
});

it('allows cancelling startup, restarting immediately and ignores obsolete state updates', () => {
  render(<FocusTrackerWidget />);
  const old = openAndStart();
  fireEvent.click(screen.getByRole('switch'));
  expect(old.stop).toHaveBeenCalledOnce();
  expect(screen.queryByRole('status')).toBeNull();
  fireEvent.click(screen.getByRole('switch'));
  act(() => old.update({ phase: 'error', error: 'model', score: 0 }));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('status').textContent).toBe(focusRecoveryCopy.en.starting);
});

it.each(['starting', 'active'] as const)('stops %s resources on unmount', phase => {
  const view = render(<FocusTrackerWidget />);
  const session = openAndStart();
  act(() => session.update({ phase, score: 0 }));
  view.unmount();
  expect(session.stop).toHaveBeenCalledOnce();
  if (phase === 'active') expect(session.detach).toHaveBeenCalledOnce();
});

it.each(['/login', '/register'])('stops resources on auth navigation to %s', path => {
  const view = render(<FocusTrackerWidget />);
  const session = openAndStart();
  act(() => session.update({ phase: 'active', score: 80 }));
  context.path = path;
  view.rerender(<FocusTrackerWidget />);
  expect(session.stop).toHaveBeenCalledOnce();
  expect(view.container.textContent).toBe('');
});

it('detaches on minimize, reattaches on expand and stops on close', () => {
  render(<FocusTrackerWidget />);
  const session = openAndStart();
  act(() => session.update({ phase: 'active', score: 80 }));
  expect(session.attach).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: uiMessage('en', 'focus.minimize') }));
  expect(session.detach).toHaveBeenCalledOnce();
  expect(session.stop).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: translations.en.focusShield }));
  expect(session.attach).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: uiMessage('en', 'focus.stop_camera_and_close') }));
  expect(session.stop).toHaveBeenCalledOnce();
  expect(session.detach).toHaveBeenCalledTimes(2);
});
