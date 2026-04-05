const AI = {

  getRecordsSummary() {
    const records = DB.getRecords();
    if (!records.length) return '（暂无历史记录）';
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000);
    const recent = records.filter(r => new Date(r.createdAt) >= ninetyDaysAgo);
    if (!recent.length) return '（近90天暂无记录）';
    return recent.map(r => {
      const d = new Date(r.createdAt);
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const sign = r.type === 'expense' ? '-' : '+';
      return `${ds} ${r.category} ${sign}¥${r.amount}${r.note?' '+r.note:''}`;
    }).join('\n');
  },

  getSystemPrompt() {
    const character = window.Character ? Character.getCurrent() : null;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
    const todayWeekday = weekdays[now.getDay()];
    const dow = now.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() + mondayOffset);
    const thisMondayStr = thisMonday.toISOString().split('T')[0];
    const yesterday = new Date(now - 86400000).toISOString().split('T')[0];
    const dayBefore  = new Date(now - 172800000).toISOString().split('T')[0];
    const records = this.getRecordsSummary();
    const roleName = character?.name || '執事';
    const roleTitle = character?.title || '財務執事';
    const personality = character?.personality || '你是一位优雅可靠的财务执事。';

    return `你是「${roleName}」，身份是${roleTitle}，负责记账和查询分析两种任务。
${personality}

今天 ${today}（${todayWeekday}），本周一 ${thisMondayStr}。

===== 主人账单 =====
${records}
====================

【记账模式】用户描述新收支 → 返回JSON：
{"mode":"record","records":[{"type":"expense或income","amount":数字,"category":类别,"emoji":emoji,"note":备注,"date":"YYYY-MM-DD"}],"understood":true,"reply":"管家回复≤30字"}

如果一句话里包含多笔收支，必须把每一笔都拆成 records 数组中的一项。
如果只有一笔，也仍然返回 records 数组，长度为 1。

日期：今天=${today} 昨天=${yesterday} 前天=${dayBefore} 本周一=${thisMondayStr}

【查询模式】用户询问"花了多少/统计/分析/查询/这周/本月" → 从账单数据中计算后返回：
{"mode":"query","understood":false,"reply":"根据账单准确计算并回答，保持当前角色口吻，可含数字，≤80字"}

【模式三：闲聊】用户问其他任何问题（健身、天气、建议等）→ 用管家身份自然回答：
{"mode":"chat","understood":false,"reply":"以当前角色身份自然回答，可以回答任何话题，语气得体，≤80字"}

支出类别：餐饮🍜购物🛍️交通🚗娱乐🎮医疗💊居住🏠教育📚其他💸
收入类别：工资💼副业💡投资📈礼金🎁其他💰

只返回JSON，无markdown。`;
  },

  async callOpenAICompatible(apiUrl, apiKey, model, userMessage, history) {
    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      ...history.slice(-6).map(h => ({ role: h.role==='model'?'assistant':h.role, content: h.content })),
      { role: 'user', content: userMessage }
    ];
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 500, response_format: { type: 'json_object' } })
    });
    if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.error?.message||`HTTP ${res.status}`); }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '{}';
    return JSON.parse(text);
  },

  async callGemini(apiKey, userMessage, history) {
    const messages = history.slice(-6).map(h => ({
      role: h.role==='model'?'model':'user',
      parts: [{ text: h.content }]
    }));
    messages.push({ role: 'user', parts: [{ text: userMessage }] });
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: this.getSystemPrompt() }] },
        contents: messages,
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
      })
    });
    if (!res.ok) { const err = await res.json().catch(()=>({})); throw new Error(err.error?.message||`HTTP ${res.status}`); }
    const data = await res.json();
    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    text = text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
    return JSON.parse(text);
  },

  async chat(userMessage, history = []) {
    const settings = DB.getSettings();
    const provider = settings.aiProvider || 'gemini';
    const apiKey = settings.aiKey || '';
    if (!apiKey) return { understood: false, reply: '主人，请先在设置中配置 AI API Key。' };
    try {
      switch (provider) {
        case 'deepseek':
          return this.normalizeResult(await this.callOpenAICompatible('https://api.deepseek.com/v1/chat/completions', apiKey, 'deepseek-chat', userMessage, history));
        case 'openrouter':
          return this.normalizeResult(await this.callOpenAICompatible('https://openrouter.ai/api/v1/chat/completions', apiKey, settings.openrouterModel||'deepseek/deepseek-chat', userMessage, history));
        case 'groq':
          return this.normalizeResult(await this.callOpenAICompatible('https://api.groq.com/openai/v1/chat/completions', apiKey, 'llama3-8b-8192', userMessage, history));
        case 'gemini':
        default:
          return this.normalizeResult(await this.callGemini(apiKey, userMessage, history));
      }
    } catch(e) {
      console.error('AI error:', e);
      return { understood: false, reply: `执事暂时无法连线。(${e.message})` };
    }
  },

  normalizeResult(result = {}) {
    if (!result || typeof result !== 'object') return { understood: false, reply: '执事暂时没能听清，请再说一次。' };

    if (Array.isArray(result.records)) {
      const records = result.records
        .map(record => this.normalizeRecord(record))
        .filter(Boolean);
      return {
        ...result,
        mode: result.mode || (records.length ? 'record' : 'chat'),
        understood: records.length ? true : !!result.understood,
        records,
      };
    }

    const singleRecord = this.normalizeRecord(result);
    if (result.mode === 'record' && singleRecord) {
      return {
        ...result,
        understood: true,
        records: [singleRecord],
      };
    }

    return result;
  },

  normalizeRecord(record = {}) {
    const amount = Number(record.amount);
    if (!record.type || !Number.isFinite(amount) || amount <= 0) return null;
    return {
      type: record.type === 'income' ? 'income' : 'expense',
      amount,
      category: record.category || '其他',
      emoji: record.emoji || (record.type === 'income' ? '💰' : '💸'),
      note: record.note || '',
      date: record.date || '',
    };
  }
};
window.AI = AI;
