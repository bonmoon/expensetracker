// ===== 执事对话框系统 =====
const ButlerDialog = {
  hideTimer: null,
  typeTimer: null,

  // 显示对话框，打字机效果
  show(text, duration = 4000) {
    const dialog = document.getElementById('butler-dialog');
    const textEl  = document.getElementById('butler-dialog-text');
    const nameEl = document.getElementById('butler-dialog-name');
    if (!dialog || !textEl) return;
    if (nameEl && window.Character) {
      nameEl.textContent = Character.getCurrent()?.title || '執事';
    }

    // 清除之前的定时器
    clearTimeout(this.hideTimer);
    clearTimeout(this.typeTimer);

    // 重置
    textEl.innerHTML = '';
    dialog.classList.add('show');

    // 打字机效果
    let i = 0;
    const type = () => {
      if (i < text.length) {
        const span = document.createElement('span');
        span.className = 'typing-char';
        span.style.animationDelay = '0s';
        span.textContent = text[i];
        textEl.appendChild(span);
        i++;
        // 标点符号停顿长一点
        const delay = '，。！？'.includes(text[i-1]) ? 180 : 45;
        this.typeTimer = setTimeout(type, delay);
      }
    };
    type();

    // 自动隐藏
    if (duration > 0) {
      this.hideTimer = setTimeout(() => this.hide(), duration + text.length * 45);
    }
  },

  hide() {
    const dialog = document.getElementById('butler-dialog');
    if (dialog) dialog.classList.remove('show');
  },

  // ===== 各场景触发 =====

  // 记账时触发
  onRecord(type, amount) {
    let eventName = 'afterRecord';
    if (type === 'income') eventName = 'income';
    else if (amount >= 500) eventName = 'bigExpense';
    this.show(Character.getQuote(eventName), 5000);
  },

  // 进入主页时问候
  onHomeEnter() {
    // 延迟1.5秒再出现，让进场动画先完成
    setTimeout(() => this.show(Character.getQuote('time'), 5000), 1500);
  },

  // 储蓄目标相关
  onGoalComplete() {
    this.show('恭喜主人！储蓄目标已完成。', 6000);
  },

  onGoalUrgent() {
    this.show('主人，储蓄目标的期限快到了，需要加把劲哦。', 5000);
  },
};

window.ButlerDialog = ButlerDialog;
