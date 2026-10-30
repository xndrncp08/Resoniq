import type { Effect, StudioPatch } from "@/lib/studio/patch";
import { CAB_VOICINGS, SPEAKER_VOICINGS, VOICINGS, dbToGain, expMap, gatePedalDb, levelDb, masterDb, micFilters, reverbImpulse, shaperCurve, stackDb, stageDrives } from "@/lib/studio/dsp";

/**
 * The studio's signal chain in Web Audio. Every control in the studio that
 * claims to change the sound changes a node here:
 *
 *   source → input → gate → [pre-amp pedals, in order] → amp (two
 *   waveshaper stages with filters) → cabinet (speaker and mic filters, or
 *   a loaded impulse response) → [post pedals, in order] → output →
 *   limiter → speakers
 *
 * Parameter changes glide (setTargetAtTime) so dragging a knob never clicks.
 */

const GLIDE = 0.02;

type Unit = { input: GainNode; output: GainNode; set: (e: Effect) => void; dispose: () => void };

function biquad(ctx: BaseAudioContext, type: BiquadFilterType, frequency: number, gain = 0, Q = 0.707) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.gain.value = gain;
  f.Q.value = Q;
  return f;
}

function chain(...nodes: AudioNode[]) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
}

/** Wraps an effect's wet path with a click-free bypass. */
function unit(ctx: AudioContext, build: (input: AudioNode, output: AudioNode) => { set: (e: Effect) => void; dispose?: () => void }, dryWhenOn = 0): Unit {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  const wetIn = ctx.createGain();
  input.connect(dry).connect(output);
  input.connect(wetIn);
  const inner = build(wetIn, output);
  return {
    input,
    output,
    set: (e) => {
      const t = ctx.currentTime;
      dry.gain.setTargetAtTime(e.on ? dryWhenOn : 1, t, GLIDE);
      wetIn.gain.setTargetAtTime(e.on ? 1 : 0, t, GLIDE);
      inner.set(e);
    },
    dispose: () => {
      inner.dispose?.();
      for (const n of [input, output, dry, wetIn]) n.disconnect();
    },
  };
}

function lfo(ctx: AudioContext, target: AudioParam, amount: number, hz: number) {
  const osc = ctx.createOscillator();
  const depth = ctx.createGain();
  osc.frequency.value = hz;
  depth.gain.value = amount;
  osc.connect(depth).connect(target);
  osc.start();
  return { osc, depth };
}

