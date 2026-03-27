const DB = {
  KEY_RECORDS:  'butler_records',
  KEY_DELETED:  'butler_deleted_ids', // 已删除ID黑名单
  KEY_GOALS:    'butler_goals',
  KEY_SETTINGS: 'butler_settings',

  getRecords() {
    try { return JSON.parse(localStorage.getItem(this.KEY_RECORDS)) || []; }
    catch { return []; }
  },

  getDeletedIds() {
    try { return JSON.parse(localStorage.getItem(this.KEY_DELETED)) || []; }
    catch { return []; }
  },

  saveRecord(record) {
    const records = this.getRecords();
    record.id = Date.now().toString();
    if (record.date && /^\d{4}-\d{2}-\d{2}$/.test(record.date)) {
      const now = new Date();
      const t = `T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:00`;
      record.createdAt = record.date + t;
      delete record.date;
    } else {
      record.createdAt = new Date().toISOString();
    }
    records.unshift(record);
    records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    localStorage.setItem(this.KEY_RECORDS, JSON.stringify(records));
    if (window.Sheets) Sheets.pushRecord(record);
    return record;
  },

  updateRecord(id, updates) {
    let updatedRecord = null;
    const records = this.getRecords().map(record => {
      if (record.id !== id) return record;
      updatedRecord = { ...record, ...updates };
      return updatedRecord;
    });
    if (!updatedRecord) return null;

    records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    localStorage.setItem(this.KEY_RECORDS, JSON.stringify(records));
    if (window.Sheets) Sheets.replaceRecord(updatedRecord);
    return updatedRecord;
  },

  deleteRecord(id) {
    // 从本地移除
    const records = this.getRecords().filter(r => r.id !== id);
    localStorage.setItem(this.KEY_RECORDS, JSON.stringify(records));
    // 记入黑名单
    const deleted = this.getDeletedIds();
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem(this.KEY_DELETED, JSON.stringify(deleted));
    }
    // 同步删除到Sheets
    if (window.Sheets) Sheets.deleteRecord(id);
  },

  getGoals() {
    try { return JSON.parse(localStorage.getItem(this.KEY_GOALS)) || []; }
    catch { return []; }
  },

  saveGoal(goal) {
    const goals = this.getGoals();
    goal.id = Date.now().toString();
    goal.createdAt = new Date().toISOString();
    goal.saved = 0;
    goals.push(goal);
    localStorage.setItem(this.KEY_GOALS, JSON.stringify(goals));
    return goal;
  },

  updateGoal(id, updates) {
    const goals = this.getGoals().map(g => g.id === id ? {...g,...updates} : g);
    localStorage.setItem(this.KEY_GOALS, JSON.stringify(goals));
  },

  deleteGoal(id) {
    const goals = this.getGoals().filter(g => g.id !== id);
    localStorage.setItem(this.KEY_GOALS, JSON.stringify(goals));
  },

  getSettings() {
    try { return JSON.parse(localStorage.getItem(this.KEY_SETTINGS)) || {}; }
    catch { return {}; }
  },

  saveSetting(key, value) {
    const s = this.getSettings();
    s[key] = value;
    localStorage.setItem(this.KEY_SETTINGS, JSON.stringify(s));
  },

  getMonthRecords(year, month) {
    return this.getRecords().filter(r => {
      const d = new Date(r.createdAt);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  },

  getMonthSummary(year, month) {
    const records = this.getMonthRecords(year, month);
    const income  = records.filter(r => r.type==='income').reduce((s,r)=>s+r.amount,0);
    const expense = records.filter(r => r.type==='expense').reduce((s,r)=>s+r.amount,0);
    return { income, expense, balance: income-expense, records };
  },

  getCategoryTotals(year, month) {
    const records = this.getMonthRecords(year, month);
    const totals = {};
    records.forEach(r => {
      if (!totals[r.category]) totals[r.category] = { income:0, expense:0, emoji:r.emoji };
      totals[r.category][r.type] += r.amount;
    });
    return totals;
  },

  exportJSON() {
    return JSON.stringify({ records: this.getRecords(), goals: this.getGoals(), exportedAt: new Date().toISOString() }, null, 2);
  }
};
window.DB = DB;
