// Drift Zen Aura - Built-in offline Web Audio ambient sound synthesizer.
// 100% offline, pure Web Audio API math, 0 external network requests or audio files.

let ctx: AudioContext | null = null;
let currentSource: AudioNode | null = null;
let gainNode: GainNode | null = null;

function getContext(): AudioContext {
  if (!ctx || ctx.state === 'closed') {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AudioCtx();
  }
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

export function stopAmbientSound() {
  if (gainNode && ctx) {
    gainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    setTimeout(() => {
      try {
        if (currentSource) {
          (currentSource as unknown as { stop?: () => void }).stop?.();
          currentSource.disconnect();
          currentSource = null;
        }
      } catch {}
    }, 250);
  }
}

export function playAmbientSound(type: 'rain' | 'ocean' | 'drone' | 'whitenoise' | 'binaural', volume = 0.5) {
  stopAmbientSound();
  const c = getContext();

  gainNode = c.createGain();
  gainNode.gain.setValueAtTime(0.01, c.currentTime);
  gainNode.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), c.currentTime + 0.3);
  gainNode.connect(c.destination);

  const bufferSize = 2 * c.sampleRate;

  if (type === 'rain' || type === 'ocean' || type === 'whitenoise') {
    // Generate noise buffer
    const noiseBuffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'whitenoise') {
        output[i] = white * 0.15;
      } else if (type === 'rain') {
        // Pink noise approximation
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
        b6 = white * 0.115926;
      } else {
        // Brown noise / ocean
        b0 = (b0 + (0.02 * white)) / 1.02;
        output[i] = b0 * 0.3;
      }
    }

    const whiteNoise = c.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Filter
    const filter = c.createBiquadFilter();
    if (type === 'rain') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, c.currentTime);
    } else if (type === 'ocean') {
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, c.currentTime);
      // Gentle ocean swell LFO
      const lfo = c.createOscillator();
      const lfoGain = c.createGain();
      lfo.frequency.setValueAtTime(0.12, c.currentTime);
      lfoGain.gain.setValueAtTime(300, c.currentTime);
      lfo.connect(filter.frequency);
      lfo.start();
    } else {
      filter.type = 'allpass';
    }

    whiteNoise.connect(filter);
    filter.connect(gainNode);
    whiteNoise.start();
    currentSource = whiteNoise;
  } else if (type === 'binaural') {
    // 200 Hz Left, 210 Hz Right (10 Hz Alpha wave focus)
    const merger = c.createChannelMerger(2);
    const oscL = c.createOscillator();
    const oscR = c.createOscillator();
    oscL.type = 'sine';
    oscR.type = 'sine';
    oscL.frequency.setValueAtTime(200, c.currentTime);
    oscR.frequency.setValueAtTime(210, c.currentTime);

    const gainL = c.createGain();
    const gainR = c.createGain();
    gainL.gain.setValueAtTime(0.2, c.currentTime);
    gainR.gain.setValueAtTime(0.2, c.currentTime);

    oscL.connect(gainL);
    gainL.connect(merger, 0, 0);
    oscR.connect(gainR);
    gainR.connect(merger, 0, 1);

    merger.connect(gainNode);
    oscL.start();
    oscR.start();
    currentSource = oscL;
  } else if (type === 'drone') {
    // Cosmic ambient resonant drone
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(110, c.currentTime); // A2
    osc2.frequency.setValueAtTime(110.5, c.currentTime); // subtle beating

    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, c.currentTime);
    filter.Q.setValueAtTime(4, c.currentTime);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    osc1.start();
    osc2.start();
    currentSource = osc1;
  }
}

export function setAmbientVolume(volume: number) {
  if (gainNode && ctx) {
    gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime);
  }
}