function buildEffect(ctx: AudioContext, e: Effect): Unit {
  const t = () => ctx.currentTime;
  switch (e.type) {
    case "compressor":
      return unit(ctx, (input, output) => {
        const comp = ctx.createDynamicsCompressor();
        comp.attack.value = 0.005;
        comp.release.value = 0.15;
        comp.knee.value = 6;
        const makeup = ctx.createGain();
        chain(input, comp, makeup, output);
        return {
          set: ({ params: p }) => {
            comp.threshold.setTargetAtTime(-10 - p.sustain * 4, t(), GLIDE);
            comp.ratio.setTargetAtTime(3 + p.sustain * 0.6, t(), GLIDE);
            makeup.gain.setTargetAtTime(dbToGain(stackDb(p.level) + p.sustain * 1.4), t(), GLIDE);
          },
        };
      });
    case "overdrive":
      return unit(ctx, (input, output) => {
        // A mid-humped soft clipper: low cut before, tone filter after.
        const hp = biquad(ctx, "highpass", 320);
        const shaper = ctx.createWaveShaper();
        shaper.oversample = "4x";
        const tone = biquad(ctx, "lowpass", 3000);
        const level = ctx.createGain();
        const low = biquad(ctx, "lowpass", 320);
        chain(input, hp, shaper, tone, level, output);
        // Some clean low end blended back in keeps it from thinning the amp.
        const lowLevel = ctx.createGain();
        lowLevel.gain.value = 0.35;
        chain(input, low, lowLevel, level);
        let last = -1;
        return {
          set: ({ params: p }) => {
            if (p.drive !== last) shaper.curve = shaperCurve("soft", 1 + p.drive * 1.6);
            last = p.drive;
            tone.frequency.setTargetAtTime(expMap(p.tone, 900, 8000), t(), GLIDE);
            level.gain.setTargetAtTime(dbToGain(stackDb(p.level)), t(), GLIDE);
          },
        };
      });
    case "boost":
      return unit(ctx, (input, output) => {
        // Clean gain with a gentle treble tilt; it pushes whatever follows it harder.
        const tilt = biquad(ctx, "highshelf", 1800);
        const level = ctx.createGain();
        chain(input, tilt, level, output);
        return {
          set: ({ params: p }) => {
            tilt.gain.setTargetAtTime((p.tone - 5) * 1.6, t(), GLIDE);
            level.gain.setTargetAtTime(dbToGain(p.level * 2), t(), GLIDE);
          },
        };
      });
    case "distortion":
      return unit(ctx, (input, output) => {
        // Hard clipping with a pre-emphasis bump, then a fixed fizz filter and a sweepable one.
        const hp = biquad(ctx, "highpass", 120);
        const emph = biquad(ctx, "peaking", 900, 6, 0.7);
        const shaper = ctx.createWaveShaper();
        shaper.oversample = "4x";
        const fizz = biquad(ctx, "lowpass", 7000);
        const tone = biquad(ctx, "lowpass", 3000);
        const level = ctx.createGain();
        chain(input, hp, emph, shaper, fizz, tone, level, output);
        let last = -1;
        return {
          set: ({ params: p }) => {
            if (p.drive !== last) shaper.curve = shaperCurve("hard", expMap(p.drive, 2, 250));
            last = p.drive;
            tone.frequency.setTargetAtTime(expMap(p.tone, 1200, 9000), t(), GLIDE);
            level.gain.setTargetAtTime(dbToGain(stackDb(p.level) - 6), t(), GLIDE);
          },
        };
      });
    case "fuzz":
      return unit(ctx, (input, output) => {
        // Exponential clipping, then a tone control that fades from a low-pass to a high-pass (scooping the mids between).
        const shaper = ctx.createWaveShaper();
        shaper.oversample = "4x";
        const lo = biquad(ctx, "lowpass", 700);
        const hi = biquad(ctx, "highpass", 1300);
        const loG = ctx.createGain();
        const hiG = ctx.createGain();
        const level = ctx.createGain();
        chain(input, shaper);
        chain(shaper, lo, loG, level);
        chain(shaper, hi, hiG, level);
        level.connect(output);
        let last = -1;
        return {
          set: ({ params: p }) => {
            if (p.drive !== last) shaper.curve = shaperCurve("fuzz", expMap(p.drive, 3, 400));
            last = p.drive;
            loG.gain.setTargetAtTime(1 - p.tone / 10, t(), GLIDE);
            hiG.gain.setTargetAtTime((p.tone / 10) * 1.4, t(), GLIDE);
            level.gain.setTargetAtTime(dbToGain(stackDb(p.level) - 4), t(), GLIDE);
          },
        };
      });
    case "wah":
      return unit(ctx, (input, output) => {
        // A resonant low-pass swept by the pedal position (or by an LFO in Auto).
        const filter = biquad(ctx, "lowpass", 900, 0, 7);
        const trim = ctx.createGain();
        trim.gain.value = 0.55;
        chain(input, filter, trim, output);
        const sweep = lfo(ctx, filter.frequency, 0, 1);
        return {
          set: ({ params: p, voice }) => {
            const centre = expMap(p.position, 380, 2200);
            filter.frequency.setTargetAtTime(centre, t(), GLIDE);
            sweep.osc.frequency.setTargetAtTime(expMap(p.rate, 0.3, 6), t(), GLIDE);
            sweep.depth.gain.setTargetAtTime(voice === "Auto" ? centre * 0.75 * (p.depth / 10) : 0, t(), GLIDE);
            filter.Q.setTargetAtTime(3 + (p.depth / 10) * 6, t(), GLIDE);
          },
          dispose: () => sweep.osc.stop(),
        };
      });
    case "gate":
      return unit(ctx, (input, output) => {
        // Same detector as the input gate: the level just before this pedal, checked every 10 ms with 4 dB of hysteresis.
        const vca = ctx.createGain();
        const tap = ctx.createAnalyser();
        tap.fftSize = 512;
        input.connect(tap);
        chain(input, vca, output);
        const block = new Float32Array(512);
        let open = true;
        let threshold = -60;
        let release = 0.05;
        const timer = setInterval(() => {
          tap.getFloatTimeDomainData(block);
          const { rms } = levelDb(block);
          const next = open ? rms > threshold - 4 : rms > threshold;
          if (next !== open) vca.gain.setTargetAtTime(next ? 1 : 0, ctx.currentTime, next ? 0.001 : release);
          open = next;
        }, 10);
        return {
          set: ({ params: p }) => {
            threshold = gatePedalDb(p.threshold);
            release = expMap(p.release, 0.01, 0.3);
          },
          dispose: () => clearInterval(timer),
        };
      });
    case "eq":
      return unit(ctx, (input, output) => {
        const bands = ([["b100", 100], ["b250", 250], ["b500", 500], ["b1k", 1000], ["b2k", 2000], ["b4k", 4000]] as const).map(([key, hz]) => ({ key, f: biquad(ctx, "peaking", hz, 0, 1.1) }));
        const level = ctx.createGain();
        chain(input, ...bands.map((b) => b.f), level, output);
        return {
          set: ({ params: p }) => {
            for (const b of bands) b.f.gain.setTargetAtTime(stackDb(p[b.key]), t(), GLIDE);
            level.gain.setTargetAtTime(dbToGain(stackDb(p.level)), t(), GLIDE);
          },
        };
      });
    case "flanger":
      return unit(ctx, (input, output) => {
        const delay = ctx.createDelay(0.02);
        delay.delayTime.value = 0.003;
        const regen = ctx.createGain();
        const wet = ctx.createGain();
        chain(input, delay, wet, output);
        chain(delay, regen, delay);
        const mod = lfo(ctx, delay.delayTime, 0.002, 0.3);
        return {
          set: ({ params: p }) => {
            mod.osc.frequency.setTargetAtTime(expMap(p.rate, 0.05, 2.5), t(), GLIDE);
            mod.depth.gain.setTargetAtTime(0.0002 + (p.depth / 10) * 0.0026, t(), GLIDE);
            regen.gain.setTargetAtTime((p.feedback / 10) * 0.85, t(), GLIDE);
            wet.gain.setTargetAtTime(p.mix / 10, t(), GLIDE);
          },
          dispose: () => mod.osc.stop(),
        };
      }, 1);
    case "chorus":
      return unit(ctx, (input, output) => {
        const delay = ctx.createDelay(0.05);
        delay.delayTime.value = 0.014;
        const wet = ctx.createGain();
        chain(input, delay, wet, output);
        const mod = lfo(ctx, delay.delayTime, 0.002, 0.8);
        return {
          set: ({ params: p }) => {
            mod.osc.frequency.setTargetAtTime(expMap(p.rate, 0.1, 3.5), t(), GLIDE);
            mod.depth.gain.setTargetAtTime(0.0003 + (p.depth / 10) * 0.004, t(), GLIDE);
            wet.gain.setTargetAtTime(p.mix / 10, t(), GLIDE);
          },
          dispose: () => mod.osc.stop(),
        };
      }, 1);
    case "phaser":
      return unit(ctx, (input, output) => {
        const stages = [0, 1, 2, 3].map(() => biquad(ctx, "allpass", 700, 0, 0.5));
        const wet = ctx.createGain();
        wet.gain.value = 0.5;
        chain(input, ...stages, wet, output);
        const osc = ctx.createOscillator();
        const depths = stages.map((s) => {
          const g = ctx.createGain();
          osc.connect(g).connect(s.frequency);
          return g;
        });
        osc.start();
        return {
          set: ({ params: p }) => {
            osc.frequency.setTargetAtTime(expMap(p.rate, 0.05, 4), t(), GLIDE);
            for (const g of depths) g.gain.setTargetAtTime(100 + (p.depth / 10) * 600, t(), GLIDE);
          },
          dispose: () => osc.stop(),
        };
      }, 0.5);
    case "tremolo":
      return unit(ctx, (input, output) => {
        const vca = ctx.createGain();
        vca.gain.value = 0;
        const offset = ctx.createConstantSource();
        offset.connect(vca.gain);
        offset.start();
        const mod = lfo(ctx, vca.gain, 0.3, 5);
        chain(input, vca, output);
        return {
          set: ({ params: p }) => {
            const depth = p.depth / 20;
            offset.offset.setTargetAtTime(1 - depth, t(), GLIDE);
            mod.depth.gain.setTargetAtTime(depth, t(), GLIDE);
            mod.osc.frequency.setTargetAtTime(expMap(p.rate, 1, 12), t(), GLIDE);
          },
          dispose: () => { mod.osc.stop(); offset.stop(); },
        };
      });
    case "delay":
      return unit(ctx, (input, output) => {
        const a = ctx.createDelay(2.5);
        const b = ctx.createDelay(2.5);
        const feedback = ctx.createGain();
        const tone = biquad(ctx, "lowpass", 2500);
        const wet = ctx.createGain();
        const second = ctx.createGain();
        chain(input, a, tone, feedback, a);
        tone.connect(wet).connect(output);
        input.connect(b).connect(second).connect(wet);
        const wow = lfo(ctx, a.delayTime, 0, 0.4);
        return {
          set: ({ params: p, voice }) => {
            const time = expMap(p.time, 0.04, 1.2);
            a.delayTime.setTargetAtTime(time, t(), 0.08);
            b.delayTime.setTargetAtTime(Math.min(2.4, time * 1.5), t(), 0.08);
            feedback.gain.setTargetAtTime((p.feedback / 10) * 0.85, t(), GLIDE);
            wet.gain.setTargetAtTime(p.mix / 10, t(), GLIDE);
            tone.frequency.setTargetAtTime(voice === "Analog" ? 2500 : voice === "Tape" ? 4200 : 9000, t(), GLIDE);
            wow.depth.gain.setTargetAtTime(voice === "Tape" ? 0.0015 : 0, t(), GLIDE);
            second.gain.setTargetAtTime(voice === "Dual" ? 0.6 : 0, t(), GLIDE);
          },
          dispose: () => wow.osc.stop(),
        };
      }, 1);
    case "reverb":
      return unit(ctx, (input, output) => {
        const conv = ctx.createConvolver();
        const wet = ctx.createGain();
        chain(input, conv, wet, output);
        let key = "";
        let timer: ReturnType<typeof setTimeout> | undefined;
        return {
          set: ({ params: p, voice = "Room" }) => {
            wet.gain.setTargetAtTime((p.mix / 10) * 0.8, t(), GLIDE);
            const next = `${voice}:${p.decay}`;
            if (next === key) return;
            key = next;
            // Rebuilding the impulse is the one expensive edit; wait for the knob to settle.
            clearTimeout(timer);
            timer = setTimeout(() => {
              const seconds = expMap(p.decay, 0.3, 6);
              const [l, r] = reverbImpulse(voice, seconds, ctx.sampleRate);
              const buf = ctx.createBuffer(2, l.length, ctx.sampleRate);
              buf.copyToChannel(l, 0);
              buf.copyToChannel(r, 1);
              conv.buffer = buf;
            }, 120);
          },
          dispose: () => clearTimeout(timer),
        };
      }, 1);
  }
}

