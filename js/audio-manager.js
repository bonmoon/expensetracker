// ===== GLOBAL AUDIO MANAGER - Prevents loops and optimizes mobile audio =====
const AudioManager = {
  audioInstances: new Map(),
  isEnabled: true,

  /**
   * Create a managed audio instance with loop prevention
   */
  getAudio(id, src) {
    if (!this.audioInstances.has(id)) {
      const audio = new Audio(src);
      audio.loop = false; // CRITICAL: Absolutely no loop
      audio.preload = 'none'; // Lazy load to reduce initial load
      
      // Prevent any loop restart
      audio.addEventListener('ended', () => {
        audio.pause();
        audio.currentTime = 0;
      }, { once: false });

      this.audioInstances.set(id, audio);
    }
    return this.audioInstances.get(id);
  },

  /**
   * Play an audio clip (plays once, never loops)
   */
  play(id, src, volume = 1.0) {
    if (!this.isEnabled) return Promise.resolve();
    
    const audio = this.getAudio(id, src);
    audio.volume = Math.min(1, volume);
    audio.currentTime = 0;
    
    return audio.play().catch(e => {
      console.warn(`Audio play failed for ${id}:`, e);
      return Promise.reject(e);
    });
  },

  /**
   * Stop audio
   */
  stop(id) {
    const audio = this.audioInstances.get(id);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  },

  /**
   * Stop all audio
   */
  stopAll() {
    this.audioInstances.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  },

  /**
   * Enable/disable audio (useful for testing)
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (!enabled) this.stopAll();
  },

  /**
   * Play BGM (background music) - optimized for mobile
   * Returns early if already playing to prevent overlaps
   */
  playBGM(src, volume = 0.5) {
    const bgmId = 'bgm-current';
    const bgmAudio = this.audioInstances.get(bgmId);
    
    // If already playing same src, don't restart
    if (bgmAudio && bgmAudio.src === src && !bgmAudio.paused) {
      return Promise.resolve();
    }
    
    // Stop any existing BGM
    this.stop(bgmId);
    
    // Don't auto-play BGM on mobile to reduce lag
    // Only play if explicitly requested and on desktop
    if (navigator.userAgentData?.mobile === false || !('ontouchstart' in window)) {
      return this.play(bgmId, src, volume);
    }
    
    return Promise.resolve();
  },

  /**
   * Release audio instance to free memory
   */
  release(id) {
    const audio = this.audioInstances.get(id);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
      this.audioInstances.delete(id);
    }
  }
};

window.AudioManager = AudioManager;
