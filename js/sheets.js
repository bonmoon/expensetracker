const Sheets = {
  DEFAULT_URL: 'https://script.google.com/macros/s/AKfycbzqzZlUFnvdRzBCUf5F-sv853bF9kOYD9deVjYps24Bk5nlkOKlIdIWDI04HF93swpr/exec',

  getURL() { return DB.getSettings().sheetsUrl || this.DEFAULT_URL; },

  async pushRecord(record) {
    const url = this.getURL();
    if (!url) return;
    try {
      await fetch(url, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addRecord', record })
      });
    } catch(e) {}
  },

  // 删除Sheets里的记录
  async deleteRecord(id) {
    const url = this.getURL();
    if (!url) return;
    try {
      await fetch(url, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteRecord', id })
      });
    } catch(e) {}
  },

  async pushAll() {
    const url = this.getURL();
    if (!url) return { success: false, message: '未设置 URL' };
    const records = DB.getRecords();
    if (!records.length) return { success: true, message: '暂无记录' };
    let count = 0;
    for (const record of records) {
      try {
        await fetch(url, {
          method: 'POST', mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'addRecord', record })
        });
        count++;
        await new Promise(r => setTimeout(r, 120));
      } catch(e) {}
    }
    return { success: true, message: `已同步 ${count} 条记录` };
  },

  // 从Sheets恢复，自动过滤本地已删除的记录
  async pullAndRestore() {
    const url = this.getURL();
    if (!url) return { success: false, message: '未设置 URL' };
    try {
      const res = await fetch(url + '?action=getAll', { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return { success: false, message: 'Sheets 暂无数据' };

      // 过滤：已在本地黑名单的ID不恢复
      const deletedIds = new Set(DB.getDeletedIds());
      const valid = data.filter(r => r.id && r.amount && r.type && !deletedIds.has(r.id));
      if (!valid.length) return { success: false, message: '无新记录可恢复' };

      // 合并本地新记录
      const local = DB.getRecords();
      const sheetIds = new Set(valid.map(r => r.id));
      const localOnly = local.filter(r => !sheetIds.has(r.id));
      const merged = [...valid, ...localOnly];
      merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      localStorage.setItem(DB.KEY_RECORDS, JSON.stringify(merged));
      return { success: true, message: `已恢复 ${valid.length} 条记录` };
    } catch(e) {
      return { success: false, message: `拉取失败: ${e.message}` };
    }
  }
};
window.Sheets = Sheets;
