import { AppPreferencesProvider } from '@/components/app-preferences';
import FocusTrackerWidget from '@/components/focus-tracker-widget';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
const mocks = vi.hoisted(() => ({ load: vi.fn(), camera: vi.fn(), stop: vi.fn(), dispose: vi.fn(), toast: vi.fn(), warmup: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock('@/lib/error-toast', () => ({ showUnexpectedErrorToast: vi.fn() }));
vi.mock('@tensorflow/tfjs', () => ({ ready: async () => {}, setBackend: async () => {}, loadLayersModel: mocks.load, loadGraphModel: mocks.load, tidy: mocks.warmup, LayersModel: class {} }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.warmup.mockReset(); localStorage.clear();
  mocks.load.mockResolvedValue({ dispose: mocks.dispose });
  mocks.camera.mockResolvedValue({ getTracks: () => [{ stop: mocks.stop }] });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: mocks.camera } });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
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
  await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  expect(mocks.dispose).toHaveBeenCalledTimes(1);
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
  await waitFor(() => expect(screen.getByText(/AI model error/)).toBeTruthy());
  expect(mocks.camera).not.toHaveBeenCalled();
});

it('disposes the loaded model if warmup throws before opening the camera', async () => {
 mocks.warmup.mockImplementation(() => { throw new Error('warmup failed'); });
 open(); fireEvent.click(screen.getByRole('switch'));
 await waitFor(() => expect(screen.getByText(/AI model error/)).toBeTruthy());
 expect(mocks.dispose).toHaveBeenCalledTimes(1);
 expect(mocks.camera).not.toHaveBeenCalled();
});
