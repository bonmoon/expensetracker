const Sheets = {
  REQUEST_TIMEOUT_MS: 8000,

  getURL() {
    return (DB.getSettings().sheetsUrl || '').trim();
  },

  isConfigured() {
    return !!this.getURL();
  },

  async fetchWithTimeout(resource, init = {}, timeoutMs = this.REQUEST_TIMEOUT_MS) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => {
      if (controller) controller.abort();
    }, timeoutMs);

    try {
      const request = controller ? { ...init, signal: controller.signal } : init;
      return await fetch(resource, request);
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('请求超时，请检查 Apps Script 部署或网络');
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  },

  async fetchJSON(urls) {
    const candidates = Array.isArray(urls) ? urls : [urls];
    let lastError = new Error('请求失败');

    for (const url of candidates) {
      try {
        const res = await this.fetchWithTimeout(url, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-store',
          headers: { 'Accept': 'application/json,text/plain,*/*' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return text ? JSON.parse(text) : null;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  },

  async getRemoteRecords() {
    const url = this.getURL();
    if (!url) throw new Error('请先绑定您的 Sheets URL');

    const data = await this.fetchJSON([`${url}?action=getAll`, url]);
    if (Array.isArray(data)) return DB.dedupeRecords(data);
    if (Array.isArray(data?.records)) return DB.dedupeRecords(data.records);
    if (Array.isArray(data?.data)) return DB.dedupeRecords(data.data);
    throw new Error('Apps Script 返回的数据格式不正确');
  },

  async ping() {
    const url = this.getURL();
    if (!url) return { success: false, message: '未绑定 Sheets URL' };

    try {
      const data = await this.fetchJSON([`${url}?action=ping`, url]);
      if (Array.isArray(data) || data?.success === true || typeof data === 'object') {
        return { success: true };
      }
      return { success: false, message: 'Apps Script 响应异常' };
    } catch (error) {
      return { success: false, message: error.message || '无法连接 Apps Script' };
    }
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
      const res = await this.fetchWithTimeout(url, request);
      return { success: res.ok, status: res.status };
    } catch {
      try {
        await this.fetchWithTimeout(url, { ...request, mode: 'no-cors' });
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

  async syncChanges() {
    const url = this.getURL();
    if (!url) return { success: false, message: '请先绑定您的 Sheets URL' };

    try {
      const remote = await this.getRemoteRecords();
      const local = DB.getRecords();

      const localIds = new Set(local.map(record => record.id).filter(Boolean));
      const deletedIds = new Set(DB.getDeletedIds());

      const toDelete = remote
        .filter(record => record.id && (!localIds.has(record.id) || deletedIds.has(record.id)))
        .map(record => record.id);

      const remoteIds = new Set(remote.map(record => record.id).filter(Boolean));
      const toAdd = local.filter(record => record.id && !remoteIds.has(record.id));

      let deletedCount = 0;
      for (const id of toDelete) {
        await this.deleteRecord(id);
        deletedCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      let addedCount = 0;
      for (const record of toAdd) {
        await this.pushRecord(record);
        addedCount++;
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!deletedCount && !addedCount) {
        return { success: true, message: 'Sheets 已与本地一致' };
      }
      return { success: true, message: `已同步 ${addedCount} 条新增，删除 ${deletedCount} 条远端记录` };
    } catch (error) {
      return { success: false, message: `同步失败: ${error.message}` };
    }
  },

  async pullAndRestore() {
    const url = this.getURL();
    if (!url) return { success: false, message: '请先绑定您的 Sheets URL' };

    try {
      const data = await this.getRemoteRecords();
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
