import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as tf from '@tensorflow/tfjs';
import { FocusTrackerSession, type FocusState } from '@/components/focus-tracker-session';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const fault = () => { throw new Error('Injected failure'); };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let baseline: number;
const sessions: FocusTrackerSession[] = [];

function harness() {
  const weight = tf.scalar(1);
  const model = { predict: vi.fn(() => tf.tensor1d([0.8])), dispose: vi.fn(() => weight.dispose()) };
  const tracks = [0, 1].map(() => Object.assign(new EventTarget(), { stop: vi.fn(), readyState: 'live' }));
  const stream = { getTracks: () => tracks } as unknown as MediaStream;
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  const runtime = {
    ...tf,
    ready: vi.fn(async () => {}),
    loadLayersModel: vi.fn(async () => model as unknown as tf.LayersModel),
    loadGraphModel: vi.fn(async () => model as unknown as tf.GraphModel),
    browser: { ...tf.browser, fromPixels: vi.fn(() => tf.zeros([2, 2, 3]) as tf.Tensor3D) },
    setBackend: vi.fn(tf.setBackend),
    disposeVariables: vi.fn(tf.disposeVariables),
    removeBackend: vi.fn(tf.removeBackend),
  };
  const deps = {
    runtime: vi.fn(async () => runtime as typeof tf),
    camera: vi.fn(async () => stream),
    requestFrame: vi.fn((callback: FrameRequestCallback) => { frames.set(id, callback); return id++; }),
    cancelFrame: vi.fn((key: number) => { frames.delete(key); }),
  };
  const update = vi.fn<(state: FocusState) => void>();
  const session = new FocusTrackerSession(update, deps);
  sessions.push(session);
  const video = document.createElement('video');
  Object.defineProperty(video, 'readyState', { value: 2, configurable: true });
  video.play = vi.fn(async () => {});
  video.pause = vi.fn();
  const frame = (time = 1000) => {
    const [key, callback] = [...frames.entries()][0];
    frames.delete(key);
    callback(time);
  };
  const released = () => {
    expect(model.dispose).toHaveBeenCalledTimes(1);
    for (const track of tracks) expect(track.stop).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    expect(video.srcObject).toBeNull();
    expect(video.onloadedmetadata).toBeNull();
    expect(video.onerror).toBeNull();
    expect(runtime.setBackend).not.toHaveBeenCalled();
    expect(runtime.removeBackend).not.toHaveBeenCalled();
    expect(runtime.disposeVariables).not.toHaveBeenCalled();
  };
  return { session, model, weight, tracks, stream, runtime, deps, update, video, frames, frame, released };
}

beforeAll(async () => { await tf.setBackend('cpu'); await tf.ready(); });
beforeEach(() => { baseline = tf.memory().numTensors; });
afterEach(() => {
  sessions.splice(0).forEach(session => session.stop());
  expect(tf.memory().numTensors).toBe(baseline);
  vi.restoreAllMocks();
});

