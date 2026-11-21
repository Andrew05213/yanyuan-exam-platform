/* AI 专题出题 + 个人题库（组卷工作台扩展）
 * Loaded after difficulty-ui.js, before app.js. Wraps TierStudio.init/render so
 * the feature lives inside the existing 组卷 page without forking its logic.
 * All model calls go to /api/ai-questions on the server; the API key never
 * reaches the browser. Generated items are only kept after the user confirms,
 * then stored through /api/question-bank (owner-scoped D1 rows). */
'use strict';

const AIStudio = {
  data: null,
  state: {
    ready: null,
    status: null,
    active: false,
    busy: false,
    error: '',
    notice: '',
    items: [],
    selected: new Set(),
    lastRequest: null,
    request: null,
    bank: [],
    bankLoaded: false,
    bankBusy: false,
    requestId: null,
    requestKey: null,
    cooldownUntil: 0,
    cooldownTimer: null,
  },

  init(data) {
    this.data = data;
    // Community materials refresh replaces TierStudio.data.items wholesale.
    // Re-merge the personal bank after it resolves so saved AI items stay in
    // the standard paper catalog.
    if (typeof PublicApp !== 'undefined' && !PublicApp.__aiBankPatched) {
      PublicApp.__aiBankPatched = true;
      const baseRefresh = PublicApp.refresh.bind(PublicApp);
      PublicApp.refresh = async (...args) => {
        const result = await baseRefresh(...args);
        try {
          AIStudio.mergeBankIntoStudio();
        } catch {
          /* Catalog merge is best effort. */
        }
        return result;
      };
    }
    document.addEventListener('click', (event) => this.click(event));
    document.addEventListener('submit', (event) => {
      if (event.target.id === 'ai-form') {
        event.preventDefault();
        this.generate();
      }
    });
    document.addEventListener('change', (event) => {
      const box = event.target.closest('[data-ai-select]');
      if (box) {
        const id = box.dataset.aiSelect;
        if (box.checked) this.state.selected.add(id);
        else this.state.selected.delete(id);
        this.renderCount();
      }
    });
  },

  attach() {
    const screen = document.getElementById('screen');
    const form = document.getElementById('tier-form');
    if (!screen || !form) return;
    const tabs = screen.querySelector('.flow-tabs');
    if (tabs && !tabs.querySelector('[data-ai-action="tab"]')) {
      tabs.insertAdjacentHTML('beforeend', '<button type="button" data-ai-action="tab">AI 专题出题</button>');
    }
    if (!document.getElementById('ai-studio')) {
      form.insertAdjacentHTML('afterend', this.shell());
      this.bindPanel();
    }
    this.applyVisibility();
    if (!this.state.bankLoaded && !this.state.bankBusy) this.loadBank();
    if (this.state.status === null) this.loadStatus();
  },

  shell() {
    return `<section id="ai-studio" class="hub-panel ai-studio" hidden>
      <div class="page-heading page-heading--split ai-studio-head">
        <div><span class="hub-kicker">组卷 · AI 专题出题</span><h2>按科目与主题生成，核对后存入个人题库</h2>
        <p class="hub-form-note">调用服务端配置的 DeepSeek。生成内容标注“AI 生成 · 待审核”，不会自动计入成绩或替代真题。</p></div>
        <span class="mode-note" id="ai-ready">检查模型配置…</span>
      </div>
      <div id="ai-unavailable" class="notice" hidden></div>
      <form id="ai-form" class="ai-form">
        <div class="form-block-head"><span class="form-step">01</span><h2>范围</h2></div>
        <div class="tier-header-grid">
          <label>训练预设<select id="ai-preset"><option>自定义</option><option>北大日语方向 · 国别口试模拟</option><option>日本文学比较</option><option>专八难度英语阅读</option></select></label>
          <label>科目<select id="ai-subject" name="subject">
            <option value="英语">英语阅读 / 词汇语法</option>
            <option value="日本国别">日本国别</option>
            <option value="文学口试">文学口试</option>
          </select></label>
          <label>主题<input id="ai-topic" name="topic" maxlength="60" placeholder="如：科技与社会；物哀；日本教育" required></label>
          <label>难度<select id="ai-difficulty" name="difficulty"><option>基础</option><option selected>进阶</option><option>挑战</option></select></label>
          <label>题型<select id="ai-type" name="type"></select></label>
          <label>数量<select id="ai-count" name="count"></select></label>
          <label>重点考查<input name="focus" maxlength="100" placeholder="如：用文本细节比较两部作品"></label>
          <label id="ai-length" hidden>目标词数<select name="words"><option>550–800</option><option>350–500</option><option>800–1000</option></select></label>
          <label>限时（分钟）<input id="ai-minutes" type="number" min="5" max="240" value="40"></label>
        </div>
        <div class="studio-actions">
          <button class="btn primary" type="submit" id="ai-generate">生成题目</button>
          <span class="hub-form-note" id="ai-status" role="status"></span>
        </div>
        <p class="hub-form-note" id="ai-limits"></p>
      </form>
      <div id="ai-error" class="notice" role="alert" hidden></div>
      <div id="ai-preview"></div>
      <div class="form-block-head section-gap"><span class="form-step">02</span><h2>我的题库与组卷</h2></div>
      <div id="ai-bank"></div>
    </section>`;
  },

  bindPanel() {
    const panel = document.getElementById('ai-studio');
    if (!panel) return;
    const subject = panel.querySelector('#ai-subject');
    subject.addEventListener('change', () => {
      this.state.request = null;
      this.renderTypeOptions();
    });
    panel.querySelector('#ai-preset').onchange = event => {
      const profiles = [
        null, ['文学口试','日本社会与人口结构','模拟国别面试，考查政策分析与反例回应'],
        ['文学口试','《雪国》与《源氏物语》','比较叙述视角与物哀，引用具体场景'],
        ['英语','城市发展与公共政策','专八难度，考查论证结构、词义与隐含态度']
      ];
      const preset = profiles[event.target.selectedIndex];
      if (!preset) return;
      subject.value = preset[0];
      panel.querySelector('#ai-topic').value = preset[1];
      panel.querySelector('[name=focus]').value = preset[2];
      this.renderTypeOptions();
    };
    const type = panel.querySelector('#ai-type');
    type.addEventListener('change', () => this.renderCountOptions());
    this.renderTypeOptions();
  },

  readyPayload() {
    return this.state.status;
  },

  renderTypeOptions() {
    const subjectEl = document.getElementById('ai-subject');
    const typeEl = document.getElementById('ai-type');
    if (!subjectEl || !typeEl) return;
    const subjects = this.state.status?.subjects || [
      { id: '英语', types: [{ id: 'reading', label: '英语阅读：完整篇章 + 小题', counts: [3, 4, 5] }, { id: 'mc', label: '词汇语法：单项选择', counts: [3, 5, 10] }] },
      { id: '日本国别', types: [{ id: 'mc', label: '日本国别：单项选择', counts: [3, 5, 10] }] },
      { id: '文学口试', types: [{ id: 'oral', label: '文学口试：问答与追问', counts: [1, 2, 3] }] },
    ];
    const entry = subjects.find((item) => item.id === subjectEl.value) || subjects[0];
    typeEl.innerHTML = entry.types.map((item) => `<option value="${this.escape(item.id)}">${this.escape(item.label)}</option>`).join('');
    this.renderCountOptions();
  },

  renderCountOptions() {
    const length = document.getElementById('ai-length');
    if(length) length.hidden = document.getElementById('ai-type')?.value !== 'reading';
    const typeEl = document.getElementById('ai-type');
    const countEl = document.getElementById('ai-count');
    if (!typeEl || !countEl) return;
    const subjectEl = document.getElementById('ai-subject');
    const subject = (this.state.status?.subjects || []).find((item) => item.id === subjectEl.value);
    const type = subject?.types.find((item) => item.id === typeEl.value);
    const options = type?.counts || (typeEl.value === 'reading' ? [3, 4, 5] : typeEl.value === 'oral' ? [1, 2, 3] : [3, 5, 10]);
    countEl.innerHTML = options.map((n) => `<option value="${n}">${n} 题</option>`).join('');
  },

  async loadStatus() {
    try {
      const response = await this.request('/api/ai-questions', { method: 'GET', timeout: 20000 });
      this.state.status = response;
    } catch (error) {
      this.state.status = { ready: false, message: error.message };
    }
    const badge = document.getElementById('ai-ready');
    if (badge) {
      badge.textContent = this.state.status.ready ? 'DeepSeek 已就绪' : '模型未配置';
      badge.classList.toggle('flow-warning', !this.state.status.ready);
    }
    const notice = document.getElementById('ai-unavailable');
    if (notice) {
      notice.hidden = !!this.state.status.ready;
      notice.textContent = this.state.status.ready ? '' : this.state.status.message || '模型未配置，生成按钮暂不可用。';
    }
    const button = document.getElementById('ai-generate');
    if (button) button.disabled = !this.state.status.ready;
    const limits = this.state.status.limits;
    const limitText = document.getElementById('ai-limits');
    if (limitText && limits) {
      limitText.textContent = `服务端限制：每 ${Math.round(limits.windowSeconds / 60)} 分钟最多 ${limits.maxPerWindow} 次，每天 ${limits.maxPerDay} 次，单次最多 ${limits.maxCountPerRequest} 题。`;
    }
    this.renderTypeOptions();
  },

  async loadBank() {
    this.state.bankBusy = true;
    try {
      const response = await this.request('/api/question-bank', { method: 'GET', timeout: 20000 });
      this.state.bank = (response.items || []).filter((entry) => entry.item);
      this.state.bankLoaded = true;
      this.mergeBankIntoStudio();
    } catch (error) {
      this.state.bankError = error.message;
      this.state.bankLoaded = true;
    } finally {
      this.state.bankBusy = false;
      this.renderBank();
    }
  },

  mergeBankIntoStudio() {
    // TierStudio is a top-level lexical binding (classic script), so it is not
    // always exposed as window.TierStudio.
    const studio = typeof TierStudio !== 'undefined' ? TierStudio : window.TierStudio;
    if (!studio?.data?.items) return;
    const base = studio.data.items.filter((unit) => !String(unit.id || '').startsWith('ai-bank:'));
    const units = [];
    for (const record of this.state.bank) {
      if (record.item.subject !== '英语' || !record.item.questions.length) continue;
      const section = record.item.section === 'reading' ? 'reading' : 'mc';
      if (!studio.data.sections?.英语?.some((entry) => entry.id === section)) continue;
      const tier = studio.data.tiers?.英语?.[0]?.id || 'any';
      units.push({
        id: 'ai-bank:' + record.item.id,
        subject: '英语',
        section,
        tier,
        classificationStatus: record.reviewStatus === 'approved' ? '我的题库 · 已人工审核' : '我的题库 · AI 生成待审核',
        reason: '来自个人题库；' + record.item.sourceNote,
        title: record.item.title,
        text: record.item.text || '',
        paragraphs: record.item.paragraphs || [],
        source: record.item.sourceNote,
        sourceUrl: '',
        questions: record.item.questions.map((question) => ({
          id: question.id,
          sourceNumber: question.id,
          kind: 'mc',
          stem: question.stem,
          options: question.options,
          answer: question.answer,
          analysis: question.analysis,
          tag: question.tag,
          sourceId: question.id,
          level: record.item.difficulty,
        })),
      });
    }
    studio.data.items = [...base, ...units];
    if (studio.config) {
      try {
        studio.updateStocks?.();
      } catch {
        /* Stock refresh is best effort. */
      }
    }
  },

  async generate() {
    if (this.state.busy || Date.now() < (this.state.cooldownUntil || 0)) return;
    const form = new FormData(document.getElementById('ai-form'));
    const minutes = Math.min(240, Math.max(5, Number(form.get('minutes')) || 40));
    const payload = {
      subject: form.get('subject'),
      topic: String(form.get('topic') || '').trim(),
      difficulty: form.get('difficulty'),
      type: form.get('type'),
      count: Number(form.get('count')),
      focus: form.get('focus') || '', words: form.get('type') === 'reading' ? form.get('words') : '',
    };
    if (!payload.topic) {
      this.showError('请先填写主题。');
      return;
    }
    this.state.lastRequest = { ...payload, minutes };
    this.state.requestMinutes = minutes;
    const requestKey = JSON.stringify(payload);
    if (this.state.requestKey !== requestKey || !this.state.requestId) {
      this.state.requestKey = requestKey;
      this.state.requestId = crypto.randomUUID();
    }
    this.showError('');
    this.state.busy = true;
    this.state.notice = '正在调用 DeepSeek 生成题目，通常需要 20–60 秒…';
    this.setStatus(this.state.notice);
    const button = document.getElementById('ai-generate');
    if (button) {
      button.disabled = true;
      button.textContent = '生成中…';
    }
    this.renderPreview();
    try {
      const response = await this.request('/api/ai-questions', {
        method: 'POST',
        body: { ...payload, requestId: this.state.requestId },
        timeout: 110000,
      });
      this.state.items = response.items || [];
      this.state.selected = new Set(this.state.items.map((item) => item.id));
      this.state.meta = response;
      this.state.requestId = null;
      this.state.requestKey = null;
      const quota = response.quota;
      const quotaText = quota ? ` · 本时段剩余 ${quota.remaining} 次` : '';
      const dedupe = response.deduplicated ? '（重复请求，已复用结果）' : '';
      this.state.notice = `已生成 ${this.state.items.reduce((n, item) => n + item.questions.length, 0)} 题 · ${response.model} · ${(response.elapsedMs / 1000).toFixed(1)} 秒 · 待审核${quotaText}${dedupe}`;
      this.showError('');
    } catch (error) {
      if (error.status) {
        this.state.requestId = null;
        this.state.requestKey = null;
      }
      this.showError(error.message, true);
      this.state.items = [];
      this.state.selected = new Set();
      this.state.notice = '';
      const retryAfter = Number(error.data?.retryAfterSeconds);
      if (error.status === 429 || (error.status === 409 && retryAfter > 0)) {
        this.startCooldown(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 30);
      }
    } finally {
      this.state.busy = false;
      const cooling = Date.now() < (this.state.cooldownUntil || 0);
      if (button) {
        button.disabled = cooling || !(this.state.status?.ready);
        button.textContent = '生成题目';
      }
      if (!cooling) this.setStatus(this.state.notice);
      this.renderPreview();
    }
  },

  startCooldown(seconds) {
    if (this.state.cooldownTimer) clearInterval(this.state.cooldownTimer);
    const until = Date.now() + Math.max(1, seconds) * 1000;
    this.state.cooldownUntil = until;
    const button = document.getElementById('ai-generate');
    const tick = () => {
      const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      if (left > 0) {
        if (button) {
          button.disabled = true;
          button.textContent = `限流中 ${left}s`;
        }
        this.setStatus(`${left} 秒后可重试`);
        return;
      }
      clearInterval(this.state.cooldownTimer);
      this.state.cooldownTimer = null;
      this.state.cooldownUntil = 0;
      if (button) {
        button.disabled = !(this.state.status?.ready);
        button.textContent = '生成题目';
      }
      this.setStatus('限制已解除，可以重新生成。');
    };
    tick();
    this.state.cooldownTimer = setInterval(tick, 1000);
  },

  async saveSelected() {
    const items = this.state.items.filter((item) => this.state.selected.has(item.id));
    if (!items.length) {
      this.showError('请至少选择一组题目。');
      return null;
    }
    this.state.bankBusy = true;
    this.setStatus('正在保存到个人题库…');
    try {
      await this.request('/api/question-bank', { method: 'POST', body: { items }, timeout: 30000 });
      this.state.notice = `已保存 ${items.length} 组到我的题库（待审核）。`;
      this.state.bankLoaded = false;
      await this.loadBank();
      this.showError('');
      return items;
    } catch (error) {
      this.showError(error.message);
      return null;
    } finally {
      this.state.bankBusy = false;
      this.renderPreview();
      this.setStatus(this.state.notice);
    }
  },

  async compose(source) {
    const subjectEl = document.getElementById('ai-subject');
    const subject = subjectEl?.value || '英语';
    let items = [];
    if (source === 'ai') {
      items = this.state.items.filter((item) => this.state.selected.has(item.id));
    } else if (source === 'bank') {
      items = this.state.bank.filter((record) => record.item.subject === subject).map((record) => record.item);
    } else {
      const fresh = this.state.items.filter((item) => this.state.selected.has(item.id));
      const existing = this.state.bank.filter((record) => record.item.subject === subject).map((record) => record.item);
      const seen = new Set(fresh.map((item) => item.id));
      items = [...fresh, ...existing.filter((item) => !seen.has(item.id))];
    }
    if (!items.length) {
      this.showError('当前没有可组卷的题目。请先生成并保存，或在“我的题库”中保存题目。');
      return;
    }
    const minutes = Math.min(240, Math.max(5, Number(document.getElementById('ai-minutes')?.value) || 40));
    try {
      const packet = subject === '文学口试' ? this.oralPacket(items, minutes) : this.writtenPacket(items, subject, minutes);
      await Hub.createPacket(packet);
    } catch (error) {
      this.showError(error.message);
    }
  },

  writtenPacket(items, subject, minutes) {
    const blocks = [];
    const readings = items.filter((item) => item.section === 'reading');
    for (const item of readings) {
      blocks.push({
        kind: 'reading',
        title: item.title,
        text: item.text,
        paragraphs: item.paragraphs.length ? item.paragraphs : item.text.split(/\n\s*\n/),
        source: item.sourceNote,
        sourceUrl: '',
        note: 'AI 生成 · 待审核',
        questions: item.questions.map((question) => this.question(question)),
      });
    }
    const singles = items.filter((item) => item.section !== 'reading');
    if (singles.length) {
      blocks.push({
        kind: subject === '日本国别' ? 'country' : 'mc',
        title: (subject === '日本国别' ? '日本国别' : '英语') + ' · AI 单项选择',
        text: '',
        paragraphs: [],
        source: 'AI 生成；非官方真题',
        sourceUrl: '',
        note: 'AI 生成 · 待审核',
        questions: singles.flatMap((item) => item.questions.map((question) => this.question(question))),
      });
    }
    let sequence = 0;
    for (const block of blocks) for (const question of block.questions) question.id = ++sequence;
    const total = sequence;
    if (!total || total > 100) throw Error('AI 题目数量须为 1 至 100 题。');
    let assigned = 0;
    for (const block of blocks) {
      for (const question of block.questions) {
        question.points = Math.floor(100 / total) + (++assigned <= 100 % total ? 1 : 0);
      }
    }
    const school = Hub.schoolById(Hub.school);
    const packet = {
      schema: 2,
      kind: 'written',
      subject,
      schoolId: Hub.school,
      schoolName: (school?.name || '') + ' · ' + (school?.track || ''),
      title: (school?.short || '训练') + ' · AI 专题 · ' + (document.getElementById('ai-topic')?.value || ''),
      createdAt: new Date().toISOString(),
      minutes,
      count: total,
      totalPoints: 100,
      config: { schema: 'ai-topic-v1', schoolId: Hub.school, subject, minutes, count: total, topic: document.getElementById('ai-topic')?.value || '' },
      difficultyVersion: 'ai-topic-v1',
      blocks,
      note: '本卷题目由 AI 生成，标注“待审核”，不代表官方真题或已审核题源；解析与答案请自行核对。组卷、作答、错题与档案流程与现有训练卷一致。',
    };
    WorkflowEngine.validatePacket(packet);
    return packet;
  },

  question(question) {
    return {
      kind: 'mc',
      stem: question.stem,
      options: question.options,
      answer: question.answer,
      analysis: question.analysis,
      tag: question.tag,
      sourceId: question.id,
      stemHtml: Hub.e(question.stem),
      optionsHtml: question.options.map((option) => Hub.e(option)),
      analysisHtml: Hub.e(question.analysis),
    };
  },

  oralPacket(items, minutes) {
    const school = Hub.schoolById(Hub.school);
    const list = items.slice(0, 20).map((item) => {
      const question = item.questions[0] || {};
      return {
        id: item.id,
        title: item.title,
        prompt: question.stem || item.title,
        guide: question.guide && question.guide.length ? question.guide : ['先给出判断，再举一个可核查的例子。'],
        followups: question.followups || [],
        reference: question.reference || question.analysis || '',
        text: item.text || '',
        level: item.difficulty,
        source: { label: item.sourceNote, kind: 'AI 生成' },
        language: '中文',
        prepSeconds: 45,
        answerSeconds: Math.max(60, Math.min(300, Math.floor((minutes * 60) / Math.max(1, items.length)))),
        terms: [],
        version: '2.0',
        countryLanguageId: 'ja',
        schoolSpecific: false,
      };
    });
    const packet = {
      schema: 1,
      kind: 'oral',
      schoolId: Hub.school,
      languageId: 'ja',
      languageLabel: '日语',
      schoolName: (school?.name || '') + ' · 日语',
      items: list,
      count: list.length,
      createdAt: new Date().toISOString(),
      title: (school?.short || '训练') + ' · AI 文学口试 · ' + (document.getElementById('ai-topic')?.value || ''),
      note: '本卷为 AI 生成的文学口试练习，标注“待审核”，不代表官方真题；参考答案仅作思路提示。',
    };
    Hub.validatePacket(packet);
    return packet;
  },

  async approve(id, revision) {
    try {
      await this.request('/api/question-bank', { method: 'PUT', body: { id, expectedRevision: revision, reviewStatus: 'approved' }, timeout: 20000 });
      this.state.bankLoaded = false;
      await this.loadBank();
      toast('已标记为人工审核。');
    } catch (error) {
      this.showError(error.message);
    }
  },

  async remove(id, revision) {
    try {
      await this.request('/api/question-bank?id=' + encodeURIComponent(id) + '&revision=' + revision, { method: 'DELETE', timeout: 20000 });
      this.state.bankLoaded = false;
      await this.loadBank();
      toast('已从我的题库删除。');
    } catch (error) {
      this.showError(error.message);
    }
  },

  renderPreview() {
    const box = document.getElementById('ai-preview');
    if (!box) return;
    if (!this.state.items.length) {
      box.replaceChildren();
      this.renderCount();
      return;
    }
    const total = this.state.items.reduce((n, item) => n + item.questions.length, 0);
    box.innerHTML = `<div class="section-top"><div><span class="hub-kicker">生成结果 · 请核对后再保存</span><h2>${total} 题 · ${this.escape(this.state.meta?.model || '')} · ${((this.state.meta?.elapsedMs || 0) / 1000).toFixed(1)} 秒</h2><p class="hub-form-note">生成内容标注为“AI 生成 · 待审核”。保存后可在“我的题库”查看，并被并入组卷库存。</p></div><span class="version-pill">待审核</span></div>
      <div class="ai-preview-list">${this.state.items.map((item) => this.previewItem(item)).join('')}</div>
      <div class="studio-actions">
        <button class="btn primary" type="button" data-ai-action="save">保存选中到我的题库</button>
        <button class="btn secondary" type="button" data-ai-action="save-compose">保存并组卷</button>
        <button class="btn secondary" type="button" data-ai-action="select-all">全选</button>
        <button class="btn secondary" type="button" data-ai-action="select-none">取消全选</button>
        <span class="hub-form-note" id="ai-selected-count">${this.state.selected.size} / ${this.state.items.length} 组</span>
      </div>`;
    this.renderCount();
  },

  previewItem(item) {
    const checked = this.state.selected.has(item.id) ? 'checked' : '';
    const heading = item.section === 'reading' ? '英语阅读' : item.subject === '文学口试' ? '文学口试' : item.subject === '日本国别' ? '日本国别' : '词汇语法';
    return `<article class="ai-preview-item">
      <header><label class="hub-check"><input type="checkbox" data-ai-select="${this.escape(item.id)}" ${checked}>选择</label>
        <span class="hub-record-kind">AI 生成 · 待审核</span><span class="version-pill">${this.escape(heading)} · ${this.escape(item.difficulty)}</span></header>
      <h3>${this.escape(item.title)}</h3>
      ${item.text ? `<details class="ai-passage"><summary>阅读原文（${item.text.length} 字符）</summary><div>${item.paragraphs.length ? item.paragraphs.map((p) => `<p>${this.escape(p)}</p>`).join('') : `<p>${this.escape(item.text)}</p>`}</div></details>` : ''}
      ${item.questions.map((question, index) => `<div class="ai-question">
        <p class="ai-stem"><b>${index + 1}.</b> ${this.escape(question.stem)}</p>
        ${question.options.length ? `<ol class="ai-options">${question.options.map((option, i) => `<li><b>${'ABCD'[i]}</b>${this.escape(option)}</li>`).join('')}</ol>` : ''}
        <p class="ai-answer">答案：${question.options.length ? this.escape(question.answer) : '口试（参考回答见下）'}</p>
        <p class="ai-analysis">解析：${this.escape(question.analysis)}</p>
        ${item.subject==='日本国别' ? '<details><summary>核查依据</summary><p>核对概念定义、年份及选项的唯一性。统计题可查 <a href="https://www.e-stat.go.jp/" target="_blank" rel="noreferrer">日本政府统计</a>，政策题可查 <a href="https://www.mhlw.go.jp/" target="_blank" rel="noreferrer">厚生劳动省</a>。这些是核查入口。</p></details>' : ''}
        ${question.reference ? `<p class="ai-reference">参考回答：${this.escape(question.reference)}</p>` : ''}
        ${question.guide?.length ? `<p class="hub-form-note">思路：${question.guide.map((guide) => this.escape(guide)).join('；')}</p>` : ''}
      </div>`).join('')}
    </article>`;
  },

  renderBank() {
    const box = document.getElementById('ai-bank');
    if (!box) return;
    if (this.state.bankBusy && !this.state.bank.length) {
      box.innerHTML = '<p class="hub-form-note">正在读取我的题库…</p>';
      return;
    }
    if (this.state.bankError) {
      box.innerHTML = `<div class="notice">${this.escape(this.state.bankError)} <button class="text-link" type="button" data-ai-action="reload-bank">重试</button></div>`;
      return;
    }
    if (!this.state.bank.length) {
      box.innerHTML = '<div class="empty-state ai-empty"><h3>我的题库还是空的</h3><p>生成后勾选并“保存选中到我的题库”，题目就会出现在这里，并进入组卷库存。</p></div>';
      return;
    }
    const counts = {};
    for (const record of this.state.bank) counts[record.item.subject] = (counts[record.item.subject] || 0) + 1;
    box.innerHTML = `<div class="ai-bank-head"><p class="hub-form-note">共 ${this.state.bank.length} 组：${Object.entries(counts).map(([subject, n]) => `${this.escape(subject)} ${n}`).join(' · ')}。英语题已并入常规组卷库存。</p>
      <div class="studio-actions"><button class="btn primary" type="button" data-ai-action="compose-bank">用我的题库组卷</button><button class="btn secondary" type="button" data-ai-action="compose-mixed">我的题库 + 本次 AI 新题混合组卷</button><button class="btn secondary" type="button" data-ai-action="reload-bank">刷新</button></div></div>
      <div class="ai-bank-list">${this.state.bank.map((record) => this.bankRow(record)).join('')}</div>`;
  },

  bankRow(record) {
    const item = record.item;
    const status = record.reviewStatus === 'approved' ? '已人工审核' : 'AI 生成 · 待审核';
    return `<article class="ai-bank-row">
      <div class="ai-bank-main"><span class="hub-record-kind">${this.escape(item.subject)} · ${this.escape(item.difficulty)}</span>
        <h3>${this.escape(item.title)}</h3>
        <p>${item.questions.length} 题 · ${this.escape(status)} · 保存于 ${Hub.dateText(record.updatedAt, true)}</p></div>
      <div class="ai-bank-actions">
        ${record.reviewStatus === 'approved' ? '' : `<button class="btn secondary" type="button" data-ai-action="approve" data-id="${this.escape(record.id)}" data-revision="${record.revision}">标记已审核</button>`}
        <button class="btn secondary" type="button" data-ai-action="remove" data-id="${this.escape(record.id)}" data-revision="${record.revision}">删除</button>
      </div>
    </article>`;
  },

  showError(message, retryGeneration = false) {
    const box = document.getElementById('ai-error');
    if (!box) return;
    box.hidden = !message;
    const retry = retryGeneration ? '<button class="text-link" type="button" data-ai-action="retry">重试</button>' : '';
    box.innerHTML = message ? `${this.escape(message)} ${retry} <button class="text-link" type="button" data-ai-action="dismiss">关闭</button>` : '';
  },

  setStatus(message) {
    const el = document.getElementById('ai-status');
    if (el) el.textContent = message || '';
  },

  renderCount() {
    const el = document.getElementById('ai-selected-count');
    if (el && this.state.items.length) el.textContent = `${this.state.selected.size} / ${this.state.items.length} 组`;
  },

  applyVisibility() {
    const panel = document.getElementById('ai-studio');
    const form = document.getElementById('tier-form');
    if (!panel || !form) return;
    panel.hidden = !this.state.active;
    form.hidden = this.state.active;
    const preview = document.getElementById('tier-preview');
    if (preview) preview.hidden = true;
    const tabs = [...document.querySelectorAll('.flow-tabs button')];
    tabs.forEach((tab, index) => {
      if (tab.dataset.aiAction === 'tab') tab.classList.toggle('active', this.state.active);
      else tab.classList.toggle('active', !this.state.active && index === 0);
    });
  },

  async request(url, { method = 'GET', body, timeout = 30000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin',
        signal: controller.signal,
      });
      if (!response.headers.get('content-type')?.includes('application/json')) throw Error('连接需要重新登录，请刷新页面后重试。');
      const data = await response.json();
      if (!response.ok) {
        const error = Error(data.error || '操作未完成');
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    } catch (error) {
      if (error.name === 'AbortError') throw Error('请求超时，可重试；已生成的题目与表单内容不会丢失。');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  },

  async click(event) {
    const tab = event.target.closest('[data-ai-action="tab"]');
    if (tab) {
      this.state.active = !this.state.active;
      this.applyVisibility();
      if (this.state.active) document.getElementById('ai-studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const button = event.target.closest('[data-ai-action]');
    if (!button) return;
    const action = button.dataset.aiAction;
    if (action === 'back') {
      this.state.active = false;
      this.applyVisibility();
      return;
    }
    if (action === 'save') await this.saveSelected();
    if (action === 'save-compose') {
      const saved = await this.saveSelected();
      if (saved) await this.compose('ai');
    }
    if (action === 'compose-bank') await this.compose('bank');
    if (action === 'compose-mixed') await this.compose('mixed');
    if (action === 'select-all') {
      this.state.selected = new Set(this.state.items.map((item) => item.id));
      this.renderPreview();
    }
    if (action === 'select-none') {
      this.state.selected = new Set();
      this.renderPreview();
    }
    if (action === 'retry') {
      await this.generate();
    }
    if (action === 'dismiss') this.showError('');
    if (action === 'reload-bank') {
      this.state.bankLoaded = false;
      this.loadBank();
    }
    if (action === 'approve') await this.approve(button.dataset.id, Number(button.dataset.revision));
    if (action === 'remove') await this.remove(button.dataset.id, Number(button.dataset.revision));
  },

  escape(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  },
};

(function install() {
  if (typeof TierStudio === 'undefined') return;
  const baseInit = TierStudio.init.bind(TierStudio);
  TierStudio.init = function (data) {
    baseInit(data);
    AIStudio.init(data);
  };
  const baseRender = TierStudio.render.bind(TierStudio);
  TierStudio.render = function () {
    baseRender();
    AIStudio.attach();
  };
  window.AIStudio = AIStudio;
})();