export type Levels = { input: { rms: number; peak: number }; output: { rms: number; peak: number }; gateOpen: boolean };

export class StudioAudio {
  readonly ctx: AudioContext;
  private input: GainNode;
  private inputTap: AnalyserNode;
  private gate: GainNode;
  private preHead: GainNode;
  private ampIn: GainNode;
  private amp: {
    tight: BiquadFilterNode; bright: BiquadFilterNode; push: BiquadFilterNode; s1: WaveShaperNode; inter: BiquadFilterNode;
    s2: WaveShaperNode; fizz: BiquadFilterNode; bass: BiquadFilterNode; mid: BiquadFilterNode; treble: BiquadFilterNode;
    presence: BiquadFilterNode; depth: BiquadFilterNode; master: GainNode;
  };
  private cab: {
    hp: BiquadFilterNode; thump: BiquadFilterNode; mid: BiquadFilterNode; speakerPeak: BiquadFilterNode; speakerLow: BiquadFilterNode;
    lp: BiquadFilterNode; proximity: BiquadFilterNode; presence: BiquadFilterNode; filterOut: GainNode; ir: ConvolverNode; irOut: GainNode;
  };
  private impulse: AudioBuffer | null = null;
  private cabOn = true;
  private postHead: GainNode;
  private output: GainNode;
  private outputTap: AnalyserNode;
  private units = new Map<string, { unit: Unit; type: string }>();
  private order = "";
  private source: AudioScheduledSourceNode | MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private gateTimer: ReturnType<typeof setInterval>;
  private gateOpen = true;
  private gateSettings = { on: false, threshold: -70 };
  private shaperKey = "";
  private block = new Float32Array(1024);

