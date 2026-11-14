// Procedural Web Audio API synthesizer (SFX + Rock BGM Sequencer) & Haptic feedback

const PENTATONIC_FREQS = [
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
  1046.5, // C6
  1174.66,// D6
  1318.51,// E6
];

// 4-bar 8th-note rock progression (32 steps at 138 BPM)
const ROCK_ROOTS_HZ = [
  // Bar 1: E
  82.41, 82.41, 82.41, 82.41, 82.41, 82.41, 82.41, 98.0,
  // Bar 2: C
  65.41, 65.41, 65.41, 65.41, 65.41, 65.41, 65.41, 73.42,
  // Bar 3: G
  98.0, 98.0, 98.0, 98.0, 98.0, 98.0, 98.0, 110.0,
  // Bar 4: D -> B turnaround
  73.42, 73.42, 73.42, 73.42, 61.74, 61.74, 73.42, 61.74,
];

// Catchy rock lead guitar riff (Hz, 0 = rest)
const ROCK_LEAD_HZ = [
  329.63, 0, 392.0, 440.0, 493.88, 0, 392.0, 329.63,
  523.25, 0, 493.88, 392.0, 329.63, 0, 293.66, 329.63,
  392.0, 0, 440.0, 493.88, 587.33, 0, 493.88, 440.0,
  587.33, 0, 493.88, 440.0, 392.0, 440.0, 493.88, 0,
];

function createOverdriveCurve(drive: number): Float32Array<ArrayBuffer> {
  const samples = 1024;
  const buffer = new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT);
  const curve = new Float32Array(buffer);
  const k = drive;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

export class PatisserieAudio {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;

