// ===== MAIN APP CONTROLLER =====
const App = {
  currentScreen: 'home',
  chatHistory: [],
  quickAmount: '',
  quickType: 'expense',
  quickCategory: { name: '餐饮', emoji: '🍜' },
  selectedGoalEmoji: '🎯',
  isLaunchRunning: false,
  hasLaunchStarted: false,
  _launchTimers: [],
  _launchSafetyTimer: null,
  _launchExitTimer: null,
  launchAudio: null,
  savingsVideoEl: null,
  savingsJarHeroEl: null,
  savingsJarTriggerEl: null,
  _savingsVisibilityBound: false,
  _savingsJarTapBound: false,
  _lastSavingsJarOpenAt: 0,
  BGM_SRC: 'voice/bulterbgm.mp3',
  DEFAULT_BGM_VOLUME: 0.42,

  CATEGORIES: [
    { name: '餐饮', emoji: '🍜' },
    { name: '购物', emoji: '🛍️' },
    { name: '交通', emoji: '🚗' },
    { name: '娱乐', emoji: '🎮' },
    { name: '医疗', emoji: '💊' },
    { name: '居住', emoji: '🏠' },
    { name: '教育', emoji: '📚' },
    { name: '工资', emoji: '💼' },
    { name: '副业', emoji: '💡' },
    { name: '投资', emoji: '📈' },
    { name: '礼金', emoji: '🎁' },
    { name: '其他', emoji: '💸' },
  ],

  GOAL_EMOJIS: ['🏠','✈️','🚗','💍','💻','📱','🎓','👜','⌚','🎵','🌏','💰'],

  init() {
    this.registerSW();
    if (window.AudioManager) {
      window.AudioManager.init({
        src: this.BGM_SRC,
        defaultVolume: this.DEFAULT_BGM_VOLUME,
      });
    }
    this.setupLaunchAudio();
    Character.init();
    this.bindCharacterEvents();
    this.setupHome();
    this.setupQuick();
    this.setupAI();
    this._aiInited = true;
    this.setupCharts();
    this.setupSavings();
    this.setupSettings();
    this.updateHomeBalance();
    Parallax.init();
    this.startLaunchSequence();

    // 只有完全没配置过Key才提示
    const settings = DB.getSettings();
    if (!settings.aiKey && !settings.geminiKey) {
      setTimeout(() => this.showToast('请在设置中配置 AI API Key'), 3000);
    }
  },

  ensureBGMPlayback() {
    if (!window.AudioManager) return;
    window.AudioManager.unlockBGM().catch(() => {});
  },

  registerSW() {
    if ('serviceWorker' in navigator) {
      const swUrl = new URL('sw.js', window.location.href);
      navigator.serviceWorker.register(swUrl.href).then(registration => {
        registration.update().catch(() => {});
      }).catch(console.error);

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }
  },

  setupLaunchAudio() {
    const launchAudio = Character.getLaunchAudio();
    if (window.AudioManager && launchAudio) {
      window.AudioManager.getAudio('launch', launchAudio, { preload: 'metadata', loop: false });
    }
  },

  playLaunchAudio() {
    const launchAudio = Character.getLaunchAudio();
    if (window.AudioManager && launchAudio) {
      window.AudioManager.play('launch', launchAudio, 0.72, { preload: 'metadata', loop: false }).catch(() => {});
    }
  },

  startLaunchSequence() {
    const overlay = document.getElementById('launch-overlay');
    const image = document.getElementById('launch-card-image');
    const revealImage = document.getElementById('launch-character-image');
    if (!overlay || !image) return;
    image.addEventListener('error', () => this.skipLaunchSequence(), { once: true });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      overlay.classList.add('hidden');
      this.finishLaunchSequence();
      return;
    }

    const frames = Character.getLaunchFrames();
    const reveal = Character.getLaunchRevealImage();
    if (!frames.length || !reveal) {
      overlay.classList.add('hidden');
      this.finishLaunchSequence();
      return;
    }

    overlay.classList.remove('running', 'show-reveal', 'hidden');
    overlay.style.display = '';
    image.src = frames[0];
    if (revealImage) revealImage.src = reveal;
  },

  beginLaunchSequence() {
    if (this.isLaunchRunning || this.hasLaunchStarted) return;
    this.ensureBGMPlayback();

    const overlay = document.getElementById('launch-overlay');
    const image = document.getElementById('launch-card-image');
    const revealImage = document.getElementById('launch-character-image');
    if (!overlay || !image) return;

    const frames = Character.getLaunchFrames();
    const reveal = Character.getLaunchRevealImage();
    if (!frames.length || !reveal) {
      overlay.classList.add('hidden');
      this.finishLaunchSequence();
      return;
    }

    this.hasLaunchStarted = true;
    this.isLaunchRunning = true;
    Parallax.stop();
    overlay.style.display = '';
    overlay.classList.remove('hidden', 'show-reveal');
    overlay.classList.add('running');
    document.body.classList.add('launch-running');
    image.src = frames[0];
    if (revealImage) revealImage.src = reveal;
    this.playLaunchAudio();
    clearTimeout(this._launchSafetyTimer);
    this._launchSafetyTimer = setTimeout(() => {
      if (this.isLaunchRunning) this.finishLaunchSequence();
    }, 6500);

    this.queueLaunchStep(() => this.playLaunchFrames(frames, 1), 120);
    this.queueLaunchStep(() => overlay.classList.add('show-reveal'), 980);
    this.queueLaunchStep(() => this.finishLaunchSequence(), 1920);
  },

  playLaunchFrames(frames, startIndex = 0) {
    const image = document.getElementById('launch-card-image');
    if (!image || !this.isLaunchRunning) return;

    frames.slice(startIndex).forEach((src, index) => {
      this.queueLaunchStep(() => {
        if (this.isLaunchRunning) image.src = src;
      }, index * 110);
    });
  },

  skipLaunchSequence() {
    if (!this.isLaunchRunning && !this.hasLaunchStarted) {
      this.hasLaunchStarted = true;
    }

    const overlay = document.getElementById('launch-overlay');
    const image = document.getElementById('launch-card-image');
    const revealImage = document.getElementById('launch-character-image');
    if (overlay) overlay.classList.add('show-reveal', 'hidden');
    if (image) image.src = Character.getLaunchFrames()[0] || image.src;
    if (revealImage) revealImage.src = Character.getLaunchRevealImage();
    this.finishLaunchSequence();
  },

  finishLaunchSequence() {
    this.isLaunchRunning = false;
    this.clearLaunchTimers();
    clearTimeout(this._launchSafetyTimer);
    clearTimeout(this._launchExitTimer);
    document.body.classList.remove('launch-running');

    const overlay = document.getElementById('launch-overlay');
    const home = document.getElementById('screen-home');
    const shouldAnimateOut = overlay &&
      overlay.style.display !== 'none' &&
      overlay.classList.contains('show-reveal') &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (home && shouldAnimateOut) {
      home.classList.add('launch-home-enter');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => home.classList.remove('launch-home-enter'));
      });
    }

    if (overlay && shouldAnimateOut) {
      overlay.classList.add('exit-to-home');
      this._launchExitTimer = setTimeout(() => {
        overlay.classList.remove('running', 'show-reveal', 'exit-to-home', 'hidden');
        overlay.style.display = 'none';
        Character.activateDeferredVideo();
        Parallax.startLoop();
      }, 620);
      return;
    }

    if (overlay) {
      overlay.classList.remove('running', 'show-reveal', 'exit-to-home', 'hidden');
      overlay.style.display = 'none';
    }

    Character.activateDeferredVideo();
    Parallax.startLoop();
  },

  queueLaunchStep(fn, delay) {
    const timer = setTimeout(fn, delay);
    this._launchTimers.push(timer);
  },

  clearLaunchTimers() {
    this._launchTimers.forEach(timer => clearTimeout(timer));
    this._launchTimers = [];
  },

  // ===== NAVIGATION =====
  navigate(screenId) {
    const previousScreen = this.currentScreen;
    this.ensureBGMPlayback();
    const current = document.getElementById(`screen-${previousScreen}`);
    const next = document.getElementById(`screen-${screenId}`);
    if (!next) return;

    // Teardown leaving screen
    if (previousScreen === 'home' && screenId !== 'home') {
      Parallax.stop();
      const charVideo = document.getElementById('char-video');
      if (charVideo && !charVideo.paused) charVideo.pause();
    }

    if (current) current.classList.remove('active');
    next.classList.add('active');
    this.currentScreen = screenId;

    // Manage savings video
    if (previousScreen !== screenId) this.syncSavingsHeroVideoPlayback();

    // Screen-specific init
    if (screenId === 'charts') {
      setTimeout(() => Charts.init(), 100);
    }
    if (screenId === 'savings') {
      this.renderGoals();
      requestAnimationFrame(() => this.updateSavingsJarOverlay());
    }
    if (screenId === 'ai') {
      if (!this._aiInited) {
        this.setupAI();
        this._aiInited = true;
      }
    }
    if (screenId === 'home') {
      this.updateHomeBalance();
      Parallax.startLoop();
      // Resume home character video
      const charVideo = document.getElementById('char-video');
      if (charVideo && charVideo.src && charVideo.paused) charVideo.play().catch(() => {});
      this.cycleGreeting();
      this.playRandomCharacterVoice();
    }
  },

  goBack() {
    this.navigate('home');
  },

  bindCharacterEvents() {
    document.addEventListener('characterChanged', () => {
      this.updateCharacterDependentUI();
      if (this.currentScreen === 'home') this.cycleGreeting();
    });
  },

  updateCharacterDependentUI() {
    const butlerLabel = this.getButlerLabel();
    const input = document.getElementById('chat-input');
    if (input) {
      input.placeholder = `告诉${butlerLabel}您的收支…`;
    }

    document.querySelectorAll('.butler-name').forEach(el => {
      el.textContent = butlerLabel;
    });
  },

  getCurrentCharacter() {
    return Character.getCurrent();
  },

  getButlerLabel() {
    const current = this.getCurrentCharacter();
    return current ? current.title : '執事';
  },

  // ===== HOME =====
  setupHome() {
    this.bindHomeCharacterVoice();
    this.updateHomeBalance();
    this.cycleGreeting();
  },

  bindHomeCharacterVoice() {
    if (this._homeVoiceBound) return;
    this._homeVoiceBound = true;

    const triggerVoice = () => this.playRandomCharacterVoice();
    ['layer-char', 'char-video', 'char-video-layer', 'greeting-text'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', triggerVoice);
    });
  },

  playRandomCharacterVoice() {
    const src = Character.getRandomVoiceLine();
    if (!src || !window.AudioManager) return;
    AudioManager.playVoice(src).catch(() => {});
  },

  _greetingTimer: null,

  setGreeting(text) {
    const el = document.getElementById('greeting-text');
    if (!el) return;
    el.classList.add('fade-out');
    setTimeout(() => {
      el.textContent = text;
      el.classList.remove('fade-out');
    }, 500);
  },

  cycleGreeting() {
    clearTimeout(this._greetingTimer);
    this.setGreeting(Character.getQuote('time'));
    // 每20秒自动轮换台词
    const cycle = () => {
      if (this.currentScreen !== 'home') return;
      this.setGreeting(Character.getQuote('time'));
      this._greetingTimer = setTimeout(cycle, 20000);
    };
    this._greetingTimer = setTimeout(cycle, 20000);
  },

  // 事件触发台词（记账后调用）
  triggerEventQuote(type, amount) {
    if (this.currentScreen !== 'home') return;
    let eventName = 'afterRecord';
    if (type === 'income') eventName = 'income';
    else if (amount >= 500) eventName = 'bigExpense';
    const text = Character.getQuote(eventName);
    this.setGreeting(text);
    // 8秒后恢复时段台词
    clearTimeout(this._greetingTimer);
    this._greetingTimer = setTimeout(() => this.cycleGreeting(), 8000);
  },

  updateHomeBalance() {
    const now = new Date();
    const { income, expense, balance } = DB.getMonthSummary(now.getFullYear(), now.getMonth());

    const balEl = document.getElementById('home-balance');
    const inEl  = document.getElementById('home-income');
    const outEl = document.getElementById('home-expense');

    if (balEl) balEl.textContent = balance.toLocaleString();
    if (inEl)  inEl.textContent  = `↑ ¥${income.toLocaleString()}`;
    if (outEl) outEl.textContent = `↓ ¥${expense.toLocaleString()}`;
  },

  // ===== QUICK RECORD =====
  setupQuick() {
    const catGrid = document.getElementById('cat-grid');
    if (catGrid) {
      catGrid.innerHTML = this.CATEGORIES.map((c, i) => `
        <div class="cat-btn ${i===0?'selected':''}" onclick="App.selectCategory('${c.name}','${c.emoji}',this)">
          <span class="cat-emoji">${c.emoji}</span>
          <span class="cat-name">${c.name}</span>
        </div>
      `).join('');
    }
    // 默认日期为今天
    const dateEl = document.getElementById('quick-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    this.updateAmountDisplay();
  },

  selectCategory(name, emoji, el) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    this.quickCategory = { name, emoji };
    // Auto-set type
    const incomeCategories = ['工资','副业','投资','礼金'];
    const newType = incomeCategories.includes(name) ? 'income' : 'expense';
    if (newType !== this.quickType) this.setType(newType);
  },

  setType(type) {
    this.quickType = type;
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.type-btn.${type}`);
    if (btn) btn.classList.add('active');
    this.updateAmountDisplay();
  },

  numInput(val) {
    if (val === '.' && this.quickAmount.includes('.')) return;
    if (this.quickAmount.includes('.')) {
      const decimals = this.quickAmount.split('.')[1];
      if (decimals && decimals.length >= 2) return;
    }
    if (this.quickAmount === '0' && val !== '.') {
      this.quickAmount = val;
    } else {
      if (this.quickAmount.length >= 8) return;
      this.quickAmount += val;
    }
    this.updateAmountDisplay();
  },

  numDelete() {
    this.quickAmount = this.quickAmount.slice(0, -1);
    this.updateAmountDisplay();
  },

  updateAmountDisplay() {
    const el = document.getElementById('amount-number');
    if (!el) return;
    const display = this.quickAmount || '0';
    el.textContent = `¥ ${display}`;
    el.className = `amount-number ${this.quickType}`;
  },

  submitRecord() {
    const amount = parseFloat(this.quickAmount);
    if (!amount || amount <= 0) { this.showToast('请输入金额'); return; }
    const noteEl = document.getElementById('quick-note');
    const dateEl = document.getElementById('quick-date');
    const note = noteEl ? noteEl.value.trim() : '';
    const date = dateEl ? dateEl.value : '';
    const record = {
      type: this.quickType, amount,
      category: this.quickCategory.name,
      emoji: this.quickCategory.emoji,
      note
    };
    if (date) record.date = date;
    DB.saveRecord(record);
    this.quickAmount = '';
    if (noteEl) noteEl.value = '';
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    this.updateAmountDisplay();
    this.updateHomeBalance();
    this.showToast('记录成功 ✓');
    this.playRandomCharacterVoice();
    // 回主页后触发台词
    setTimeout(() => this.triggerEventQuote(this.quickType, amount), 900);
    setTimeout(() => this.navigate('home'), 800);
  },

  // ===== 编辑记录 =====
  showEditRecord(id) {
    const record = DB.getRecords().find(r => r.id === id);
    if (!record) return;
    document.getElementById('edit-record-id').value = id;
    document.getElementById('edit-amount').value = record.amount;
    document.getElementById('edit-note').value = record.note || '';
    document.getElementById('edit-category').value = record.category;
    const d = new Date(record.createdAt);
    document.getElementById('edit-date').value = d.toISOString().split('T')[0];
    // 设置类型
    this.setEditType(record.type);
    document.getElementById('modal-edit-record').classList.add('open');
  },

  setEditType(type) {
    ['expense','income'].forEach(t => {
      const btn = document.getElementById(`edit-type-${t}`);
      if (btn) btn.classList.toggle('active', t === type);
    });
    this._editType = type;
  },

  saveEditRecord() {
    const id = document.getElementById('edit-record-id').value;
    const amount = parseFloat(document.getElementById('edit-amount').value);
    const note = document.getElementById('edit-note').value.trim();
    const category = document.getElementById('edit-category').value;
    const date = document.getElementById('edit-date').value;
    const type = this._editType || 'expense';
    if (!amount || amount <= 0) { this.showToast('请输入有效金额'); return; }
    // 找到对应emoji
    const cat = this.CATEGORIES.find(c => c.name === category);
    const emoji = cat ? cat.emoji : '💸';
    const existing = DB.getRecords().find(r => r.id === id);
    if (!existing) {
      this.showToast('记录不存在');
      return;
    }

    const updates = { type, amount, category, emoji, note };
    if (date) {
      const t = new Date(existing.createdAt);
      updates.createdAt = `${date}T${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:00`;
    }

    DB.updateRecord(id, updates);
    this.closeModal('modal-edit-record');
    this.updateHomeBalance();
    Charts.init();
    this.showToast('已更新 ✓');
  },

  deleteRecordFromEdit() {
    const id = document.getElementById('edit-record-id').value;
    DB.deleteRecord(id);
    this.closeModal('modal-edit-record');
    this.updateHomeBalance();
    Charts.init();
    this.showToast('已删除');
  },

  // 直接从列表删除（滑动后点删除按钮）
  deleteRecord(id) {
    DB.deleteRecord(id);
    // 移除DOM元素
    const wrap = document.getElementById(`wrap-${id}`);
    if (wrap) {
      wrap.style.transition = 'opacity 0.3s, max-height 0.3s';
      wrap.style.opacity = '0';
      wrap.style.maxHeight = '0';
      setTimeout(() => wrap.remove(), 300);
    }
    this.updateHomeBalance();
    this.showToast('已删除');
  },

  // ===== 滑动手势 =====
  _swipeState: {},

  swipeStart(e, id) {
    const touch = e.touches[0];
    this._swipeState[id] = {
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      dir: null,
    };
  },

  swipeMove(e, id) {
    const state = this._swipeState[id];
    if (!state) return;
    const touch = e.touches[0];
    const dx = touch.clientX - state.startX;
    const dy = touch.clientY - state.startY;
    state.lastX = touch.clientX;

    if (!state.dir) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      state.dir = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (state.dir === 'x') e.preventDefault();
  },

  swipeEnd(e, id) {
    const state = this._swipeState[id];
    if (!state) return;

    const dx = state.lastX - state.startX;
    const item = document.getElementById(`item-${id}`);
    const actions = document.getElementById(`actions-${id}`);

    if (!item || !actions) { delete this._swipeState[id]; return; }

    if (state.dir === 'x' && dx < -50) {
      // 左滑：显示操作按钮
      item.classList.add('swiped');
      actions.classList.add('show');
      const close = (ev) => {
        if (!ev.target.closest(`#wrap-${id}`)) {
          this.closeSwipe(id);
          document.removeEventListener('touchstart', close);
        }
      };
      setTimeout(() => document.addEventListener('touchstart', close), 100);
    } else if (state.dir === 'x' && dx > 50) {
      // 右滑：收起
      this.closeSwipe(id);
    }

    delete this._swipeState[id];
  },

  closeSwipe(id) {
    const item = document.getElementById(`item-${id}`);
    const actions = document.getElementById(`actions-${id}`);
    if (item) item.classList.remove('swiped');
    if (actions) actions.classList.remove('show');
  },

  openEditFromSwipe(id) {
    // 先收起滑动，等动画结束再开弹窗
    this.closeSwipe(id);
    setTimeout(() => this.showEditRecord(id), 250);
  },

  // ===== 从 Sheets 恢复 =====
  async restoreFromSheets() {
    const btn = document.getElementById('btn-restore');
    if (btn) btn.textContent = '恢复中…';
    const result = await Sheets.pullAndRestore();
    if (btn) btn.textContent = '从 Sheets 恢复记录↓';
    this.showToast(result.message);
    if (result.success) {
      this.updateHomeBalance();
      Charts.init();
    }
  },

  // ===== AI CHAT =====
  // 聊天历史持久化key
  CHAT_HISTORY_KEY: 'butler_chat_history',
  CHAT_MESSAGES_KEY: 'butler_chat_messages',

  setupAI() {
    // 恢复持久化的聊天历史
    try {
      this.chatHistory = JSON.parse(localStorage.getItem(this.CHAT_HISTORY_KEY)) || [];
    } catch { this.chatHistory = []; }

    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;
    this.updateCharacterDependentUI();

    // 恢复已渲染的消息HTML
    const savedHTML = localStorage.getItem(this.CHAT_MESSAGES_KEY);
    if (savedHTML) {
      messagesEl.innerHTML = savedHTML;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    } else {
      messagesEl.innerHTML = '';
      this.addButlerMessage(Character.getWelcomeMessage());
    }
  },

  // 保存聊天历史到localStorage
  saveChatHistory() {
    localStorage.setItem(this.CHAT_HISTORY_KEY, JSON.stringify(this.chatHistory.slice(-30)));
    const el = document.getElementById('chat-messages');
    if (el) localStorage.setItem(this.CHAT_MESSAGES_KEY, el.innerHTML);
  },

  // 清除聊天记录
  clearChatHistory() {
    this.chatHistory = [];
    localStorage.removeItem(this.CHAT_HISTORY_KEY);
    localStorage.removeItem(this.CHAT_MESSAGES_KEY);
    const el = document.getElementById('chat-messages');
    if (el) el.innerHTML = '';
    this.addButlerMessage(Character.getWelcomeMessage());
  },

  addButlerMessage(text, recordData = null) {
    const el = document.getElementById('chat-messages');
    if (!el) return;
    const butlerLabel = this.getButlerLabel();

    let html = `
      <div class="chat-bubble bubble-butler">
        <span class="butler-name">${butlerLabel}</span>
        ${text}
    `;

    if (recordData && recordData.understood) {
      const dateLabel = recordData.date && recordData.date !== new Date().toISOString().split('T')[0]
        ? `<div style="font-size:11px;color:var(--gold);margin-top:3px;font-family:var(--font-display);letter-spacing:1px;">📅 ${recordData.date}</div>`
        : '';
      html += `
        <div class="chat-record-preview">
          <div class="record-preview-info">
            <div>${recordData.emoji} ${recordData.category}</div>
            <div style="font-size:12px;color:#aaa;margin-top:2px;">${recordData.note || ''}</div>
            ${dateLabel}
          </div>
          <div>
            <div class="record-preview-amount ${recordData.type}">
              ${recordData.type==='expense'?'-':'+'}¥${recordData.amount}
            </div>
            <button class="btn-confirm-record" onclick="App.confirmAIRecord(${JSON.stringify(recordData).replace(/"/g,'&quot;')})">
              确认记录
            </button>
          </div>
        </div>
      `;
    }

    html += '</div>';
    el.insertAdjacentHTML('beforeend', html);
    el.scrollTop = el.scrollHeight;
  },

  addUserMessage(text) {
    const el = document.getElementById('chat-messages');
    if (!el) return;
    el.insertAdjacentHTML('beforeend', `
      <div class="chat-bubble bubble-user">${text}</div>
    `);
    el.scrollTop = el.scrollHeight;
  },

  showTyping() {
    const el = document.getElementById('chat-messages');
    if (!el) return;
    const butlerLabel = this.getButlerLabel();
    const div = document.createElement('div');
    div.id = 'typing-indicator';
    div.className = 'chat-bubble bubble-butler';
    div.innerHTML = `
      <span class="butler-name">${butlerLabel}</span>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
  },

  hideTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  },

  async sendChat() {
    const inputEl = document.getElementById('chat-input');
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = '';
    this.addUserMessage(text);
    this.chatHistory.push({ role: 'user', content: text });

    this.showTyping();

    const result = await AI.chat(text, this.chatHistory.slice(-6));
    this.hideTyping();

    this.chatHistory.push({ role: 'model', content: result.reply });
    this.addButlerMessage(result.reply, result.understood ? result : null);
    // 持久化保存
    this.saveChatHistory();
  },

  confirmAIRecord(data) {
    const record = {
      type: data.type,
      amount: parseFloat(data.amount),
      category: data.category,
      emoji: data.emoji,
      note: data.note || ''
    };
    // 如果AI解析出了日期，传入
    if (data.date) record.date = data.date;

    DB.saveRecord(record);
    this.updateHomeBalance();
    this.playRandomCharacterVoice();
    // 触发主页台词（回主页时）
    setTimeout(() => this.triggerEventQuote(record.type, parseFloat(data.amount)), 100);

    const dateStr = data.date ? `（${data.date}）` : '';
    this.addButlerMessage(`已为主人记录在册${dateStr}。✓`);
    document.querySelectorAll('.btn-confirm-record').forEach(b => b.remove());
  },

  handleChatKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendChat();
    }
  },

  // ===== CHARTS =====
  setupCharts() {
    const now = new Date();
    Charts.currentYear = now.getFullYear();
    Charts.currentMonth = now.getMonth();

    // Period buttons
    const periodEl = document.getElementById('period-selector');
    if (periodEl) {
      const months = [];
      for (let i = 0; i < 6; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ year: d.getFullYear(), month: d.getMonth(), label: `${d.getMonth()+1}月` });
      }
      periodEl.innerHTML = months.map((m, i) => `
        <button class="period-btn ${i===0?'active':''}"
          onclick="App.selectPeriod(${m.year},${m.month},this)">
          ${i===0?'本月':m.label}
        </button>
      `).join('');
    }
  },

  selectPeriod(year, month, el) {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    Charts.setMonth(year, month);
  },

  // ===== SAVINGS =====
  setupSavings() {
    // Emoji selector
    const emojiRow = document.getElementById('goal-emoji-row');
    if (emojiRow) {
      emojiRow.innerHTML = this.GOAL_EMOJIS.map(e => `
        <span class="emoji-opt ${e==='🎯'?'selected':''}"
          onclick="App.selectGoalEmoji('${e}',this)">${e}</span>
      `).join('');
    }

    this.savingsVideoEl = document.getElementById('savings-hero-video');
    this.savingsJarHeroEl = document.querySelector('.savings-jar-hero');
    this.savingsJarTriggerEl = document.querySelector('.savings-jar-trigger');
    this.bindSavingsJarTap();
    if (this.savingsVideoEl) {
      this.savingsVideoEl.muted = true;
      this.savingsVideoEl.loop = true;
      this.savingsVideoEl.playsInline = true;
    }

    if (!this._savingsVisibilityBound) {
      document.addEventListener('visibilitychange', () => this.syncSavingsHeroVideoPlayback());
      window.addEventListener('pagehide', () => this.pauseSavingsHeroVideo());
      window.addEventListener('resize', () => this.updateSavingsJarOverlay());
      this._savingsVisibilityBound = true;
    }

    this.updateSavingsJarOverlay();
    this.syncSavingsHeroVideoPlayback();
  },

  selectGoalEmoji(emoji, el) {
    document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    this.selectedGoalEmoji = emoji;
  },

  renderGoals() {
    const goals = DB.getGoals();
    const el = document.getElementById('goals-list');
    if (!el) return;

    if (!goals.length) {
      el.innerHTML = '<div class="goals-empty-state">暂无储蓄目标<br>点击罐子创建</div>';
      return;
    }

    el.innerHTML = goals.map(g => {
      const pct = Math.min(100, (g.saved / g.target) * 100).toFixed(1);
      return `
        <div class="goal-card">
          <div class="goal-header">
            <span class="goal-emoji">${g.emoji}</span>
            <div>
              <div class="goal-title">${g.name}</div>
              ${g.deadline ? `<div class="goal-deadline">目标：${g.deadline}</div>` : ''}
            </div>
            <div style="margin-left:auto;font-family:var(--font-display);font-size:13px;color:var(--gold-dark)">${pct}%</div>
          </div>
          <div class="goal-progress-bar">
            <div class="goal-progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="goal-amounts">
            <span class="goal-saved">已存 ¥${g.saved.toLocaleString()}</span>
            <span class="goal-target">目标 ¥${g.target.toLocaleString()}</span>
          </div>
          <div class="goal-actions">
            <button class="btn-goal-add" onclick="App.addToGoal('${g.id}')">+ 存入</button>
            <button class="btn-goal-delete" onclick="App.deleteGoal('${g.id}')">删除</button>
          </div>
        </div>
      `;
    }).join('');
  },

  showAddGoalModal() {
    document.getElementById('modal-goal').classList.add('open');
  },

  playSavingsHeroVideo() {
    if (!this.savingsVideoEl) return;
    const playPromise = this.savingsVideoEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  },

  pauseSavingsHeroVideo() {
    if (!this.savingsVideoEl) return;
    this.savingsVideoEl.pause();
  },

  bindSavingsJarTap() {
    if (this._savingsJarTapBound || !this.savingsJarTriggerEl) return;
    this._savingsJarTapBound = true;

    this.savingsJarTriggerEl.addEventListener('pointerup', event => this.onSavingsJarTap(event));
    this.savingsJarTriggerEl.addEventListener('click', event => this.onSavingsJarTap(event));
    this.savingsJarTriggerEl.addEventListener('keyup', event => {
      if (event.key === 'Enter' || event.key === ' ') this.onSavingsJarTap(event);
    });
  },

  updateSavingsJarOverlay() {
    if (!this.savingsJarHeroEl || !this.savingsJarTriggerEl) return;
    this.savingsJarTriggerEl.style.left = '0';
    this.savingsJarTriggerEl.style.top = '0';
    this.savingsJarTriggerEl.style.width = '100%';
    this.savingsJarTriggerEl.style.height = '100%';
  },

  getSavingsJarHitArea(containerWidth, containerHeight, paddingRatio = 0) {
    const sourceWidth = 510;
    const sourceHeight = 765;
    const bottleX = 241;
    const bottleY = 281;
    const bottleWidth = 269;
    const bottleHeight = 353;

    const scale = Math.max(containerWidth / sourceWidth, containerHeight / sourceHeight);
    const renderedWidth = sourceWidth * scale;
    const renderedHeight = sourceHeight * scale;
    const offsetX = (containerWidth - renderedWidth) / 2;
    const offsetY = (containerHeight - renderedHeight) / 2;
    const left = offsetX + bottleX * scale;
    const top = offsetY + bottleY * scale;
    const width = bottleWidth * scale;
    const height = bottleHeight * scale;
    const padX = width * paddingRatio;
    const padY = height * paddingRatio;

    return {
      left: left - padX,
      top: top - padY,
      right: left + width + padX,
      bottom: top + height + padY,
    };
  },

  getPointFromEvent(event) {
    if (!event) return null;
    if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
      return { x: event.clientX, y: event.clientY };
    }
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (touch && typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
      return { x: touch.clientX, y: touch.clientY };
    }
    return null;
  },

  onSavingsJarTap(event) {
    this.ensureBGMPlayback();
    if (event) event.preventDefault();

    const now = Date.now();
    if (now - this._lastSavingsJarOpenAt < 300) return;

    if (!this.savingsJarHeroEl) {
      this._lastSavingsJarOpenAt = now;
      this.showDepositModal();
      return;
    }

    const point = this.getPointFromEvent(event);
    if (!point) {
      this._lastSavingsJarOpenAt = now;
      this.showDepositModal();
      return;
    }

    const rect = this.savingsJarHeroEl.getBoundingClientRect();
    const x = point.x - rect.left;
    const y = point.y - rect.top;
    const hitArea = this.getSavingsJarHitArea(rect.width, rect.height, 0.28);
    const broadBottleZone = (
      x >= rect.width * 0.42 &&
      y >= rect.height * 0.24
    );

    if (
      (x >= hitArea.left && x <= hitArea.right && y >= hitArea.top && y <= hitArea.bottom) ||
      broadBottleZone
    ) {
      this._lastSavingsJarOpenAt = now;
      this.showDepositModal();
    }
  },

  syncSavingsHeroVideoPlayback() {
    if (!this.savingsVideoEl) return;

    const shouldPlay = this.currentScreen === 'savings' && !document.hidden;
    if (shouldPlay) {
      this.playSavingsHeroVideo();
      return;
    }

    this.pauseSavingsHeroVideo();
  },

  closeModal(id) {
    document.getElementById(id).classList.remove('open');
  },

  saveNewGoal() {
    const nameEl   = document.getElementById('goal-name-input');
    const targetEl = document.getElementById('goal-target-input');
    const deadlineEl = document.getElementById('goal-deadline-input');

    const name   = nameEl?.value.trim();
    const target = parseFloat(targetEl?.value);
    const deadline = deadlineEl?.value;

    if (!name || !target || target <= 0) {
      this.showToast('请填写目标名称和金额');
      return;
    }

    DB.saveGoal({ name, target, emoji: this.selectedGoalEmoji, deadline });
    this.closeModal('modal-goal');
    if (nameEl)   nameEl.value = '';
    if (targetEl) targetEl.value = '';
    if (deadlineEl) deadlineEl.value = '';
    this.renderGoals();
    this.showToast('储蓄目标已创建 ✓');
  },

  // "+ 存入" button on each goal card opens deposit modal pre-selecting that goal
  addToGoal(id) {
    this.showDepositModal(id);
  },

  // Jar tap or "+ 存入": open deposit modal. Calls showAddGoalModal if no goals exist.
  showDepositModal(preselectedId = null) {
    const goals = DB.getGoals();
    if (!goals.length) { this.showAddGoalModal(); return; }

    this._selectedDepositGoalId = preselectedId || (goals.length === 1 ? goals[0].id : null);

    const listEl = document.getElementById('deposit-goal-list');
    if (listEl) {
      listEl.innerHTML = goals.map(g => {
        const pct = Math.min(100, (g.saved / g.target) * 100).toFixed(1);
        const sel = g.id === this._selectedDepositGoalId ? 'selected' : '';
        return `
          <div class="deposit-goal-item ${sel}" onclick="App._selectDepositGoal('${g.id}',this)">
            <span class="deposit-goal-emoji">${g.emoji}</span>
            <span class="deposit-goal-name">${g.name}</span>
            <span class="deposit-goal-meta">¥${g.saved.toLocaleString()}<br>${pct}%</span>
          </div>`;
      }).join('');
    }
    const amountEl = document.getElementById('deposit-amount');
    if (amountEl) amountEl.value = '';
    document.getElementById('modal-deposit').classList.add('open');
    setTimeout(() => { if (amountEl) amountEl.focus(); }, 360);
  },

  _selectDepositGoal(id, el) {
    this._selectedDepositGoalId = id;
    document.querySelectorAll('.deposit-goal-item').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
  },

  confirmDeposit() {
    if (!this._selectedDepositGoalId) { this.showToast('请先选择储蓄目标'); return; }
    const amountEl = document.getElementById('deposit-amount');
    const amount = parseFloat(amountEl?.value || '0');
    if (!amount || amount <= 0) { this.showToast('请输入存入金额'); return; }

    const goal = DB.getGoals().find(g => g.id === this._selectedDepositGoalId);
    if (!goal) return;
    const newSaved = goal.saved + amount;
    DB.updateGoal(this._selectedDepositGoalId, { saved: newSaved });
    this._selectedDepositGoalId = null;
    this.closeModal('modal-deposit');
    this.renderGoals();
    this.showToast(`已存入 ¥${amount.toLocaleString()} ✓`);

    if (newSaved >= goal.target) {
      setTimeout(() => ButlerDialog.onGoalComplete(), 400);
    } else if (goal.deadline) {
      const daysLeft = Math.ceil((new Date(goal.deadline + '-01') - new Date()) / 86400000);
      if (daysLeft <= 7 && daysLeft > 0) setTimeout(() => ButlerDialog.onGoalUrgent(), 400);
    }
  },

  deleteGoal(id) {
    this._pendingDeleteGoalId = id;
    document.getElementById('modal-delete-goal').classList.add('open');
  },

  confirmDeleteGoal() {
    if (!this._pendingDeleteGoalId) return;
    DB.deleteGoal(this._pendingDeleteGoalId);
    this._pendingDeleteGoalId = null;
    this.closeModal('modal-delete-goal');
    this.renderGoals();
    this.showToast('已删除');
  },

  // ===== SETTINGS =====
  PROVIDER_HINTS: {
    gemini:     '前往 aistudio.google.com 免费获取，每天1500次免费额度',
    deepseek:   '前往 platform.deepseek.com 注册，注册送额度，价格极低（推荐）',
    groq:       '前往 console.groq.com 注册，免费额度充足，响应速度极快',
    openrouter: '前往 openrouter.ai 注册，支持多种模型按量付费'
  },

  setupSettings() {
    const settings = DB.getSettings();

    // AI provider
    const providerEl = document.getElementById('ai-provider-select');
    if (providerEl) providerEl.value = settings.aiProvider || 'gemini';
    this.onProviderChange();

    // API key (masked)
    const keyEl = document.getElementById('api-key-input');
    if (keyEl) keyEl.value = settings.aiKey ? '••••••••••••••••' : '';

    // Sheets URL
    const sheetsEl = document.getElementById('sheets-url-input');
    if (sheetsEl) sheetsEl.placeholder = Sheets.DEFAULT_URL.substring(0, 50) + '…（已内置）';

    const bgmToggleEl = document.getElementById('bgm-enabled-toggle');
    if (bgmToggleEl) bgmToggleEl.checked = settings.bgmEnabled !== false;

    const bgmVolume = Number.isFinite(Number(settings.bgmVolume))
      ? Math.round(Number(settings.bgmVolume) * 100)
      : Math.round(this.DEFAULT_BGM_VOLUME * 100);
    const bgmSliderEl = document.getElementById('bgm-volume-slider');
    if (bgmSliderEl) bgmSliderEl.value = String(bgmVolume);
    this.updateBGMVolumeLabel(bgmVolume);

    // Check sheets status
    this.checkSheetsStatus();
  },

  toggleBGM(enabled) {
    DB.saveSetting('bgmEnabled', !!enabled);
    if (window.AudioManager) {
      if (enabled) this.ensureBGMPlayback();
      window.AudioManager.setBGMEnabled(enabled);
    }
    this.showToast(enabled ? '背景音乐已开启' : '背景音乐已关闭');
  },

  setBGMVolume(value) {
    const percent = Math.max(0, Math.min(100, Number(value) || 0));
    DB.saveSetting('bgmVolume', percent / 100);
    this.updateBGMVolumeLabel(percent);
    if (window.AudioManager) window.AudioManager.setBGMVolume(percent / 100);
  },

  updateBGMVolumeLabel(percent) {
    const label = document.getElementById('bgm-volume-value');
    if (label) label.textContent = `${Math.round(percent)}%`;
  },

  onProviderChange() {
    const provider = document.getElementById('ai-provider-select')?.value || 'gemini';
    const hint = document.getElementById('provider-hint');
    if (hint) hint.textContent = this.PROVIDER_HINTS[provider] || '';
  },

  saveApiKey() {
    const keyEl = document.getElementById('api-key-input');
    const providerEl = document.getElementById('ai-provider-select');
    const key = keyEl?.value.trim();
    const provider = providerEl?.value || 'gemini';
    if (!key || key.startsWith('•')) { this.showToast('请输入有效的 API Key'); return; }
    DB.saveSetting('aiKey', key);
    DB.saveSetting('aiProvider', provider);
    if (keyEl) keyEl.value = '••••••••••••••••';
    this.showToast(`${provider} API Key 已保存 ✓`);
  },

  saveSheetsUrl() {
    const el = document.getElementById('sheets-url-input');
    const url = el?.value.trim();
    if (!url) { this.showToast('请输入 Apps Script URL'); return; }
    DB.saveSetting('sheetsUrl', url);
    this.showToast('Sheets URL 已保存 ✓');
    this.checkSheetsStatus();
  },

  async checkSheetsStatus() {
    const dot  = document.getElementById('sheets-status-dot');
    const text = document.getElementById('sheets-status-text');
    if (!dot || !text) return;
    dot.style.background = '#f0c040';
    text.textContent = '连接中…';
    try {
      const url = Sheets.getURL();
      const res = await fetch(url + '?action=ping', { mode: 'cors', signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        dot.style.background = '#5bc47a';
        text.textContent = '已连接 · 每次记账自动同步';
      } else {
        dot.style.background = '#e07070';
        text.textContent = `连接失败 (HTTP ${res.status})`;
      }
    } catch {
      // Network/CORS error — POST sync may still work (no-cors)
      dot.style.background = '#f0c040';
      text.textContent = '网络受限 · 记账仍会静默同步';
    }
  },

  async syncAllToSheets() {
    const btn = document.getElementById('btn-sync-all');
    if (btn) btn.textContent = '同步中…';
    const result = await Sheets.pushAll();
    if (btn) btn.textContent = '全量同步';
    this.showToast(result.message);
  },

  exportData() {
    const data = DB.exportJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `butler-finance-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('数据已导出');
  },

  // ===== TOAST =====
  showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }
};

// Init on load
window.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