  constructor() {
    const ctx = (this.ctx = new AudioContext({ latencyHint: "interactive" }));
    this.input = ctx.createGain();
    this.inputTap = ctx.createAnalyser();
    this.inputTap.fftSize = 1024;
    this.gate = ctx.createGain();
    this.preHead = ctx.createGain();
    this.ampIn = ctx.createGain();
    const s1 = ctx.createWaveShaper();
    const s2 = ctx.createWaveShaper();
    s1.oversample = s2.oversample = "4x";
    this.amp = {
      tight: biquad(ctx, "highpass", 40), bright: biquad(ctx, "highshelf", 2500), push: biquad(ctx, "peaking", 800, 0, 0.9), s1,
      inter: biquad(ctx, "highpass", 70), s2, fizz: biquad(ctx, "lowpass", 7500),
      bass: biquad(ctx, "lowshelf", 110), mid: biquad(ctx, "peaking", 750, 0, 0.8), treble: biquad(ctx, "highshelf", 3200),
      presence: biquad(ctx, "highshelf", 5200), depth: biquad(ctx, "lowshelf", 90), master: ctx.createGain(),
    };
    this.cab = {
      hp: biquad(ctx, "highpass", 75), thump: biquad(ctx, "peaking", 110, 0, 1.2), mid: biquad(ctx, "peaking", 2500, 0, 1),
      speakerPeak: biquad(ctx, "peaking", 2000, 0, 1.1), speakerLow: biquad(ctx, "lowshelf", 120),
      lp: biquad(ctx, "lowpass", 5500, 0, 0.9), proximity: biquad(ctx, "lowshelf", 150), presence: biquad(ctx, "peaking", 3200, 0, 1.4),
      filterOut: ctx.createGain(), ir: ctx.createConvolver(), irOut: ctx.createGain(),
    };
    this.cab.irOut.gain.value = 0;
    this.postHead = ctx.createGain();
    this.output = ctx.createGain();
    // Last line of defence for ears and speakers: a fast limiter just under full scale.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    this.outputTap = ctx.createAnalyser();
    this.outputTap.fftSize = 1024;

    this.input.connect(this.inputTap);
    chain(this.input, this.gate, this.preHead);
    const a = this.amp;
    chain(this.ampIn, a.tight, a.bright, a.push, a.s1, a.inter, a.s2, a.fizz, a.bass, a.mid, a.treble, a.presence, a.depth, a.master);
    const c = this.cab;
    // Two cabinets in parallel, one silent: the filter model, and the convolver for a loaded impulse response.
    chain(a.master, c.hp, c.thump, c.mid, c.speakerPeak, c.speakerLow, c.lp, c.proximity, c.presence, c.filterOut, this.postHead);
    chain(a.master, c.ir, c.irOut, this.postHead);
    chain(this.output, limiter, this.outputTap, ctx.destination);
    this.preHead.connect(this.ampIn);
    this.postHead.connect(this.output);

    // The gate listens to the input level every 10 ms, with 4 dB of hysteresis so it doesn't chatter.
    this.gateTimer = setInterval(() => this.runGate(), 10);
  }

