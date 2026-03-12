export class AudioSystem {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  bgmOsc: OscillatorNode | null = null;
  bgmGain: GainNode | null = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  playSfx(type: string) {
    if (!this.ctx || !this.masterGain) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.connect(g);
    g.connect(this.masterGain);
    const n = this.ctx.currentTime;

    switch (type) {
      case 'shoot':
        o.type = 'square';
        o.frequency.setValueAtTime(150, n);
        o.frequency.exponentialRampToValueAtTime(40, n + 0.1);
        g.gain.setValueAtTime(0.1, n);
        g.gain.exponentialRampToValueAtTime(0.01, n + 0.1);
        o.start(n); o.stop(n + 0.1);
        break;
      case 'jump':
        o.type = 'sine';
        o.frequency.setValueAtTime(200, n);
        o.frequency.linearRampToValueAtTime(400, n + 0.15);
        g.gain.setValueAtTime(0.2, n);
        g.gain.linearRampToValueAtTime(0.01, n + 0.15);
        o.start(n); o.stop(n + 0.15);
        break;
      case 'dash':
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(300, n);
        o.frequency.exponentialRampToValueAtTime(50, n + 0.2);
        g.gain.setValueAtTime(0.15, n);
        g.gain.exponentialRampToValueAtTime(0.01, n + 0.2);
        o.start(n); o.stop(n + 0.2);
        break;
      case 'coin':
        o.type = 'sine';
        o.frequency.setValueAtTime(800, n);
        o.frequency.setValueAtTime(1200, n + 0.05);
        g.gain.setValueAtTime(0.1, n);
        g.gain.linearRampToValueAtTime(0.01, n + 0.2);
        o.start(n); o.stop(n + 0.2);
        break;
      case 'hit':
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(100, n);
        o.frequency.exponentialRampToValueAtTime(10, n + 0.2);
        g.gain.setValueAtTime(0.2, n);
        g.gain.exponentialRampToValueAtTime(0.01, n + 0.2);
        o.start(n); o.stop(n + 0.2);
        break;
      case 'buy':
        o.type = 'square';
        o.frequency.setValueAtTime(400, n);
        o.frequency.setValueAtTime(800, n + 0.1);
        o.frequency.setValueAtTime(1200, n + 0.2);
        g.gain.setValueAtTime(0.1, n);
        g.gain.linearRampToValueAtTime(0.01, n + 0.3);
        o.start(n); o.stop(n + 0.3);
        break;
      case 'explosion':
        o.type = 'square';
        o.frequency.setValueAtTime(100, n);
        o.frequency.exponentialRampToValueAtTime(10, n + 0.5);
        g.gain.setValueAtTime(0.3, n);
        g.gain.exponentialRampToValueAtTime(0.01, n + 0.5);
        
        // Add noise
        const bufferSize = this.ctx.sampleRate * 0.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = 1000;
        noise.connect(noiseFilter);
        noiseFilter.connect(g);
        noise.start(n);
        o.start(n); o.stop(n + 0.5);
        break;
    }
  }

  startBgm() {
    if (!this.ctx || !this.masterGain) return;
    if (this.bgmOsc) this.stopBgm();

    this.bgmOsc = this.ctx.createOscillator();
    this.bgmGain = this.ctx.createGain();
    
    this.bgmOsc.type = 'sawtooth';
    this.bgmOsc.frequency.value = 55; // Low A
    
    this.bgmGain.gain.value = 0.05;
    
    // Simple LFO for pulsing bass
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 4; // 4Hz pulse
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain);
    lfoGain.connect(this.bgmGain.gain);
    lfo.start();

    this.bgmOsc.connect(this.bgmGain);
    this.bgmGain.connect(this.masterGain);
    this.bgmOsc.start();
  }

  stopBgm() {
    if (this.bgmOsc) {
      this.bgmOsc.stop();
      this.bgmOsc.disconnect();
      this.bgmOsc = null;
    }
    if (this.bgmGain) {
      this.bgmGain.disconnect();
      this.bgmGain = null;
    }
  }
}

export const audio = new AudioSystem();
