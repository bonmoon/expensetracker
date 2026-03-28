const CHARACTER_CONFIG = {
  aaron: {
    id: 'aaron',
    enabled: true,
    name: 'Aaron',
    title: 'Moonlight Butler',
    theme: {
      primary: '#d8ba73',
      secondary: '#12243f',
      accent: '#f5dfae',
      bg: '#08111f',
      text: '#f3f7ff',
      chatBubble: 'rgba(12,25,47,0.88)',
      glow: 'rgba(133,173,255,0.22)',
    },
    layers: {
      bg: 'images/characters/aaron/Aaron1.png',
      stars: null,
      char: 'images/characters/aaron/Aaron1.png',
      prop1: null,
      prop2: null,
      video: 'images/characters/aaron/video.mp4',
    },
    portrait: 'images/characters/aaron/Aaron2.PNG',
    launch: {
      frames: [
        'images/taroteye1.png',
        'images/taroteye2.png',
        'images/taroteye3.png',
        'images/taroteye4.png',
        'images/taroteye5.png',
        'images/taroteye6.png',
      ],
      reveal: 'images/characters/aaron/Aaron2.PNG',
    },
    audio: {
      launch: 'voice/applaunch.mp3',
      bgm: 'voice/bulterbgm.mp3',
      voiceLines: [
        'voice/英文1.mp3',
        'voice/英文2.mp3',
        'voice/英文3.mp3',
        'voice/英文4.mp3',
        'voice/英文5.mp3',
        'voice/英文6.mp3',
        'voice/英文7.mp3',
      ],
    },
    quotes: {
      morning: ['早安，主人。今日账目由我守护。', '清晨好，主人。'],
      afternoon: ['午后好，主人。有什么需要记录的吗？'],
      evening: ['晚上好，主人。今日辛苦了。'],
      night: ['夜深了，主人，请注意休息。'],
      afterRecord: ['已为主人记录在册，分毫不差。'],
      bigExpense: ['主人，这个月有点大手笔，储蓄目标还能完成吗？'],
      income: ['可喜可贺，主人今日进账了！'],
      welcome: ['您好，主人。请告诉我需要记录什么，例如「今天午饭花了45块」或「收到工资8000」。'],
    },
    personality: '你是Aaron，一位优雅严谨的英式财务执事。说话沉稳有礼，略带距离感，偶尔显露出对主人的关心。',
    ui: {
      avatarSize: '220%',
      avatarPosition: '50% 18%',
      dialogAvatarSize: '220%',
      dialogAvatarPosition: '50% 18%',
      videoObjectPosition: 'center center',
      homePosition: 'center top',
    },
  },
  louris: {
    id: 'louris',
    enabled: true,
    name: 'Louris',
    title: 'Moonlit Steward',
    theme: {
      primary: '#7ab0d4',
      secondary: '#0d1a2e',
      accent: '#d8ebf7',
      bg: '#060d18',
      text: '#e8f0f8',
      chatBubble: 'rgba(13,26,46,0.88)',
      glow: 'rgba(122,176,212,0.18)',
    },
    layers: {
      bg: 'images/characters/louris/louris1.PNG',
      stars: null,
      char: 'images/characters/louris/louris1.PNG',
      prop1: null,
      prop2: null,
      video: 'images/characters/louris/video.MP4',
    },
    portrait: 'images/characters/louris/louris1.PNG',
    launch: {
      frames: [
        'images/taroteye1.png',
        'images/taroteye2.png',
        'images/taroteye3.png',
        'images/taroteye4.png',
        'images/taroteye5.png',
        'images/taroteye6.png',
      ],
      reveal: 'images/characters/louris/louris1.PNG',
    },
    audio: {
      launch: '',
      bgm: 'voice/bulterbgm.mp3',
      voiceLines: [],
    },
    quotes: {
      morning: ['早安，主人。月光尚未散去，今日账目已为您备好。'],
      afternoon: ['午后安，主人。要让我替您记下今天的收支吗？'],
      evening: ['晚上好，主人。今夜的账册，也由我为您守着。'],
      night: ['夜深了，主人。愿月色与我一同守护您。'],
      afterRecord: ['已替主人收入月光账册，静候下一笔吩咐。'],
      bigExpense: ['主人，这笔开销颇有分量，是否要我一起盯紧预算？'],
      income: ['真是好消息，主人。今夜的月色都明亮了几分。'],
      welcome: ['您好，主人。若要记账，只需告诉我金额、类别或日期即可。'],
    },
    personality: '你是Louris，一位温柔而克制的月光执事。说话带一点诗意，始终沉静体贴。',
    ui: {
      avatarSize: '235%',
      avatarPosition: '50% 16%',
      dialogAvatarSize: '235%',
      dialogAvatarPosition: '50% 16%',
      videoObjectPosition: 'center top',
      homePosition: 'center top',
    },
  },
};