describe('focus session resource ownership', () => {
  it.each(['runtime', 'ready', 'load'] as const)('recovers from %s failure without requesting the camera', async stage => {
    const h = harness();
    // A failed loader never transfers ownership of a model to the session.
    h.weight.dispose();
    if (stage === 'runtime') h.deps.runtime.mockRejectedValueOnce(new Error('import'));
    if (stage === 'ready') h.runtime.ready.mockRejectedValueOnce(new Error('backend'));
    if (stage === 'load') {
      h.runtime.loadLayersModel.mockRejectedValueOnce(new Error('layers'));
      h.runtime.loadGraphModel.mockRejectedValueOnce(new Error('graph'));
    }
    await h.session.start();
    expect(h.update).toHaveBeenLastCalledWith({ phase: 'error', error: 'model', score: 0 });
    expect(h.deps.camera).not.toHaveBeenCalled();
    expect(h.model.dispose).not.toHaveBeenCalled();
  });

  it('falls back to GraphModel and releases its resources', async () => {
    const h = harness();
    h.runtime.loadLayersModel.mockRejectedValueOnce(new Error('not layers'));
    await h.session.start();
    expect(h.runtime.loadGraphModel).toHaveBeenCalledOnce();
    h.session.attach(h.video);
    await flush();
    h.frame();
    expect(h.update).toHaveBeenLastCalledWith({ phase: 'active', score: 80 });
    h.session.stop();
    h.released();
  });

  it.each(['predict', 'readback', 'invalid'] as const)('disposes warm-up tensors and model on %s failure', async stage => {
    const h = harness();
    h.model.predict.mockImplementationOnce(() => {
      const output = tf.tensor1d([stage === 'invalid' ? NaN : 0.8]);
      if (stage === 'predict') fault();
      if (stage === 'readback') vi.spyOn(output, 'dataSync').mockImplementation(fault);
      return output;
    });
    await h.session.start();
    expect(h.model.dispose).toHaveBeenCalledOnce();
    expect(h.deps.camera).not.toHaveBeenCalled();
    expect(h.update).toHaveBeenLastCalledWith({ phase: 'error', error: 'model', score: 0 });
    expect(tf.memory().numTensors).toBe(baseline);
  });

  it('disposes a warmed model when camera permission is denied', async () => {
    const h = harness();
    h.deps.camera.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    await h.session.start();
    expect(h.model.dispose).toHaveBeenCalledOnce();
    expect(h.update).toHaveBeenLastCalledWith({ phase: 'error', error: 'camera', score: 0 });
  });

  it('stops on permission revocation and removes ended listeners before stopping tracks', async () => {
    const h = harness();
    const remove = vi.spyOn(h.tracks[0], 'removeEventListener');
    await h.session.start();
    h.session.attach(h.video);
    await flush();
    h.tracks[0].dispatchEvent(new Event('ended'));
    expect(h.update).toHaveBeenLastCalledWith({ phase: 'error', error: 'camera', score: 0 });
    h.released();
    expect(remove).toHaveBeenCalledWith('ended', expect.any(Function));
    const updates = h.update.mock.calls.length;
    h.tracks[1].dispatchEvent(new Event('ended'));
    expect(h.update).toHaveBeenCalledTimes(updates);
  });

  it('rejects an already ended camera track', async () => {
    const h = harness();
    h.tracks[0].readyState = 'ended';
    await h.session.start();
    expect(h.update).toHaveBeenLastCalledWith({ phase: 'error', error: 'camera', score: 0 });
    expect(h.model.dispose).toHaveBeenCalledOnce();
    h.tracks.forEach(track => expect(track.stop).toHaveBeenCalledOnce());
  });

  it.each(['throw', 'reject', 'event', 'bind'] as const)('releases everything on playback %s', async stage => {
    const h = harness();
    await h.session.start();
    if (stage === 'throw') vi.mocked(h.video.play).mockImplementationOnce(fault);
    if (stage === 'reject') vi.mocked(h.video.play).mockRejectedValueOnce(new Error('play'));
    if (stage === 'bind') Object.defineProperty(h.video, 'srcObject', { get: () => null, set: fault });
    h.session.attach(h.video);
    await flush();
    if (stage === 'event') h.video.dispatchEvent(new Event('error'));
    expect(h.update).toHaveBeenLastCalledWith({ phase: 'error', error: 'playback', score: 0 });
    h.released();
  });

  it.each(['pixels', 'predict', 'readback', 'invalid'] as const)('releases inference tensors, model, frames and tracks on %s failure', async stage => {
    const h = harness();
    await h.session.start();
    h.session.attach(h.video);
    await flush();
    if (stage === 'pixels') h.runtime.browser.fromPixels.mockImplementationOnce(fault);
    else h.model.predict.mockImplementationOnce(() => {
      const output = tf.tensor1d([stage === 'invalid' ? NaN : 0.8]);
      if (stage === 'predict') fault();
      if (stage === 'readback') vi.spyOn(output, 'dataSync').mockImplementation(fault);
      return output;
    });
    h.frame();
    expect(h.update).toHaveBeenLastCalledWith({ phase: 'error', error: 'inference', score: 0 });
    h.released();
    expect(tf.memory().numTensors).toBe(baseline);
  });

  it('cancels frame zero and ignores callbacks delivered after stop; cleanup is idempotent', async () => {
    const h = harness();
    await h.session.start();
    h.session.attach(h.video);
    await flush();
    const stale = h.frames.get(0)!;
    h.session.stop();
    h.session.stop();
    stale(1000);
    h.released();
    expect(h.deps.cancelFrame).toHaveBeenCalledWith(0);
    expect(h.model.predict).toHaveBeenCalledTimes(1);
  });

  it('keeps the shared backend and unrelated tensors alive', async () => {
    const unrelated = tf.scalar(42);
    const backend = tf.backend();
    const h = harness();
    await h.session.start();
    h.session.stop();
    expect(tf.backend()).toBe(backend);
    expect(unrelated.dataSync()[0]).toBe(42);
    unrelated.dispose();
  });

  it('continues cleanup when pause, one track stop and model disposal throw', async () => {
    const h = harness();
    await h.session.start();
    h.session.attach(h.video);
    await flush();
    vi.mocked(h.video.pause).mockImplementation(fault);
    h.tracks[0].stop.mockImplementation(fault);
    h.model.dispose.mockImplementation(() => { h.weight.dispose(); fault(); });
    expect(() => h.session.stop()).not.toThrow();
    h.released();
  });

  it.each(['runtime', 'ready', 'layers', 'graph', 'camera'] as const)('ignores a late %s resolution after cancellation', async stage => {
    const h = harness();
    const wait = deferred<unknown>();
    if (stage === 'runtime') h.deps.runtime.mockReturnValueOnce(wait.promise as Promise<typeof tf>);
    if (stage === 'ready') h.runtime.ready.mockReturnValueOnce(wait.promise as Promise<void>);
    if (stage === 'layers') h.runtime.loadLayersModel.mockReturnValueOnce(wait.promise as Promise<tf.LayersModel>);
    if (stage === 'graph') {
      h.runtime.loadLayersModel.mockRejectedValueOnce(new Error('layers'));
      h.runtime.loadGraphModel.mockReturnValueOnce(wait.promise as Promise<tf.GraphModel>);
    }
    if (stage === 'camera') h.deps.camera.mockReturnValueOnce(wait.promise as Promise<MediaStream>);
    const pending = h.session.start();
    await flush();
    h.session.stop();
    const calls = h.update.mock.calls.length;
    wait.resolve(stage === 'runtime' ? h.runtime : stage === 'camera' ? h.stream : h.model);
    await pending;
    expect(h.update).toHaveBeenCalledTimes(calls);
    if (stage === 'runtime' || stage === 'ready') {
      expect(h.runtime.loadLayersModel).not.toHaveBeenCalled();
      h.weight.dispose();
    } else expect(h.model.dispose).toHaveBeenCalledOnce();
    if (stage === 'camera') for (const track of h.tracks) expect(track.stop).toHaveBeenCalledOnce();
    else expect(h.deps.camera).not.toHaveBeenCalled();
  });

  it.each(['layers', 'camera'] as const)('ignores late %s rejection without affecting a new session', async stage => {
    const old = harness();
    const wait = deferred<never>();
    if (stage === 'layers') old.runtime.loadLayersModel.mockReturnValueOnce(wait.promise);
    else old.deps.camera.mockReturnValueOnce(wait.promise);
    const pending = old.session.start();
    await flush();
    old.session.stop();
    const fresh = harness();
    await fresh.session.start();
    wait.reject(new Error('late failure'));
    await pending;
    expect(old.update).toHaveBeenCalledTimes(1);
    expect(old.runtime.loadGraphModel).not.toHaveBeenCalled();
    expect(fresh.model.dispose).not.toHaveBeenCalled();
    expect(fresh.update).toHaveBeenLastCalledWith({ phase: 'active', score: 0 });
    if (stage === 'layers') old.weight.dispose();
  });

  it.each(['resolve', 'reject'] as const)('ignores stale play %s after detachment and remount', async result => {
    const h = harness();
    const wait = deferred<void>();
    await h.session.start();
    vi.mocked(h.video.play).mockReturnValueOnce(wait.promise);
    const detach = h.session.attach(h.video);
    detach();
    h.session.attach(h.video);
    await flush();
    detach(); // Old cleanup must not detach the new binding on the same element.
    if (result === 'resolve') wait.resolve(); else wait.reject(new Error('late play'));
    await flush();
    expect(h.frames.size).toBe(1);
    expect(h.video.srcObject).toBe(h.stream);
    expect(h.model.dispose).not.toHaveBeenCalled();
    h.session.stop();
    h.released();
  });

  it.each(['resolve', 'reject'] as const)('ignores play %s after stop without scheduling or reporting', async result => {
    const h = harness();
    const wait = deferred<void>();
    await h.session.start();
    vi.mocked(h.video.play).mockReturnValueOnce(wait.promise);
    h.session.attach(h.video);
    h.session.stop();
    const updates = h.update.mock.calls.length;
    if (result === 'resolve') wait.resolve(); else wait.reject(new Error('stopped play'));
    await flush();
    expect(h.update).toHaveBeenCalledTimes(updates);
    expect(h.deps.requestFrame).not.toHaveBeenCalled();
    h.released();
  });

  it.each(['array', 'map'] as const)('rejects ambiguous %s outputs and frees every output tensor', async kind => {
    const h = harness();
    h.model.predict.mockImplementationOnce(() => {
      const a = tf.scalar(0.8);
      const b = tf.scalar(0.2);
      return (kind === 'array' ? [a, b] : { a, b }) as unknown as tf.Tensor1D;
    });
    await h.session.start();
    expect(h.update).toHaveBeenLastCalledWith({ phase: 'error', error: 'model', score: 0 });
    expect(h.model.dispose).toHaveBeenCalledOnce();
    expect(tf.memory().numTensors).toBe(baseline);
  });

  it('waits for metadata, starts one loop and resumes after minimize', async () => {
    const h = harness();
    await h.session.start();
    Object.defineProperty(h.video, 'readyState', { value: 0, configurable: true });
    const detach = h.session.attach(h.video);
    expect(h.video.play).not.toHaveBeenCalled();
    Object.defineProperty(h.video, 'readyState', { value: 2, configurable: true });
    h.video.dispatchEvent(new Event('loadedmetadata'));
    h.video.dispatchEvent(new Event('loadedmetadata'));
    await flush();
    expect(h.frames.size).toBe(1);
    h.frame(1000);
    h.frame(1100);
    expect(h.model.predict).toHaveBeenCalledTimes(2);
    detach();
    expect(h.frames.size).toBe(0);
    expect(h.model.dispose).not.toHaveBeenCalled();
    expect(h.tracks[0].stop).not.toHaveBeenCalled();
    h.session.attach(h.video);
    await flush();
    h.frame(1200);
    expect(h.model.predict).toHaveBeenCalledTimes(3);
    h.session.stop();
    h.released();
  });
});