  private runGate() {
    if (!this.gateSettings.on) {
      if (!this.gateOpen) this.gate.gain.setTargetAtTime(1, this.ctx.currentTime, 0.002);
      this.gateOpen = true;
      return;
    }
    this.inputTap.getFloatTimeDomainData(this.block);
    const { rms } = levelDb(this.block);
    const open = this.gateOpen ? rms > this.gateSettings.threshold - 4 : rms > this.gateSettings.threshold;
    if (open !== this.gateOpen) this.gate.gain.setTargetAtTime(open ? 1 : 0, this.ctx.currentTime, open ? 0.001 : 0.04);
    this.gateOpen = open;
  }

  /** Brings every node in line with the patch; rewires only when effects are added, removed or reordered. */
  apply(p: StudioPatch) {
    const t = this.ctx.currentTime;
    const set = (param: AudioParam, v: number) => param.setTargetAtTime(v, t, GLIDE);
    set(this.input.gain, dbToGain(p.input));
    set(this.output.gain, dbToGain(p.output));
    this.gateSettings = { on: p.gate.on, threshold: p.gate.threshold };

    const v = VOICINGS[p.amp.model];
    const a = this.amp;
    const [d1, d2] = stageDrives(v, p.amp.gain);
    const key = `${p.amp.model}:${d1.toFixed(3)}`;
    if (key !== this.shaperKey) {
      a.s1.curve = shaperCurve(v.stage1, d1);
      a.s2.curve = shaperCurve(v.stage2, d2, v.rectify);
      this.shaperKey = key;
    }
    set(a.tight.frequency, p.amp.tight ? v.tightHz : 40);
    set(a.inter.frequency, p.amp.tight ? v.tightHz : v.interstageHz);
    set(a.bright.gain, p.amp.bright ? 6 : 0);
    set(a.push.frequency, v.midHz);
    set(a.push.gain, v.midDb);
    set(a.fizz.frequency, v.lowpassHz);
    set(a.bass.gain, stackDb(p.amp.bass));
    set(a.mid.frequency, v.stackMidHz);
    set(a.mid.gain, stackDb(p.amp.mid));
    set(a.treble.gain, stackDb(p.amp.treble));
    set(a.presence.gain, v.cutControl ? -stackDb(p.amp.presence, 9) : stackDb(p.amp.presence, 9));
    set(a.depth.gain, stackDb(p.amp.depth, 9));
    // Waveshapers output near full scale at any gain; −10 dB leaves headroom for the cab's resonances and the effects.
    set(a.master.gain, dbToGain(masterDb(p.amp.master) - 10));

    const cv = CAB_VOICINGS[p.cab.model];
    const sv = SPEAKER_VOICINGS[p.cab.speaker];
    const mic = micFilters(p.cab.micPosition, p.cab.micDistance, p.cab.mic);
    const c = this.cab;
    const on = p.cab.on;
    set(c.hp.frequency, on ? cv.highpassHz : 10);
    set(c.thump.gain, on ? cv.thumpDb : 0);
    set(c.mid.frequency, cv.midHz);
    set(c.mid.gain, on ? cv.midDb : 0);
    set(c.speakerPeak.frequency, sv.peakHz);
    set(c.speakerPeak.gain, on ? sv.peakDb : 0);
    set(c.speakerLow.gain, on ? sv.lowDb : 0);
    set(c.lp.frequency, on ? Math.min(20000, cv.lowpassHz * sv.lowpassScale * mic.lowpassScale) : 20000);
    set(c.proximity.gain, on ? mic.proximityDb : 0);
    set(c.presence.gain, on ? mic.presenceDb : 0);
    this.cabOn = on;
    this.routeCab();

    this.applyEffects(p.effects);
  }

