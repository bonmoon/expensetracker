const DB = {
  KEY_RECORDS:  'butler_records',
  KEY_DELETED:  'butler_deleted_ids', // 已删除ID黑名单
  KEY_DELETED_SIGS: 'butler_deleted_signatures',
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

  getDeletedSignatures() {
    try { return JSON.parse(localStorage.getItem(this.KEY_DELETED_SIGS)) || []; }
    catch { return []; }
  },

  normalizeRecord(record) {
    if (!record) return null;
    return {
      ...record,
      amount: Number(record.amount || 0),
      note: record.note || '',
      emoji: record.emoji || '',
      category: record.category || '',
      type: record.type || '',
      createdAt: record.createdAt || '',
    };
  },

  recordSignature(record) {
    const normalized = this.normalizeRecord(record);
    if (!normalized) return '';
    return [
      normalized.createdAt,
      normalized.type,
      normalized.amount,
      normalized.category,
      normalized.note,
      normalized.emoji,
    ].join('::');
  },

  dedupeRecords(records) {
    const seenIds = new Set();
    const seenSigs = new Set();
    const normalized = records
      .map(record => this.normalizeRecord(record))
      .filter(record => record && record.createdAt && record.type && Number.isFinite(record.amount));

    normalized.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return normalized.filter(record => {
      const signature = this.recordSignature(record);
      if (record.id && seenIds.has(record.id)) return false;
      if (signature && seenSigs.has(signature)) return false;
      if (record.id) seenIds.add(record.id);
      if (signature) seenSigs.add(signature);
      return true;
    });
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
    records.unshift(this.normalizeRecord(record));
    localStorage.setItem(this.KEY_RECORDS, JSON.stringify(this.dedupeRecords(records)));
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

    localStorage.setItem(this.KEY_RECORDS, JSON.stringify(this.dedupeRecords(records)));
    if (window.Sheets) Sheets.replaceRecord(updatedRecord);
    return updatedRecord;
  },

  deleteRecord(id) {
    const existing = this.getRecords().find(r => r.id === id);
    // 从本地移除
    const records = this.getRecords().filter(r => r.id !== id);
    localStorage.setItem(this.KEY_RECORDS, JSON.stringify(records));
    // 记入黑名单
    const deleted = this.getDeletedIds();
    if (!deleted.includes(id)) {
      deleted.push(id);
      localStorage.setItem(this.KEY_DELETED, JSON.stringify(deleted));
    }
    if (existing) {
      const signatures = this.getDeletedSignatures();
      const signature = this.recordSignature(existing);
      if (signature && !signatures.includes(signature)) {
        signatures.push(signature);
        localStorage.setItem(this.KEY_DELETED_SIGS, JSON.stringify(signatures));
      }
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