  // Rock BGM sequencer state
  private bgmGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private overdriveCurve: Float32Array<ArrayBuffer> | null = null;
  private bgmPlaying = false;
  private bgmTimerId: number | null = null;
  private nextNoteTime = 0;
  private currentStep = 0;
  private readonly stepDuration = 60 / 138 / 2; // 138 BPM 8th notes

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.bgmGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setTargetAtTime(muted ? 0 : 0.28, now, 0.03);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public unlock(): void {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
        this.initBgmGraph(this.ctx);
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
    } catch {
      // AudioContext unavailable
    }
  }

  private initBgmGraph(ctx: AudioContext): void {
    this.bgmGain = ctx.createGain();
    this.bgmGain.gain.value = this.muted ? 0 : 0.28;
    this.bgmGain.connect(ctx.destination);

    // Reusable white noise buffer for rock snare & hi-hats
    const length = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    this.overdriveCurve = createOverdriveCurve(26);
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      this.unlock();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  // --- Rock Background Music Controls ---
  public startBgm(): void {
    this.unlock();
    if (!this.ctx) return;
    if (this.bgmPlaying) return;

    if (this.bgmGain) {
      const now = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setTargetAtTime(this.muted ? 0 : 0.28, now, 0.05);
    }

    this.bgmPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.06;

    this.bgmTimerId = window.setInterval(() => {
      this.scheduleBgmSteps();
    }, 35);
  }

  public pauseBgm(): void {
    if (!this.bgmPlaying) return;
    this.bgmPlaying = false;
    if (this.bgmTimerId !== null) {
      window.clearInterval(this.bgmTimerId);
      this.bgmTimerId = null;
    }
  }

  public resumeBgm(): void {
    this.unlock();
    if (!this.ctx || this.bgmPlaying) return;
    this.bgmPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.bgmTimerId = window.setInterval(() => {
      this.scheduleBgmSteps();
    }, 35);
  }

  public stopBgm(): void {
    this.pauseBgm();
    this.currentStep = 0;
  }

  private scheduleBgmSteps(): void {
    if (!this.ctx || !this.bgmPlaying) return;
    const lookahead = 0.14;
    while (this.nextNoteTime < this.ctx.currentTime + lookahead) {
      this.triggerRockStep(this.currentStep, this.nextNoteTime);
      this.nextNoteTime += this.stepDuration;
      this.currentStep = (this.currentStep + 1) % 32;
    }
  }

  private triggerRockStep(step: number, time: number): void {
    if (!this.ctx || !this.bgmGain || this.muted) return;
    const ctx = this.ctx;
    const dest = this.bgmGain;
    const barStep = step % 8;

    // 1. Rock Kick Drum (beats 1, 2-and, 3, and turnaround fills)
    if (barStep === 0 || barStep === 3 || barStep === 4 || (step % 16 === 14)) {
      this.playRockKick(ctx, dest, time);
    }

    // 2. Rock Snare Drum (beats 2 & 4 -> steps 2 and 6)
    if (barStep === 2 || barStep === 6) {
      this.playRockSnare(ctx, dest, time);
    }

    // 3. Driving 8th-note Hi-Hat (open accent on bar start)
    this.playRockHiHat(ctx, dest, time, barStep === 0 || barStep === 4);

    // 4. Electric Bass (driving 8th notes)
    const rootHz = ROCK_ROOTS_HZ[step];
    this.playRockBass(ctx, dest, time, rootHz, barStep % 2 === 0);

    // 5. Overdriven Power Chord Guitar (accented rock strums)
    const isAccent = barStep === 0 || barStep === 2 || barStep === 3 || barStep === 5 || barStep === 6;
    if (isAccent) {
      this.playPowerChord(ctx, dest, time, rootHz * 2, barStep === 0 || barStep === 3);
    }

    // 6. Electric Lead Guitar Hook
    const leadHz = ROCK_LEAD_HZ[step];
    if (leadHz > 0) {
      this.playLeadGuitar(ctx, dest, time, leadHz);
    }
  }

  private playRockKick(ctx: AudioContext, dest: AudioNode, time: number): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.11);
    gain.gain.setValueAtTime(0.55, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  private playRockSnare(ctx: AudioContext, dest: AudioNode, time: number): void {
    // Noise snap
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1850, time);
      filter.Q.setValueAtTime(0.8, time);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.32, time);
      nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(dest);
      noise.start(time);
      noise.stop(time + 0.14);
    }

    // Drum body punch
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(195, time);
    osc.frequency.exponentialRampToValueAtTime(105, time + 0.08);
    gain.gain.setValueAtTime(0.24, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  private playRockHiHat(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    accent: boolean
  ): void {
    if (!this.noiseBuffer) return;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(6800, time);
    const gain = ctx.createGain();
    const dur = accent ? 0.08 : 0.04;
    gain.gain.setValueAtTime(accent ? 0.13 : 0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(time);
    noise.stop(time + dur + 0.01);
  }

  private playRockBass(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    freq: number,
    downbeat: boolean
  ): void {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(downbeat ? 480 : 340, time);
    gain.gain.setValueAtTime(downbeat ? 0.28 : 0.2, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + this.stepDuration * 0.9);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + this.stepDuration * 0.95);
  }

  private playPowerChord(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    rootFreq: number,
    heavy: boolean
  ): void {
    const shaper = ctx.createWaveShaper();
    if (this.overdriveCurve) {
      shaper.curve = this.overdriveCurve;
    }
    const cabFilter = ctx.createBiquadFilter();
    cabFilter.type = 'lowpass';
    cabFilter.frequency.setValueAtTime(heavy ? 2400 : 1750, time);

    const gain = ctx.createGain();
    const dur = heavy ? this.stepDuration * 1.45 : this.stepDuration * 0.72;
    gain.gain.setValueAtTime(heavy ? 0.15 : 0.1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    // Root + Perfect 5th power chord
    [rootFreq, rootFreq * 1.498].forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, time);
      osc.connect(shaper);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    });

    shaper.connect(cabFilter);
    cabFilter.connect(gain);
    gain.connect(dest);
  }

  private playLeadGuitar(
    ctx: AudioContext,
    dest: AudioNode,
    time: number,
    freq: number
  ): void {
    const osc = ctx.createOscillator();
    const shaper = ctx.createWaveShaper();
    if (this.overdriveCurve) {
      shaper.curve = this.overdriveCurve;
    }
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1600, time);
    filter.Q.setValueAtTime(0.9, time);

    const gain = ctx.createGain();
    const dur = this.stepDuration * 1.5;
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.exponentialRampToValueAtTime(0.09, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(shaper);
    shaper.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  // --- Gameplay SFX ---
  public playStart(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      gain.gain.setValueAtTime(0.001, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.14, now + i * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.3);
    });
  }

  public playRelease(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.09);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playLand(cutRatio: number): void {
    const ctx = this.ensureContext();
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(165, now);
      osc.frequency.exponentialRampToValueAtTime(68, now + 0.11);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);

      if (cutRatio > 0.03) {
        const sliceOsc = ctx.createOscillator();
        const sliceGain = ctx.createGain();
        sliceOsc.type = 'sawtooth';
        sliceOsc.frequency.setValueAtTime(620, now + 0.01);
        sliceOsc.frequency.exponentialRampToValueAtTime(240, now + 0.09);
        sliceGain.gain.setValueAtTime(0.075, now + 0.01);
        sliceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        sliceOsc.connect(sliceGain);
        sliceGain.connect(ctx.destination);
        sliceOsc.start(now + 0.01);
        sliceOsc.stop(now + 0.11);
      }
    }
    triggerHaptic(cutRatio > 0.2 ? 22 : 12);
  }

  public playPerfect(combo: number, widthRecovered: boolean): void {
    const ctx = this.ensureContext();
    if (ctx) {
      const now = ctx.currentTime;
      const idx = Math.min(combo - 1, PENTATONIC_FREQS.length - 1);
      const baseFreq = PENTATONIC_FREQS[Math.max(0, idx)];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);

      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmer.type = 'triangle';
      shimmer.frequency.setValueAtTime(baseFreq * 1.5, now + 0.03);
      shimmerGain.gain.setValueAtTime(0.001, now + 0.03);
      shimmerGain.gain.exponentialRampToValueAtTime(0.09, now + 0.05);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      shimmer.connect(shimmerGain);
      shimmerGain.connect(ctx.destination);
      shimmer.start(now + 0.03);
      shimmer.stop(now + 0.44);

      if (widthRecovered) {
        const chime = ctx.createOscillator();
        const chimeGain = ctx.createGain();
        chime.type = 'sine';
        chime.frequency.setValueAtTime(baseFreq * 2, now + 0.08);
        chimeGain.gain.setValueAtTime(0.001, now + 0.08);
        chimeGain.gain.exponentialRampToValueAtTime(0.11, now + 0.11);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        chime.connect(chimeGain);
        chimeGain.connect(ctx.destination);
        chime.start(now + 0.08);
        chime.stop(now + 0.52);
      }
    }
    triggerHaptic(widthRecovered ? [15, 25, 20] : 15);
  }

  public playAutoAlign(): void {
    const ctx = this.ensureContext();
    if (ctx) {
      const now = ctx.currentTime;
      [659.25, 987.77].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.045);
        gain.gain.setValueAtTime(0.001, now + i * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.14, now + i * 0.045 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.045 + 0.24);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.045);
        osc.stop(now + i * 0.045 + 0.26);
      });
    }
    triggerHaptic(14);
  }

  public playExpandWidth(): void {
    const ctx = this.ensureContext();
    if (ctx) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(293.66, now);
      osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.18);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
    triggerHaptic([12, 18, 16]);
  }

  public playShieldActivate(): void {
    const ctx = this.ensureContext();
    if (ctx) {
      const now = ctx.currentTime;
      [440, 554.37, 659.25].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.04);
        gain.gain.setValueAtTime(0.001, now + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.13, now + i * 0.04 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.04);
        osc.stop(now + i * 0.04 + 0.32);
      });
    }
    triggerHaptic(18);
  }

  public playShieldSave(): void {
    const ctx = this.ensureContext();
    if (ctx) {
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.05);
        gain.gain.setValueAtTime(0.001, now + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.16, now + i * 0.05 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.35);
      });
    }
    triggerHaptic([20, 30, 35]);
  }

  public playGameOver(): void {
    const ctx = this.ensureContext();
    if (ctx) {
      const now = ctx.currentTime;
      const notes = [392.0, 329.63, 261.63];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.11);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + idx * 0.11 + 0.25);
        gain.gain.setValueAtTime(0.15, now + idx * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.11);
        osc.stop(now + idx * 0.11 + 0.3);
      });
    }
    triggerHaptic([35, 30, 75]);
  }
}

export function triggerHaptic(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported environments
  }
}
