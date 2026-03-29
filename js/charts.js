// ===== CHARTS MODULE =====
const Charts = {
  pieChart: null,
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  detailFilter: 'all',

  CATEGORY_COLORS: [
    '#c9a84c','#8b6914','#e07070','#7ec8a0',
    '#7ab0d4','#d4a07a','#a07ad4','#d47ab0',
  ],

  init() {
    this.renderSummary();
    this.renderBarChart();
    this.renderPieChart();
    this.renderRecentList();
  },

  setMonth(year, month) {
    this.currentYear = year;
    this.currentMonth = month;
    this.init();
  },

  setDetailFilter(filter) {
    this.detailFilter = filter || 'all';
    this.renderSummary();
    this.renderRecentList();
  },

  renderSummary() {
    const { income, expense, balance } = DB.getMonthSummary(this.currentYear, this.currentMonth);
    const el = document.getElementById('summary-stats');
    if (!el) return;
    el.innerHTML = `
      <button class="summary-stat ${this.detailFilter==='income' ? 'active' : ''}" type="button" onclick="Charts.setDetailFilter('income')">
        <div class="stat-label">本月收入</div>
        <div class="stat-value income">¥${income.toLocaleString()}</div>
      </button>
      <button class="summary-stat ${this.detailFilter==='expense' ? 'active' : ''}" type="button" onclick="Charts.setDetailFilter('expense')">
        <div class="stat-label">本月支出</div>
        <div class="stat-value expense">¥${expense.toLocaleString()}</div>
      </button>
      <button class="summary-stat ${this.detailFilter==='all' ? 'active' : ''}" type="button" onclick="Charts.setDetailFilter('all')">
        <div class="stat-label">净结余</div>
        <div class="stat-value balance" style="color:${balance>=0?'#3a8a60':'#c04040'}">
          ${balance>=0?'+':''}¥${balance.toLocaleString()}
        </div>
      </button>
    `;
  },

  renderBarChart() {
    const totals = DB.getCategoryTotals(this.currentYear, this.currentMonth);
    const el = document.getElementById('bar-chart');
    if (!el) return;
    const entries = Object.entries(totals)
      .map(([cat, data]) => ({ cat, ...data }))
      .sort((a, b) => (b.expense + b.income) - (a.expense + a.income))
      .slice(0, 6);
    if (!entries.length) {
      el.innerHTML = '<div style="text-align:center;color:#aaa;font-style:italic;padding:20px;font-family:var(--font-body);">本月暂无记录</div>';
      return;
    }
    const maxVal = Math.max(...entries.map(e => e.expense + e.income));
    el.innerHTML = entries.map(({ cat, expense, income, emoji }) => {
      const total = expense + income;
      const pct = maxVal > 0 ? (total / maxVal) * 100 : 0;
      const isExpense = expense >= income;
      return `
        <div class="bar-row">
          <div class="bar-label">${emoji}${cat}</div>
          <div class="bar-track">
            <div class="bar-fill ${isExpense?'expense':'income'}" style="width:${pct}%"></div>
          </div>
          <div class="bar-amount">¥${total.toLocaleString()}</div>
        </div>`;
    }).join('');
  },

  renderPieChart() {
    const totals = DB.getCategoryTotals(this.currentYear, this.currentMonth);
    const canvas = document.getElementById('pieChart');
    if (!canvas) return;
    const expenseEntries = Object.entries(totals)
      .filter(([,d]) => d.expense > 0)
      .sort((a,b) => b[1].expense - a[1].expense)
      .slice(0, 6);
    const legend = document.getElementById('pie-legend');
    if (!expenseEntries.length) {
      canvas.style.display = 'none';
      if (legend) legend.innerHTML = '<div style="color:#aaa;font-style:italic;font-size:13px;">暂无支出数据</div>';
      return;
    }
    canvas.style.display = 'block';
    const total = expenseEntries.reduce((s,[,d]) => s + d.expense, 0);
    const ctx = canvas.getContext('2d');
    const size = 130;
    canvas.width = size; canvas.height = size;
    const cx = size/2, cy = size/2, r = size/2 - 6;
    ctx.clearRect(0, 0, size, size);
    let angle = -Math.PI / 2;
    expenseEntries.forEach(([,d], i) => {
      const slice = (d.expense / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + slice);
      ctx.closePath();
      ctx.fillStyle = this.CATEGORY_COLORS[i % this.CATEGORY_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = '#f5ead8'; ctx.lineWidth = 2; ctx.stroke();
      angle += slice;
    });
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#f5ead8'; ctx.fill();
    if (legend) {
      legend.innerHTML = expenseEntries.map(([cat, d], i) => `
        <div class="legend-item">
          <div class="legend-dot" style="background:${this.CATEGORY_COLORS[i % this.CATEGORY_COLORS.length]}"></div>
          <span>${d.emoji}${cat}</span>
          <span style="margin-left:auto;font-weight:600">¥${d.expense.toLocaleString()}</span>
        </div>`).join('');
    }
  },

  renderRecentList() {
    const records = DB.getMonthSummary(this.currentYear, this.currentMonth).records
      .filter(record => {
        if (this.detailFilter === 'all') return true;
        return record.type === this.detailFilter;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const el = document.getElementById('recent-list');
    const title = document.getElementById('record-detail-title');
    const hint = document.getElementById('record-detail-hint');
    if (!el) return;
    if (title) {
      title.textContent = this.detailFilter === 'income'
        ? '本月收入明细'
        : this.detailFilter === 'expense'
          ? '本月支出明细'
          : '本月全部明细';
    }
    if (hint) {
      hint.textContent = this.detailFilter === 'all'
        ? '按日期查看本月全部记录，点任一记录可直接编辑。'
        : `按日期查看本月${this.detailFilter === 'income' ? '收入' : '支出'}记录，点任一记录可直接编辑。`;
    }

    if (!records.length) {
      el.innerHTML = '<div style="text-align:center;color:#aaa;font-style:italic;padding:20px;font-family:var(--font-body);">这个筛选下暂无记录</div>';
      return;
    }

    const formatter = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' });
    const grouped = records.reduce((groups, record) => {
      const key = String(record.createdAt).slice(0, 10);
      if (!groups[key]) groups[key] = [];
      groups[key].push(record);
      return groups;
    }, {});

    el.innerHTML = Object.entries(grouped).map(([dateKey, items]) => `
      <section class="record-date-group">
        <div class="record-date-group-label">${formatter.format(new Date(dateKey))}</div>
        ${items.map(r => {
          const d = new Date(r.createdAt);
          const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
          const signature = encodeURIComponent(DB.recordSignature(r));
          return `
            <div class="record-swipe-wrapper" id="wrap-${r.id}">
              <div class="record-swipe-actions" id="actions-${r.id}">
                <button class="swipe-btn-edit" onclick="event.stopPropagation(); App.openEditFromSwipe('${r.id}', '${signature}')">编辑</button>
                <button class="swipe-btn-delete" onclick="App.deleteRecordByIdentity('${r.id}', '${signature}', event)">删除</button>
              </div>
              <div class="record-item record-item-swipeable record-item-editable" id="item-${r.id}"
                data-id="${r.id}"
                onclick="App.showEditRecord('${r.id}', '${signature}')"
                ontouchstart="App.swipeStart(event,'${r.id}')"
                ontouchmove="App.swipeMove(event,'${r.id}')"
                ontouchend="App.swipeEnd(event,'${r.id}')">
                <div class="record-emoji">${r.emoji}</div>
                <div class="record-info">
                  <div class="record-cat">${r.category}</div>
                  ${r.note ? `<div class="record-note">${r.note}</div>` : ''}
                  <div class="record-date">${timeStr}</div>
                </div>
                <div class="record-amount ${r.type}">
                  ${r.type==='expense'?'-':'+'}¥${r.amount.toLocaleString()}
                </div>
              </div>
            </div>`;
        }).join('')}
      </section>
    `).join('');

    // 初始化滑动状态
    App._swipeState = {};
  }
};
window.Charts = Charts;