const Character = {
  current: null,
  videoEl: null,
  homeScreenEl: null,
  pendingVideoSrc: null,
  deferVideoUntilLaunch: true,
  videoLoadToken: 0,

  init() {
    this.videoEl = document.getElementById('char-video');
    this.homeScreenEl = document.getElementById('screen-home');
    this.bindVideoEvents();
    this.renderSwitcher();

    const saved = this.getSavedCharacterId();
    this.switchTo(saved, false);
  },

  getAll() {
    return Object.values(CHARACTER_CONFIG);
  },

  getEnabled() {
    return this.getAll().filter(character => character.enabled !== false);
  },

  getSavedCharacterId() {
    const settingsCharacter = DB.getSettings().currentCharacter;
    const legacyCharacter = localStorage.getItem('butler_character');
    return settingsCharacter || legacyCharacter || this.getEnabled()[0]?.id || 'aaron';
  },

  getCurrent() {
    return this.current || this.getEnabled()[0] || null;
  },

  renderSwitcher() {
    const switcher = document.getElementById('character-switcher');
    if (!switcher) return;

    switcher.innerHTML = this.getEnabled().map(character => `
      <button
        class="character-switcher-btn"
        type="button"
        data-character-id="${character.id}"
        aria-pressed="false"
      >
        ${character.name}
      </button>
    `).join('');

    switcher.querySelectorAll('.character-switcher-btn').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-character-id');
        this.switchTo(id);
      });
    });
  },

  switchTo(id, playSound = true) {
    const config = CHARACTER_CONFIG[id];
    if (!config || config.enabled === false) return;

    this.current = config;
    DB.saveSetting('currentCharacter', id);
    localStorage.setItem('butler_character', id);

    this.applyTheme(config.theme);
    this.applyCharacterUI(config);
    this.applyLayers(config.layers);
    this.updateSwitcherState(id);

    if (window.AudioManager && config.audio?.bgm) {
      window.AudioManager.setBGMSource(config.audio.bgm);
      if (playSound) window.AudioManager.syncBGM();
    }

    document.dispatchEvent(new CustomEvent('characterChanged', { detail: config }));
  },

  applyTheme(theme) {
    const root = document.documentElement;
    root.style.setProperty('--gold', theme.primary);
    root.style.setProperty('--gold-light', theme.accent);
    root.style.setProperty('--gold-dark', this.shadeHex(theme.primary, -0.32));
    root.style.setProperty('--brown-deep', theme.bg);
    root.style.setProperty('--brown-mid', theme.secondary);
    root.style.setProperty('--cream', theme.text);
    root.style.setProperty('--chat-bubble', theme.chatBubble);
    root.style.setProperty('--chat-bubble-soft', this.withAlpha(theme.primary, 0.12));
    root.style.setProperty('--chat-bubble-border', this.withAlpha(theme.primary, 0.3));
    root.style.setProperty('--char-glow-color', theme.glow || this.withAlpha(theme.primary, 0.4));
    root.style.setProperty('--theme-rgb', this.hexToRgb(theme.primary));

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', theme.bg);
  },

  applyLayers(layers) {
    const bg = document.getElementById('layer-bg');
    const stars = document.getElementById('layer-stars');
    const charImg = document.querySelector('#layer-char img');
    const prop1Img = document.querySelector('#layer-raven img');
    const prop2Img = document.querySelector('#layer-book img');

    if (bg) {
      bg.style.backgroundImage = layers.bg ? `url(${layers.bg})` : 'none';
      bg.style.opacity = layers.bg ? '0.78' : '0';
    }
    if (stars) {
      stars.style.backgroundImage = layers.stars ? `url(${layers.stars})` : 'none';
      stars.style.opacity = layers.stars ? '0.24' : '0';
    }
    if (charImg && layers.char) charImg.src = layers.char;
    this.toggleLayer(document.getElementById('layer-raven'), prop1Img, layers.prop1);
    this.toggleLayer(document.getElementById('layer-book'), prop2Img, layers.prop2);

    this.applyVideo(layers.video);
  },

  toggleLayer(layerEl, imgEl, src) {
    if (!layerEl || !imgEl) return;
    if (src) {
      imgEl.src = src;
      layerEl.style.display = 'block';
      layerEl.style.opacity = '1';
    } else {
      imgEl.removeAttribute('src');
      layerEl.style.display = 'none';
      layerEl.style.opacity = '0';
    }
  },

  applyVideo(videoSrc) {
    if (!this.videoEl) return;

    if (this.deferVideoUntilLaunch) {
      this.pendingVideoSrc = videoSrc || null;
      this.setVideoMode(false);
      return;
    }

    this.videoLoadToken += 1;
    const token = this.videoLoadToken;
    this.videoEl.dataset.switchToken = String(token);
    this.videoEl.dataset.pendingReveal = videoSrc ? '1' : '0';
    this.videoEl.pause();
    this.setVideoMode(false);

    if (!videoSrc) {
      this.videoEl.removeAttribute('src');
      this.videoEl.load();
      return;
    }

    this.videoEl.dataset.src = videoSrc;
    this.videoEl.src = videoSrc;
    this.videoEl.load();
    this.revealVideoWhenReady(token);
  },

  bindVideoEvents() {
    if (!this.videoEl) return;

    this.videoEl.loop = true;
    const tryReveal = () => {
      if (!this.videoEl || this.videoEl.dataset.pendingReveal !== '1') return;
      const token = Number(this.videoEl.dataset.switchToken || '0');
      this.revealVideoWhenReady(token);
    };
    this.videoEl.addEventListener('loadeddata', tryReveal);
    this.videoEl.addEventListener('canplay', tryReveal);
    this.videoEl.addEventListener('error', () => {
      if (!this.videoEl) return;
      this.videoEl.dataset.pendingReveal = '0';
      this.setVideoMode(false);
    });
  },

  activateDeferredVideo() {
    this.deferVideoUntilLaunch = false;
    this.applyVideo(this.pendingVideoSrc || this.getCurrent()?.layers?.video || null);
  },

  revealVideoWhenReady(token) {
    if (!this.videoEl || String(token) !== this.videoEl.dataset.switchToken) return;
    if (this.videoEl.readyState < 2) return;

    this.videoEl.play().then(() => {
      if (!this.videoEl || String(token) !== this.videoEl.dataset.switchToken) return;
      this.videoEl.dataset.pendingReveal = '0';
      this.setVideoMode(true);
    }).catch(() => {
      if (!this.videoEl || String(token) !== this.videoEl.dataset.switchToken) return;
      this.videoEl.dataset.pendingReveal = '0';
      this.setVideoMode(false);
    });
  },

  setVideoMode(active) {
    if (!this.homeScreenEl) return;
    this.homeScreenEl.classList.toggle('video-active', !!active);
  },

  applyCharacterUI(config) {
    const root = document.documentElement;
    const ui = config.ui || {};
    root.style.setProperty('--character-avatar', `url('${config.portrait || config.layers.char}')`);
    root.style.setProperty('--character-avatar-size', ui.avatarSize || '320%');
    root.style.setProperty('--character-avatar-position', ui.avatarPosition || '48% 5%');
    root.style.setProperty('--character-home-position', ui.homePosition || 'center top');
    root.style.setProperty('--character-video-object-position', ui.videoObjectPosition || 'center top');

    const aiName = document.getElementById('ai-char-name');
    const aiTitle = document.getElementById('ai-char-title');
    const dialogName = document.getElementById('butler-dialog-name');

    if (aiName) aiName.textContent = config.name;
    if (aiTitle) aiTitle.textContent = config.title;
    if (dialogName) dialogName.textContent = config.title;
  },

  updateSwitcherState(activeId) {
    document.querySelectorAll('.character-switcher-btn').forEach(button => {
      const isActive = button.getAttribute('data-character-id') === activeId;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  },

  getQuote(eventName) {
    const current = this.getCurrent();
    if (!current) return '';

    if (eventName === 'time') {
      const hour = new Date().getHours();
      if (hour < 6) return this.pickQuote(current.quotes.night);
      if (hour < 12) return this.pickQuote(current.quotes.morning);
      if (hour < 18) return this.pickQuote(current.quotes.afternoon);
      return this.pickQuote(current.quotes.evening);
    }

    return this.pickQuote(current.quotes[eventName] || current.quotes.afterRecord || []);
  },

  getWelcomeMessage() {
    const current = this.getCurrent();
    if (!current) return '';
    return this.pickQuote(current.quotes.welcome || []) || '您好，主人。请告诉我需要记录什么。';
  },

  getLaunchFrames() {
    return this.getCurrent()?.launch?.frames || [];
  },

  getLaunchRevealImage() {
    return this.getCurrent()?.launch?.reveal || this.getCurrent()?.portrait || this.getCurrent()?.layers?.char || '';
  },

  getLaunchAudio() {
    return this.getCurrent()?.audio?.launch || '';
  },

  getRandomVoiceLine() {
    const lines = this.getCurrent()?.audio?.voiceLines || [];
    if (!lines.length) return '';
    return lines[Math.floor(Math.random() * lines.length)];
  },

  pickQuote(pool) {
    if (!pool || !pool.length) return '';
    return pool[Math.floor(Math.random() * pool.length)];
  },

  withAlpha(hex, alpha) {
    return `rgba(${this.hexToRgb(hex)}, ${alpha})`;
  },

  hexToRgb(hex) {
    const value = hex.replace('#', '');
    const full = value.length === 3
      ? value.split('').map(char => char + char).join('')
      : value;
    const int = parseInt(full, 16);
    const r = (int >> 16) & 255;
    const g = (int >> 8) & 255;
    const b = int & 255;
    return `${r}, ${g}, ${b}`;
  },

  shadeHex(hex, amount) {
    const [r, g, b] = this.hexToRgb(hex).split(',').map(part => Number(part.trim()));
    const next = [r, g, b].map(channel => {
      const adjusted = amount >= 0
        ? channel + (255 - channel) * amount
        : channel * (1 + amount);
      return Math.max(0, Math.min(255, Math.round(adjusted)));
    });

    return `#${next.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
  },
};

window.CHARACTER_CONFIG = CHARACTER_CONFIG;
window.Character = Character;
