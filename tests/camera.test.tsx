import { AppPreferencesProvider } from '@/components/app-preferences';
import FocusTrackerWidget from '@/components/focus-tracker-widget';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeAll,beforeEach,expect,it,vi } from 'vitest';
import * as tf from '@tensorflow/tfjs';
const mocks = vi.hoisted(() => ({ load: vi.fn(), camera: vi.fn(), stop: vi.fn(), dispose: vi.fn(), warmup: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@tensorflow/tfjs', async importOriginal => ({
  ...await importOriginal<typeof import('@tensorflow/tfjs')>(),
  loadLayersModel: mocks.load, loadGraphModel: mocks.load,
}));
beforeAll(async () => { await tf.setBackend('cpu'); await tf.ready(); });
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  mocks.warmup.mockImplementation(() => tf.tensor1d([0.8]));
  mocks.load.mockResolvedValue({ dispose: mocks.dispose, predict: mocks.warmup });
  const track = Object.assign(new EventTarget(), { stop: mocks.stop, readyState: 'live' });
  mocks.camera.mockResolvedValue({ getTracks: () => [track] });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: mocks.camera } });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function open() {
  const view = render(<AppPreferencesProvider><FocusTrackerWidget /></AppPreferencesProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Focus Shield' }));
  return view;
}
it('does not load a model until enabled and releases camera/model on close', async () => {
  open(); expect(mocks.load).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('switch'));
  await waitFor(() => expect(mocks.camera).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Stop camera and close' }));
  expect(mocks.stop).toHaveBeenCalledTimes(1);
  expect(mocks.dispose).toHaveBeenCalledTimes(1);
});
it('reports permission denial and disposes the model', async () => {
  mocks.camera.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
  open(); fireEvent.click(screen.getByRole('switch'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Camera access failed'));
  expect(mocks.dispose).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
});
it('disposes a late loaded model after unmount without starting camera', async () => {
  let resolve!: (model: { dispose: typeof mocks.dispose }) => void;
  mocks.load.mockReturnValue(new Promise(r => { resolve = r; }));
  const view = open(); fireEvent.click(screen.getByRole('switch'));
  await waitFor(() => expect(mocks.load).toHaveBeenCalled());
  view.unmount();
  await act(async () => resolve({ dispose: mocks.dispose }));
  expect(mocks.dispose).toHaveBeenCalledTimes(1);
  expect(mocks.camera).not.toHaveBeenCalled();
});
it('shows a recoverable model failure without opening camera', async () => {
  mocks.load.mockRejectedValue(new Error('fixture failure'));
  open(); fireEvent.click(screen.getByRole('switch'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('The focus model could not start'));
  expect(mocks.camera).not.toHaveBeenCalled();
  mocks.load.mockResolvedValue({ dispose: mocks.dispose, predict: mocks.warmup });
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(mocks.camera).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('alert')).toBeNull();
});

it('disposes the loaded model if warmup throws before opening the camera', async () => {
 mocks.warmup.mockImplementation(() => { throw new Error('warmup failed'); });
 open(); fireEvent.click(screen.getByRole('switch'));
 await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('The focus model could not start'));
 expect(mocks.dispose).toHaveBeenCalledTimes(1);
 expect(mocks.camera).not.toHaveBeenCalled();
});
