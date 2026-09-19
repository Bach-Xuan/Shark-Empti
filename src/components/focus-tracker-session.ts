import type * as TF from '@tensorflow/tfjs';

type Runtime = typeof TF;
type Model = TF.LayersModel | TF.GraphModel;
export type FocusFailure = 'model' | 'camera' | 'playback' | 'inference';
export type FocusState = { phase: 'idle' | 'starting' | 'active' | 'error'; error?: FocusFailure; score: number };
type Dependencies = {
  runtime: () => Promise<Runtime>;
  camera: () => Promise<MediaStream>;
  requestFrame: (callback: FrameRequestCallback) => number;
  cancelFrame: (id: number) => void;
};
const defaults: Dependencies = {
  runtime: () => import('@tensorflow/tfjs'),
  camera: () => navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } }),
  requestFrame: callback => requestAnimationFrame(callback),
  cancelFrame: id => cancelAnimationFrame(id),
};
const MODEL_URL = '/models/focus-model/model.json';
const SIZE = 224;

// Cleanup is best effort per resource: one broken driver must not retain the rest.
function release(action: () => void) { try { action(); } catch { /* Continue releasing owned resources. */ } }
function stopStream(stream: MediaStream) { stream.getTracks().forEach(track => release(() => track.stop())); }

export const focusRecoveryCopy = {
  en: {
    model: 'The focus model could not start. Try again.',
    camera: 'Camera access failed. Check camera permissions and try again.',
    playback: 'Camera playback failed. Try again.',
    inference: 'Focus analysis failed. Try again.',
    retry: 'Try again', starting: 'Starting focus tracking…',
  },
  vi: {
    model: 'Không thể khởi động mô hình tập trung. Vui lòng thử lại.',
    camera: 'Không thể truy cập camera. Kiểm tra quyền camera và thử lại.',
    playback: 'Không thể phát hình ảnh camera. Vui lòng thử lại.',
    inference: 'Phân tích độ tập trung thất bại. Vui lòng thử lại.',
    retry: 'Thử lại', starting: 'Đang khởi động theo dõi tập trung…',
  },
};

/** One attempt owns its model, stream and video binding. No global TF backend is disposed. */
export class FocusTrackerSession {
  private stopped = false;
  private started = false;
  private model: Model | null = null;
  private stream: MediaStream | null = null;
  private removeTrackListeners: (() => void)[] = [];
  private detachVideo: (() => void) | null = null;
  constructor(private readonly update: (state: FocusState) => void, private readonly deps: Dependencies = defaults) {}

  stop() {
    this.stopped = true;
    this.detachVideo?.();
    this.detachVideo = null;
    const stream = this.stream;
    const model = this.model;
    this.stream = null;
    this.model = null;
    this.runtime = null;
    this.removeTrackListeners.splice(0).forEach(remove => release(remove));
    if (stream) stopStream(stream);
    if (model) release(() => model.dispose());
  }

  private fail(error: FocusFailure) {
    if (this.stopped) return;
    this.stop();
    this.update({ phase: 'error', error, score: 0 });
  }

  async start() {
    if (this.started || this.stopped) return;
    this.started = true;
    this.update({ phase: 'starting', score: 0 });
    let stage: FocusFailure = 'model';
    try {
      const tf = await this.deps.runtime();
      if (this.stopped) return;
      // Respect the shared runtime's backend; ready() initializes its preferred backend.
      await tf.ready();
      if (this.stopped) return;
      let model: Model;
      try { model = await tf.loadLayersModel(MODEL_URL); }
      catch {
        if (this.stopped) return;
        model = await tf.loadGraphModel(MODEL_URL);
      }
      if (this.stopped) { release(() => model.dispose()); return; }
      this.model = model;
      tf.tidy(() => {
        const input = tf.zeros([1, SIZE, SIZE, 3]);
        const output = this.predict(model, input);
        this.probability(output); // Forces GPU execution/readback during warm-up.
      });
      stage = 'camera';
      const stream = await this.deps.camera();
      if (this.stopped) { stopStream(stream); return; }
      this.stream = stream;
      for (const track of stream.getTracks()) {
        const ended = () => this.fail('camera');
        track.addEventListener('ended', ended);
        this.removeTrackListeners.push(() => track.removeEventListener('ended', ended));
        if (track.readyState === 'ended') throw new Error('Camera track already ended');
      }
      this.runtime = tf;
      this.update({ phase: 'active', score: 0 });
    } catch { this.fail(stage); }
  }

  private runtime: Runtime | null = null;
  private predict(model: Model, input: TF.Tensor) {
    // Both LayersModel and GraphModel expose synchronous predict().
    return model.predict(input);
  }
  private probability(output: TF.Tensor | TF.Tensor[] | TF.NamedTensorMap) {
    if (Array.isArray(output) || !('dataSync' in output) || typeof output.dataSync !== 'function') {
      throw new Error('Expected a single focus probability tensor');
    }
    const value = output.dataSync()[0];
    if (!Number.isFinite(value)) throw new Error('Invalid focus probability');
    return Math.max(0, Math.min(100, Math.round(value * 100)));
  }

  attach(video: HTMLVideoElement): () => void {
    this.detachVideo?.();
    const tf = this.runtime;
    const model = this.model;
    if (this.stopped || !this.stream || !tf || !model) return () => {};
    let attached = true;
    let playing = false;
    let frame: number | null = null;
    let lastTime = -Infinity;
    const current = () => attached && !this.stopped;
    const detach = () => {
      if (!attached) return;
      attached = false;
      if (this.detachVideo === detach) this.detachVideo = null;
      if (frame !== null) release(() => this.deps.cancelFrame(frame!));
      frame = null;
      video.onloadedmetadata = null;
      video.onerror = null;
      release(() => video.pause());
      release(() => { video.srcObject = null; });
    };
    this.detachVideo = detach;
    const processFrame: FrameRequestCallback = timestamp => {
      frame = null;
      if (!current()) return;
      try {
        if (video.readyState >= 2 && timestamp - lastTime >= 800) {
          lastTime = timestamp;
          const score = tf.tidy(() => {
            const pixels = tf.browser.fromPixels(video);
            const input = tf.image.resizeBilinear(pixels, [SIZE, SIZE]).toFloat().div(127.5).sub(1).expandDims(0);
            return this.probability(this.predict(model, input));
          });
          this.update({ phase: 'active', score });
        }
        if (current()) frame = this.deps.requestFrame(processFrame);
      } catch { if (current()) this.fail('inference'); }
    };
    const play = async () => {
      if (!current() || playing) return;
      playing = true;
      try {
        await video.play();
        if (current()) frame = this.deps.requestFrame(processFrame);
      } catch { if (current()) this.fail('playback'); }
    };
    try {
      video.onerror = () => { if (current()) this.fail('playback'); };
      video.onloadedmetadata = () => { void play(); };
      video.srcObject = this.stream;
      if (video.readyState >= 1) void play();
    } catch { this.fail('playback'); }
    return detach;
  }
}