  private applyEffects(effects: Effect[]) {
    const ids = new Set(effects.map((e) => e.id));
    for (const [id, u] of this.units) {
      if (!ids.has(id)) {
        u.unit.dispose();
        this.units.delete(id);
      }
    }
    for (const e of effects) {
      const existing = this.units.get(e.id);
      if (!existing || existing.type !== e.type) {
        existing?.unit.dispose();
        this.units.set(e.id, { unit: buildEffect(this.ctx, e), type: e.type });
      }
      this.units.get(e.id)!.unit.set(e);
    }
    const order = effects.map((e) => `${e.id}:${e.type}:${e.placement}`).join("|");
    if (order === this.order) return;
    this.order = order;
    // Rewire: pre-amp effects between the gate and the amp, the rest after the cabinet.
    this.preHead.disconnect();
    this.postHead.disconnect();
    for (const { unit } of this.units.values()) unit.output.disconnect();
    const pre = effects.filter((e) => e.placement === "pre").map((e) => this.units.get(e.id)!.unit);
    const post = effects.filter((e) => e.placement !== "pre").map((e) => this.units.get(e.id)!.unit);
    let node: AudioNode = this.preHead;
    for (const u of pre) { node.connect(u.input); node = u.output; }
    node.connect(this.ampIn);
    node = this.postHead;
    for (const u of post) { node.connect(u.input); node = u.output; }
    node.connect(this.output);
  }

