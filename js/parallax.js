const Parallax = {
  // baseX: 初始水平偏移（替代CSS里的translateX）
  // baseY: 初始垂直偏移
  LAYERS: [
    { id: 'layer-bg',    depth: 0.005, baseX: '0%',   baseY: '0%' },
    { id: 'layer-stars', depth: 0.012, baseX: '0%',   baseY: '0%' },
    { id: 'layer-char',  depth: 0.02, baseX: '0%', baseY: '0%' },
    { id: 'layer-raven', depth: 0.032, baseX: '-50%', baseY: '0%' },
    { id: 'layer-book',  depth: 0.045, baseX: '-72%', baseY: '0%' },
  ],

  els: [],
  isRunning: false,
  cx: 0, cy: 0,
  curX: 0, curY: 0,
  tgtX: 0, tgtY: 0,
  idleT: 0,
  userActive: false,
  timer: null,

  init() {
    this.cx = window.innerWidth / 2;
    this.cy = window.innerHeight / 2;

    this.els = this.LAYERS.map(l => ({
      el: document.getElementById(l.id),
      depth: l.depth,
      baseX: l.baseX,
      baseY: l.baseY,
    }));

    // 初始化时立即设置各层的基础transform
    this.els.forEach(({ el, baseX, baseY }) => {
      if (!el) return;
      if (el.id === 'layer-char') {
        el.style.setProperty('--px', '0px');
        el.style.setProperty('--py', '0px');
      } else {
        el.style.transform = `translateX(${baseX}) translateY(${baseY})`;
      }
    });

    // 陀螺仪
    if (window.DeviceOrientationEvent) {
      const req = DeviceOrientationEvent.requestPermission;
      if (typeof req === 'function') {
        document.addEventListener('touchstart', () => {
          req().then(s => {
            if (s === 'granted') window.addEventListener('deviceorientation', e => this.onGyro(e), true);
          }).catch(() => {});
        }, { once: true });
      } else {
        window.addEventListener('deviceorientation', e => this.onGyro(e), true);
      }
    }

    // 鼠标 - throttled for mobile performance
    let lastMouseUpdate = 0;
    window.addEventListener('mousemove', e => {
      const now = Date.now();
      if (now - lastMouseUpdate < 32) return; // throttle to ~30fps
      lastMouseUpdate = now;
      this.tgtX = (e.clientX - this.cx) * 0.4;
      this.tgtY = (e.clientY - this.cy) * 0.4;
      this.bump();
    });

    // 触摸 - throttled for mobile performance
    let lastTouchUpdate = 0;
    window.addEventListener('touchmove', e => {
      if (!e.touches[0]) return;
      const now = Date.now();
      if (now - lastTouchUpdate < 48) return; // throttle to ~20fps on touch
      lastTouchUpdate = now;
      this.tgtX = (e.touches[0].clientX - this.cx) * 0.35;
      this.tgtY = (e.touches[0].clientY - this.cy) * 0.35;
      this.bump();
    }, { passive: true });

    this.isRunning = true;
    this.loop();
  },

  onGyro(e) {
    if (e.gamma == null) return;
    this.tgtX = Math.max(-40, Math.min(40, e.gamma)) * 4;
    this.tgtY = Math.max(-40, Math.min(40, (e.beta || 0) - 45)) * 2.5;
    this.bump();
  },

  bump() {
    this.userActive = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.userActive = false; }, 2500);
  },

  loop() {
    if (!this.isRunning) return;

    // 闲置浮动
    if (!this.userActive) {
      this.idleT += 0.005;
      this.tgtX = Math.sin(this.idleT * 0.7) * 18;
      this.tgtY = Math.sin(this.idleT * 0.4) * 10;
    }

    this.curX += (this.tgtX - this.curX) * 0.05;
    this.curY += (this.tgtY - this.curY) * 0.05;

    this.els.forEach(({ el, depth, baseX, baseY }) => {
      if (!el) return;
      const dx = this.curX * depth;
      const dy = this.curY * depth;
      if (el.id === 'layer-char') {
        el.style.setProperty('--px', `${dx}px`);
        el.style.setProperty('--py', `${dy}px`);
      } else {
        // 把基础偏移和视差偏移合并进同一个transform
        el.style.transform = `translateX(calc(${baseX} + ${dx}px)) translateY(calc(${baseY} + ${dy}px))`;
      }
    });

    requestAnimationFrame(() => this.loop());
  },

  startLoop() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.loop();
    }
  },

  stop() { this.isRunning = false; }
};
window.Parallax = Parallax;
