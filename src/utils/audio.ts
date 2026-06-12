/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioManager {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private musicVolume: number = 0.5;
  private sfxVolume: number = 0.5;
  private bgmInterval: any = null;
  private bgmStep: number = 0;
  private bgmPlaying: 'none' | 'game' | 'menu' | 'chapter3' = 'none';

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted() {
    return this.muted;
  }

  setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
  }

  getMusicVolume() {
    return this.musicVolume;
  }

  setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
  }

  getSfxVolume() {
    return this.sfxVolume;
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.1, slideToFreq?: number, isBgm: boolean = false) {
    try {
      this.init();
      if (!this.ctx || this.muted) return;

      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      
      if (slideToFreq) {
        osc.frequency.exponentialRampToValueAtTime(slideToFreq, this.ctx.currentTime + duration);
      }

      // Apply the separate volume variables
      const calculatedVol = volume * (isBgm ? this.musicVolume : this.sfxVolume);
      gainNode.gain.setValueAtTime(calculatedVol, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }

  playSuccess() {
    // Elegant bright arpeggio
    this.playTone(392, 'square', 0.1, 0.1, 523); // G4 to C5
    setTimeout(() => {
      this.playTone(523, 'square', 0.1, 0.1, 784); // C5 to G5
    }, 100);
    setTimeout(() => {
      this.playTone(784, 'triangle', 0.3, 0.15, 1047); // G5 to C6
    }, 200);
  }

  playFail() {
    // Sliding down sad tone
    this.playTone(330, 'sawtooth', 0.5, 0.12, 110); // E4 to A2
  }

  playCrash() {
    // Noise/Low frequency distortion
    this.playTone(180, 'sawtooth', 0.3, 0.2, 40);
    setTimeout(() => {
      this.playTone(100, 'triangle', 0.2, 0.15, 20);
    }, 50);
  }

  playSlow() {
    this.playTone(150, 'sine', 0.6, 0.1, 80);
  }

  playRobbed() {
    // Spooky fast down-glide
    this.playTone(400, 'sawtooth', 0.35, 0.15, 150);
    setTimeout(() => {
      this.playTone(300, 'sawtooth', 0.35, 0.15, 80);
    }, 80);
  }

  playUpgrade() {
    // Retro chime
    this.playTone(523, 'sine', 0.12, 0.1, 659);
    setTimeout(() => {
      this.playTone(659, 'sine', 0.12, 0.1, 880);
    }, 100);
    setTimeout(() => {
      this.playTone(880, 'triangle', 0.25, 0.1, 1318);
    }, 200);
  }

  playCasinoCoin() {
    this.playTone(987, 'sine', 0.08, 0.08, 1318);
  }

  playCasinoWin() {
    this.playTone(523, 'square', 0.1, 0.15, 784);
    setTimeout(() => {
      this.playTone(659, 'square', 0.1, 0.15, 987);
    }, 80);
    setTimeout(() => {
      this.playTone(784, 'square', 0.12, 0.15, 1174);
    }, 160);
    setTimeout(() => {
      this.playTone(1047, 'square', 0.4, 0.2, 1568);
    }, 240);
  }

  playCasinoLose() {
    this.playTone(220, 'triangle', 0.5, 0.15, 110);
  }

  playAlert() {
    this.playTone(587, 'triangle', 0.15, 0.1);
    setTimeout(() => {
      this.playTone(587, 'triangle', 0.15, 0.1);
    }, 150);
  }

  playRentPay() {
    this.playTone(440, 'sine', 0.15, 0.1, 880);
    setTimeout(() => {
      this.playTone(880, 'sine', 0.3, 0.1, 1320);
    }, 150);
  }

  playEngine(speedRatio: number) {
    if (Math.random() < 0.15 && speedRatio > 0.1) {
      const freq = 60 + speedRatio * 110;
      this.playTone(freq, 'triangle', 0.04, 0.015);
    }
  }

  startBGM() {
    this.init();
    if (this.bgmPlaying === 'game') return;
    this.stopBGM();
    this.bgmPlaying = 'game';
    this.bgmStep = 0;

    const melody = [
      659.25, 0, 783.99, 880.00, 0, 783.99, 659.25, 523.25,
      587.33, 0, 587.33, 659.25, 0, 587.33, 523.25, 440.00,
      523.25, 0, 659.25, 698.46, 0, 698.46, 783.99, 880.00,
      783.99, 0, 659.25, 587.33, 0, 493.88, 523.25, 0
    ];

    const bass = [
      130.81, 196.00, 130.81, 196.00, 130.81, 196.00, 130.81, 196.00,
      98.00, 146.83, 98.00, 146.83, 98.00, 146.83, 98.00, 146.83,
      87.31, 130.81, 87.31, 130.81, 87.31, 130.81, 87.31, 130.81,
      98.00, 146.83, 98.00, 146.83, 130.81, 196.00, 130.81, 0
    ];

    const stepTime = 160;

    this.bgmInterval = setInterval(() => {
      if (this.muted || !this.ctx || this.ctx.state === 'suspended') {
        this.bgmStep = (this.bgmStep + 1) % melody.length;
        return;
      }

      const note = melody[this.bgmStep];
      const bassNote = bass[this.bgmStep];

      if (note > 0) {
        this.playTone(note, 'sine', stepTime / 1000 * 0.8, 0.015, undefined, true);
      }

      if (bassNote > 0 && this.bgmStep % 2 === 0) {
        this.playTone(bassNote, 'triangle', stepTime / 1000 * 1.4, 0.012, undefined, true);
      }

      this.bgmStep = (this.bgmStep + 1) % melody.length;
    }, stepTime);
  }

  startMenuBGM() {
    this.init();
    if (this.bgmPlaying === 'menu') return;
    this.stopBGM();
    this.bgmPlaying = 'menu';
    this.bgmStep = 0;

    // A rising, hopeful progress progression (C -> G -> Am -> F chords with inspiring feel)
    // We can have 32 steps of inspiring chords and arpeggiator
    const chords = [
      [261.63, 329.63, 392.00, 523.25], // C Major
      [196.00, 293.66, 392.00, 493.88], // G Major
      [220.00, 261.63, 329.63, 440.00], // A Minor
      [174.61, 220.00, 261.63, 349.23], // F Major
    ];

    const bassNotes = [130.81, 98.00, 110.00, 87.31]; // C2, G1, A1, F1

    const stepTime = 200; // slightly slower, very epic tempo
    this.bgmInterval = setInterval(() => {
      if (this.muted || !this.ctx || this.ctx.state === 'suspended') {
        this.bgmStep = (this.bgmStep + 1) % 16;
        return;
      }

      const chordIdx = Math.floor(this.bgmStep / 4) % chords.length;
      const stepInChord = this.bgmStep % 4;
      const currentChord = chords[chordIdx];

      // Arpeggiator note
      const note = currentChord[stepInChord];
      
      // Play ascending sparkling arpeggio notes
      this.playTone(note, 'sine', stepTime / 1000 * 1.5, 0.018, undefined, true);

      // Warm bass cushion on the first step of each chord transition
      if (stepInChord === 0) {
        this.playTone(bassNotes[chordIdx], 'triangle', stepTime / 1000 * 3.5, 0.022, undefined, true);
      }

      this.bgmStep = (this.bgmStep + 1) % 16;
    }, stepTime);
  }

  startChapter3BGM() {
    this.init();
    if (this.bgmPlaying === 'chapter3') return;
    this.stopBGM();
    this.bgmPlaying = 'chapter3';
    this.bgmStep = 0;

    // A futuristic, epic corporate-dominance arpeggiated expansion theme
    const melody = [
      440.00, 523.25, 659.25, 523.25, 493.88, 587.33, 739.99, 587.33,
      349.23, 440.00, 523.25, 440.00, 392.00, 493.88, 587.33, 493.88
    ];
    const bass = [
      110.00, 0, 110.00, 0, 123.47, 0, 123.47, 0,
      87.31, 0, 87.31, 0, 98.00, 0, 98.00, 0
    ];

    const stepTime = 140;
    this.bgmInterval = setInterval(() => {
      if (this.muted || !this.ctx || this.ctx.state === 'suspended') {
        this.bgmStep = (this.bgmStep + 1) % melody.length;
        return;
      }

      const note = melody[this.bgmStep];
      const bassNote = bass[this.bgmStep];

      if (note > 0) {
        this.playTone(note, 'sine', stepTime / 1000 * 0.95, 0.015, undefined, true);
      }
      if (bassNote > 0) {
         this.playTone(bassNote, 'triangle', stepTime / 1000 * 1.5, 0.022, undefined, true);
      }

      this.bgmStep = (this.bgmStep + 1) % melody.length;
    }, stepTime);
  }

  stopBGM() {
    this.bgmPlaying = 'none';
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const audio = new AudioManager();
