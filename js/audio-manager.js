// ===== GLOBAL AUDIO MANAGER =====
const AudioManager = {
  audioInstances: new Map(),
  isEnabled: true,

  getAudio(id, src, options = {}) {
    let audio = this.audioInstances.get(id);

    if (!audio) {
      audio = new Audio();
      audio.preload = options.preload || 'metadata';
      this.audioInstances.set(id, audio);
    }

    if (src && audio.src !== new URL(src, window.location.href).href) {
      audio.src = src;
    }

    audio.loop = !!options.loop;
    return audio;
  },

  play(id, src, volume = 1.0, options = {}) {
    if (!this.isEnabled) return Promise.resolve();

    const audio = this.getAudio(id, src, options);
    audio.volume = Math.min(1, Math.max(0, volume));

    if (options.restart !== false) {
      audio.currentTime = 0;
    }

    return audio.play().catch(error => {
      console.warn(`Audio play failed for ${id}:`, error);
      throw error;
    });
  },

  playVoice(src, volume = 0.92) {
    return this.play('voice-line', src, volume, { preload: 'metadata', loop: false });
  },

  playBGM(src, volume = 0.5) {
    const existing = this.audioInstances.get('bgm-current');
    if (existing && existing.src === new URL(src, window.location.href).href && !existing.paused) {
      return Promise.resolve();
    }

    return this.play('bgm-current', src, volume, { preload: 'metadata', loop: true, restart: false });
  },

  stop(id) {
    const audio = this.audioInstances.get(id);
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  },

  stopAll() {
    this.audioInstances.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  },

  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled) this.stopAll();
  },

  release(id) {
    const audio = this.audioInstances.get(id);
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    audio.src = '';
    this.audioInstances.delete(id);
  }
};

window.AudioManager = AudioManager;
