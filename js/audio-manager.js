// ===== GLOBAL AUDIO MANAGER =====
const AudioManager = {
  audioInstances: new Map(),
  isEnabled: true,
  bgmEnabled: true,
  bgmVolume: 0.42,
  bgmSource: '',
  bgmUnlocked: false,
  bgmUnlockBound: false,

  init({ src = '', defaultVolume = 0.42 } = {}) {
    const settings = window.DB ? DB.getSettings() : {};
    this.bgmEnabled = settings.bgmEnabled !== false;
    const savedVolume = Number(settings.bgmVolume);
    this.bgmVolume = Number.isFinite(savedVolume)
      ? Math.min(1, Math.max(0, savedVolume))
      : Math.min(1, Math.max(0, defaultVolume));
    this.bindBGMUnlock();
    this.setBGMSource(src);
  },

  bindBGMUnlock() {
    if (this.bgmUnlockBound) return;
    this.bgmUnlockBound = true;

    const unlock = () => {
      this.bgmUnlocked = true;
      this.syncBGM();
      ['pointerdown', 'touchstart', 'keydown'].forEach(eventName => {
        document.removeEventListener(eventName, unlock);
      });
    };

    ['pointerdown', 'touchstart', 'keydown'].forEach(eventName => {
      document.addEventListener(eventName, unlock, { passive: true });
    });
  },

  getAudio(id, src, options = {}) {
    let audio = this.audioInstances.get(id);

    if (!audio) {
      audio = new Audio();
      audio.preload = options.preload || 'metadata';
      this.audioInstances.set(id, audio);
    }

    if (src && audio.src !== new URL(src, window.location.href).href) {
      audio.src = src;
      audio.load();
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

  setBGMSource(src) {
    this.bgmSource = src || '';
    if (!this.bgmSource) {
      this.release('bgm-current');
      return;
    }
    this.syncBGM();
  },

  setBGMEnabled(enabled) {
    this.bgmEnabled = !!enabled;
    if (!this.bgmEnabled) {
      this.stop('bgm-current');
      return;
    }
    this.syncBGM();
  },

  unlockBGM() {
    this.bgmUnlocked = true;
    return this.syncBGM();
  },

  setBGMVolume(volume) {
    this.bgmVolume = Math.min(1, Math.max(0, Number(volume) || 0));
    const audio = this.audioInstances.get('bgm-current');
    if (audio) audio.volume = this.bgmVolume;
  },

  syncBGM() {
    if (!this.bgmSource || !this.bgmEnabled || !this.isEnabled) {
      this.stop('bgm-current');
      return Promise.resolve();
    }

    const audio = this.getAudio('bgm-current', this.bgmSource, { preload: 'metadata', loop: true });
    audio.volume = this.bgmVolume;
    if (!this.bgmUnlocked) return Promise.resolve();

    return this.playBGM(this.bgmSource, this.bgmVolume).catch(() => {});
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
