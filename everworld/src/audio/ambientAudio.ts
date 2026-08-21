// Fully synthesized ambience for the intro cinematic — gentle wind plus a
// soft, slow-moving pad chord. No audio files: everything here is
// generated at runtime with the Web Audio API, so there's nothing to
// license, bundle, or fetch.
//
// Browsers block audio from starting without a user gesture, so this must
// only ever be called from inside a click/tap handler (see IntroScene's
// "Begin" button) — never on mount.
export interface AmbientAudioHandle {
  setMuted(muted: boolean): void;
  stop(fadeSeconds?: number): void;
}

const PAD_CHORD_HZ = [146.83, 220.0, 293.66, 369.99]; // D3, A3, D4, F#4 — soft, open

export function startAmbientAudio(): AmbientAudioHandle {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.55, now + 2.5); // fade the whole mix in
  master.connect(ctx.destination);

  // ---- Wind: filtered noise, slowly "gusting" ----------------------------
  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  noise.loop = true;

  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 700;
  windFilter.Q.value = 0.7;

  const windGain = ctx.createGain();
  windGain.gain.value = 0.35;

  // A slow LFO gently sweeps the filter's cutoff and the wind's volume so
  // it "gusts" rather than sitting as a flat hiss.
  const windLfo = ctx.createOscillator();
  windLfo.frequency.value = 0.06;
  const windLfoDepth = ctx.createGain();
  windLfoDepth.gain.value = 260;
  windLfo.connect(windLfoDepth);
  windLfoDepth.connect(windFilter.frequency);

  const windVolLfo = ctx.createOscillator();
  windVolLfo.frequency.value = 0.045;
  const windVolDepth = ctx.createGain();
  windVolDepth.gain.value = 0.12;
  windVolLfo.connect(windVolDepth);
  windVolDepth.connect(windGain.gain);

  noise.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(master);

  // ---- Soft pad chord ------------------------------------------------------
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 1400;
  padFilter.connect(master);

  const padOscillators: OscillatorNode[] = [];
  PAD_CHORD_HZ.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0.16;

    // Slight per-voice shimmer, out of phase with the others, so the chord
    // breathes instead of sitting perfectly static.
    const shimmer = ctx.createOscillator();
    shimmer.frequency.value = 0.05 + i * 0.013;
    const shimmerDepth = ctx.createGain();
    shimmerDepth.gain.value = 0.05;
    shimmer.connect(shimmerDepth);
    shimmerDepth.connect(voiceGain.gain);

    osc.connect(voiceGain);
    voiceGain.connect(padFilter);

    osc.start(now);
    shimmer.start(now);
    padOscillators.push(osc, shimmer);
  });

  noise.start(now);
  windLfo.start(now);
  windVolLfo.start(now);

  let stopped = false;

  return {
    setMuted(muted: boolean) {
      if (stopped) return;
      master.gain.linearRampToValueAtTime(muted ? 0 : 0.55, ctx.currentTime + 0.4);
    },
    stop(fadeSeconds = 1.2) {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0, t + fadeSeconds);
      window.setTimeout(() => {
        [noise, windLfo, windVolLfo, ...padOscillators].forEach((node) => {
          try {
            node.stop();
          } catch {
            // already stopped — fine
          }
        });
        ctx.close().catch(() => {});
      }, fadeSeconds * 1000 + 100);
    },
  };
}
