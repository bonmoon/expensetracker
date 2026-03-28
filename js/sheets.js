const Sheets = {
  getURL() {
    return (DB.getSettings().sheetsUrl || '').trim();
  },

  isConfigured() {
    return !!this.getURL();
  },

  async postAction(action, payload = {}) {
    const url = this.getURL();
    if (!url) return { success: false, message: '未绑定 Sheets URL' };

    const body = JSON.stringify({ action, ...payload });
    const request = {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    };

    try {
      const res = await fetch(url, request);
      return { success: res.ok, status: res.status };
    } catch {
      try {
        await fetch(url, { ...request, mode: 'no-cors' });
        return { success: true, status: 0 };
      } catch (error) {
        return { success: false, message: error.message };
      }
    }
  },

  async pushRecord(record) {
    if (!this.isConfigured()) return;
    await this.postAction('addRecord', { record: DB.normalizeRecord(record) });
  },

  async replaceRecord(record) {
    if (!record?.id || !this.isConfigured()) return;
    await this.deleteRecord(record.id);
    await new Promise(resolve => setTimeout(resolve, 120));
    await this.pushRecord(record);
  },

  async deleteRecord(id) {
    if (!id || !this.isConfigured()) return;
    await this.postAction('deleteRecord', { id });
  },

  async pullAndRestore() {
    const url = this.getURL();
    if (!url) return { success: false, message: '请先绑定您的 Sheets URL' };

    try {
      const res = await fetch(url + '?action=getAll', { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) return { success: false, message: 'Sheets 暂无数据' };

      const deletedIds = new Set(DB.getDeletedIds());
      const deletedSignatures = new Set(DB.getDeletedSignatures());
      const local = DB.getRecords();
      const localKeys = new Set(
        local.flatMap(record => {
          const signature = DB.recordSignature(record);
          return [record.id, signature].filter(Boolean);
        })
      );

      const incoming = DB.dedupeRecords(data).filter(record => {
        if (!record.id || !record.type || !Number.isFinite(record.amount)) return false;
        const signature = DB.recordSignature(record);
        if (deletedIds.has(record.id)) return false;
        if (deletedSignatures.has(signature)) return false;
        return true;
      });

      const merged = DB.dedupeRecords([...local, ...incoming]);
      localStorage.setItem(DB.KEY_RECORDS, JSON.stringify(merged));

      const restoredCount = incoming.filter(record => {
        const signature = DB.recordSignature(record);
        return !localKeys.has(record.id) && !localKeys.has(signature);
      }).length;

      if (!restoredCount) return { success: false, message: '无新记录可恢复' };
      return { success: true, message: `已恢复 ${restoredCount} 条记录` };
    } catch (error) {
      return { success: false, message: `拉取失败: ${error.message}` };
    }
  }
};

window.Sheets = Sheets;
