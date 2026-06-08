/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

class AudioManager {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private bgmInterval: any = null;
  private bgmStep: number = 0;
  private bgmPlaying: boolean = false;

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

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.1, slideToFreq?: number) {
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

      gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

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
    // We can play a tiny quick tick to simulate motor sound, but avoid over-playing details
    if (Math.random() < 0.15 && speedRatio > 0.1) {
      const freq = 60 + speedRatio * 110;
      this.playTone(freq, 'triangle', 0.04, 0.015);
    }
  }

  startBGM() {
    this.init();
    if (this.bgmPlaying) return;
    this.bgmPlaying = true;
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

    const stepTime = 160; // Upbeat and quick 160ms steps

    this.bgmInterval = setInterval(() => {
      if (this.muted || !this.ctx || this.ctx.state === 'suspended') {
        this.bgmStep = (this.bgmStep + 1) % melody.length;
        return;
      }

      const note = melody[this.bgmStep];
      const bassNote = bass[this.bgmStep];

      // Play soft melody note (sine style chiptune)
      if (note > 0) {
        this.playTone(note, 'sine', stepTime / 1000 * 0.8, 0.015);
      }

      // Play alternating soft retro bassline (warm triangle)
      if (bassNote > 0 && this.bgmStep % 2 === 0) {
        this.playTone(bassNote, 'triangle', stepTime / 1000 * 1.4, 0.012);
      }

      this.bgmStep = (this.bgmStep + 1) % melody.length;
    }, stepTime);
  }

  stopBGM() {
    this.bgmPlaying = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const audio = new AudioManager();
