// All sound is synthesised live with WebAudio — no audio files, no network. A tiny
// synth voice for effects (gunshot, pickup, siren, engine) and a slow sunset-funk loop
// (bass + chords + hats) scheduled a bar ahead. Everything is a no-op until the first
// user gesture creates the AudioContext, so the screenshot scenes stay silent.

const MUSIC_BPM = 96;
const BAR_SECONDS = (60 / MUSIC_BPM) * 4;
/** A-minor sunset progression, one chord a bar: Am — F — C — G. */
const CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [48, 55, 60],
  [55, 59, 62],
];
const BASS = [45, 41, 48, 43];

export function createAudio() {
  let context = null;
  let master = null;
  let musicTimer = null;
  let nextBarTime = 0;
  let barIndex = 0;
  let sirenNodes = null;
  let engineNodes = null;

  function ensure() {
    if (context) return true;
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  function tone({ freq, endFreq, type, duration, volume, when = 0 }) {
    if (!context) return;
    const t0 = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  function noise({ duration, volume, lowpass, when = 0 }) {
    if (!context) return;
    const t0 = context.currentTime + when;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    let node = source;
    if (lowpass) {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      source.connect(filter);
      node = filter;
    }
    node.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  function scheduleBar(index, t0) {
    const chord = CHORDS[index % CHORDS.length];
    const bassNote = BASS[index % BASS.length];
    const beat = BAR_SECONDS / 4;
    for (let b = 0; b < 4; b += 1) {
      tone({ freq: midi(bassNote), type: 'triangle', duration: beat * 0.9, volume: 0.32, when: t0 - context.currentTime + b * beat });
      if (b % 2 === 0) {
        for (const note of chord) {
          tone({ freq: midi(note), type: 'sawtooth', duration: beat * 1.6, volume: 0.05, when: t0 - context.currentTime + b * beat });
        }
      }
      noise({ duration: 0.04, volume: b % 2 === 1 ? 0.09 : 0.04, when: t0 - context.currentTime + b * beat });
    }
  }

  function midi(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  return {
    /** Call from any user gesture; starts the music loop. */
    unlock() {
      if (!ensure()) return;
      if (context.state === 'suspended') void context.resume();
      if (musicTimer) return;
      nextBarTime = context.currentTime + 0.1;
      barIndex = 0;
      musicTimer = window.setInterval(() => {
        if (!context) return;
        while (nextBarTime < context.currentTime + 0.35) {
          scheduleBar(barIndex, nextBarTime);
          nextBarTime += BAR_SECONDS;
          barIndex += 1;
        }
      }, 120);
    },
    shoot() {
      if (!ensure()) return;
      noise({ duration: 0.12, volume: 0.5, lowpass: 2400 });
      tone({ freq: 220, endFreq: 70, type: 'square', duration: 0.08, volume: 0.18 });
    },
    hit() {
      if (!ensure()) return;
      tone({ freq: 180, endFreq: 90, type: 'sawtooth', duration: 0.12, volume: 0.22 });
    },
    pickup() {
      if (!ensure()) return;
      tone({ freq: 660, type: 'sine', duration: 0.09, volume: 0.3 });
      tone({ freq: 990, type: 'sine', duration: 0.14, volume: 0.3, when: 0.08 });
    },
    crash() {
      if (!ensure()) return;
      noise({ duration: 0.25, volume: 0.45, lowpass: 900 });
    },
    horn() {
      if (!ensure()) return;
      tone({ freq: 370, type: 'square', duration: 0.22, volume: 0.12 });
      tone({ freq: 466, type: 'square', duration: 0.22, volume: 0.12 });
    },
    missionDone() {
      if (!ensure()) return;
      [523, 659, 784, 1047].forEach((freq, i) => tone({ freq, type: 'sine', duration: 0.18, volume: 0.28, when: i * 0.09 }));
    },
    busted() {
      if (!ensure()) return;
      [392, 330, 262].forEach((freq, i) => tone({ freq, type: 'triangle', duration: 0.3, volume: 0.3, when: i * 0.22 }));
    },
    siren(on) {
      if (!ensure()) return;
      if (on && !sirenNodes) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        const lfo = context.createOscillator();
        const lfoGain = context.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 750;
        lfo.type = 'square';
        lfo.frequency.value = 0.9;
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        gain.gain.value = 0.05;
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        lfo.start();
        sirenNodes = { osc, lfo, gain };
      } else if (!on && sirenNodes) {
        try { sirenNodes.osc.stop(); sirenNodes.lfo.stop(); } catch { /* already stopped */ }
        sirenNodes = null;
      }
    },
    /** Engine hum whose pitch follows speed; call every frame while driving. */
    engine(speed01, on) {
      if (!ensure()) return;
      if (!on) {
        if (engineNodes) {
          try { engineNodes.osc.stop(); } catch { /* already stopped */ }
          engineNodes = null;
        }
        return;
      }
      if (!engineNodes) {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'sawtooth';
        gain.gain.value = 0.04;
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 700;
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        osc.start();
        engineNodes = { osc, gain };
      }
      engineNodes.osc.frequency.value = 55 + speed01 * 130;
      engineNodes.gain.gain.value = 0.03 + speed01 * 0.05;
    },
  };
}
