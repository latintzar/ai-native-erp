/* THE RECORDER MACHINE — grown alongside the component, the way Base keeps a component's
 * non-visual machinery beside it (`src/button-timed/utils.ts`, `src/datepicker/utils/`).
 * Base Web is MIT licensed, Copyright (c) Uber Technologies, Inc.
 *
 * ONE OBJECT, TWO SOURCES, ONE INTERFACE — and the second source is the reason the kit page
 * works at all. A design system page that needs a microphone permission before it can show you
 * what a live meter looks like is a page nobody reviews: the first reviewer clicks «Block» and
 * every screenshot after that is a row of dead dots. So the recorder tries the real microphone
 * first, and falls back — silently, with the phase machine none the wiser — to a deterministic
 * level source. The control behaves identically either way; only `source` tells them apart, and
 * the kit page states which one it got rather than pretending.
 *
 * The fallback is DETERMINISTIC, not random: the same seed replays the same meter, so a
 * screenshot of the recording state is the same picture tomorrow.
 */
import { createSimulatedAmplitude } from '../waveform/utils';

/** where the level came from */
export type Source = 'microphone' | 'simulated';

export interface Recorder {
  /** which source started — null until `start` resolves */
  readonly source: Source | null;
  start(): Promise<Source>;
  /** the level right now, 0…1 */
  amplitude(): number;
  /** stop and hand back the audio; null when the level was simulated */
  finish(): Promise<Blob | null>;
  /** stop and throw the audio away */
  cancel(): void;
}

export type RecorderOptions = {
  /** skip the microphone entirely and run the deterministic source */
  simulate?: boolean;
  /** the seed the deterministic source replays from */
  seed?: string;
};

const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

/** the dBFS window the level is mapped through — floor at −35, a 30 dB span, and a soft knee.
 *  Calibrated on a real room rather than chosen: at a lower floor, room hiss sat just above the
 *  waveform's noise gate and drew a solid band, which is a meter that means nothing. */
const DB_FLOOR = -35;
const DB_SPAN = 30;
const DB_KNEE = 1.3;

export class VoiceRecorder implements Recorder {
  source: Source | null = null;

  private options: RecorderOptions;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private samples: Uint8Array<ArrayBuffer> | null = null;
  private simulated: (() => number) | null = null;
  private mime = '';

  constructor(options: RecorderOptions = {}) {
    this.options = options;
  }

  async start(): Promise<Source> {
    if (!this.options.simulate && VoiceRecorder.isSupported()) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mime = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
        this.chunks = [];
        this.recorder = new MediaRecorder(
          this.stream,
          this.mime ? { mimeType: this.mime } : undefined
        );
        this.recorder.ondataavailable = (event) => {
          if (event.data && event.data.size) this.chunks.push(event.data);
        };
        this.recorder.start(250);
        this.context = new AudioContext();
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = 512;
        this.context.createMediaStreamSource(this.stream).connect(this.analyser);
        this.samples = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));
        this.source = 'microphone';
        return this.source;
      } catch {
        // permission refused, no device, or a browser that only half-ships the API — the control
        // does not change behaviour, it changes source
        this.teardown();
      }
    }
    this.simulated = createSimulatedAmplitude(this.options.seed);
    this.source = 'simulated';
    return this.source;
  }

  /** whether this browser can capture at all — asked before the permission prompt, never after */
  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof window.MediaRecorder !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    );
  }

  amplitude(): number {
    if (this.simulated) return this.simulated();
    if (!this.analyser || !this.samples) return 0;
    this.analyser.getByteTimeDomainData(this.samples);
    let peak = 0;
    for (let i = 0; i < this.samples.length; i++) {
      const excursion = Math.abs(this.samples[i] - 128) / 128;
      if (excursion > peak) peak = excursion;
    }
    if (peak <= 0.0001) return 0;
    const db = 20 * Math.log10(peak);
    return Math.pow(Math.min(1, Math.max(0, (db - DB_FLOOR) / DB_SPAN)), DB_KNEE);
  }

  finish(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const recorder = this.recorder;
      if (!recorder || recorder.state === 'inactive') {
        this.teardown();
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const audio = this.chunks.length
          ? new Blob(this.chunks, { type: this.mime || 'audio/webm' })
          : null;
        this.teardown();
        resolve(audio);
      };
      recorder.stop();
    });
  }

  cancel(): void {
    try {
      if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    } catch {
      // already stopped; the teardown below is what matters
    }
    this.chunks = [];
    this.teardown();
  }

  /** NEVER LEAVE A LIVE MICROPHONE BEHIND. Every exit from this object runs through here. */
  private teardown(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close().catch(() => undefined);
    this.stream = null;
    this.recorder = null;
    this.context = null;
    this.analyser = null;
    this.samples = null;
    this.simulated = null;
  }
}

export function createRecorder(options: RecorderOptions = {}): Recorder {
  return new VoiceRecorder(options);
}