  /**
   * A cabinet impulse response (a WAV of a real or imagined speaker and mic)
   * replaces the filter cabinet while the cabinet is on; null goes back to
   * the filters. Normalized to unit energy so loading one doesn't jump in level.
   */
  setImpulse(ir: AudioBuffer | null) {
    if (ir) {
      let energy = 0;
      for (let ch = 0; ch < ir.numberOfChannels; ch++) for (const v of ir.getChannelData(ch)) energy += v * v;
      const scale = 1 / Math.sqrt(energy / ir.numberOfChannels || 1);
      const copy = this.ctx.createBuffer(ir.numberOfChannels, ir.length, ir.sampleRate);
      for (let ch = 0; ch < ir.numberOfChannels; ch++) copy.copyToChannel(ir.getChannelData(ch).map((v) => v * scale), ch);
      this.cab.ir.normalize = false;
      this.cab.ir.buffer = copy;
    }
    this.impulse = ir;
    this.routeCab();
  }

  private routeCab() {
    const useIr = this.cabOn && this.impulse !== null;
    const t = this.ctx.currentTime;
    this.cab.filterOut.gain.setTargetAtTime(useIr ? 0 : 1, t, GLIDE);
    this.cab.irOut.gain.setTargetAtTime(useIr ? 1 : 0, t, GLIDE);
  }

  async play(buffer: AudioBuffer) {
    this.stopSource();
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(this.input);
    src.start();
    this.source = src;
    await this.ctx.resume();
  }

  /** Live input from an audio interface or mic. Browser processing is off: it would colour the guitar. */
  async listen(deviceId?: string) {
    this.stopSource();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { ...(deviceId && { deviceId: { exact: deviceId } }), echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const src = this.ctx.createMediaStreamSource(stream);
    src.connect(this.input);
    this.source = src;
    this.stream = stream;
    await this.ctx.resume();
  }

  stopSource() {
    if (this.source && "stop" in this.source) this.source.stop();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((tr) => tr.stop());
    this.source = null;
    this.stream = null;
  }

  get playing() {
    return this.source !== null;
  }

  /** Round-trip estimate for live playing: what the browser reports for input plus output. */
  get latencyMs() {
    return Math.round(((this.ctx.baseLatency ?? 0) + (this.ctx.outputLatency ?? 0)) * 1000);
  }

  levels(): Levels {
    this.inputTap.getFloatTimeDomainData(this.block);
    const input = levelDb(this.block);
    this.outputTap.getFloatTimeDomainData(this.block);
    return { input, output: levelDb(this.block), gateOpen: this.gateOpen };
  }

  async dispose() {
    clearInterval(this.gateTimer);
    this.stopSource();
    for (const { unit } of this.units.values()) unit.dispose();
    this.units.clear();
    await this.ctx.close();
  }
}
