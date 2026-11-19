/* Node + 最小 DOM 桩：验证启动路径、Markdown、压缩算法、模型/会话逻辑 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const BASE = path.join(__dirname, '..') + '/';
const HTML = fs.readFileSync(BASE + 'index.html', 'utf8');
const START = '/*__APP_JS_START__*/';
const END = '/*__APP_JS_END__*/';
const i1 = HTML.indexOf(START);
const i2 = HTML.indexOf(END);
let src = HTML.slice(i1 + START.length, i2);
src = src.replace(/\}\)\(\);\s*$/, 'globalThis.__KD = { estTokens, md, usageOf, buildRequestMessages, compact, relGroup, downloadFile, S, DEFAULTS };})();');

/* ---------- 断言 ---------- */
const results = [];
const ok = (name, cond, extra) => results.push((cond ? 'PASS' : 'FAIL') + '  ' + name + (extra ? '   [' + extra + ']' : ''));

/* ---------- DOM 桩 ---------- */
const els = new Map();
function el(name) {
  const e = {
    __name: name, children: [], dataset: {}, style: {}, value: '', textContent: '', innerHTML: '',
    scrollTop: 0, scrollHeight: 0, clientHeight: 0, files: [],
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, v) { if (v === undefined) v = !this._s.has(c); v ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute() { return null; },
    appendChild(n) { e.children.push(n); return n; },
    insertBefore(n) { e.children.unshift(n); return n; },
    remove() {}, focus() { e.focused = true; }, click() {}, reload() {},
    querySelector() { return el('stub'); },
    querySelectorAll() { return []; },
    closest() { return null; },
  };
  return e;
}
function byId(id) { if (!els.has(id)) els.set(id, el('#' + id)); return els.get(id); }

const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};

const document = {
  querySelector(sel) { return sel.charAt(0) === '#' ? byId(sel.slice(1)) : el(sel); },
  querySelectorAll() { return []; },
  createElement(tag) { return el(tag); },
  createDocumentFragment() { return el('#fragment'); },
  addEventListener() {},
  body: el('body'),
  execCommand() { return true; },
};

const ctx = {
  console, localStorage, document,
  navigator: {}, location: { protocol: 'file:', reload() {} },
  window: { addEventListener() {}, innerHeight: 800 },
  setTimeout, clearTimeout, Promise, Math, Date, JSON, Object, Array, String, Number, Error, RegExp,
  Set, Map, ArrayBuffer, Uint8Array, TextDecoder: function () { this.decode = () => ''; },
  confirm: () => true, alert: () => {}, prompt: () => '新标题',
  Blob: function () {}, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  fetch: () => Promise.reject(new Error('offline')),
  indexedDB: undefined,
};
ctx.globalThis = ctx;
ctx.window.document = document;
ctx.window.matchMedia = undefined;

vm.createContext(ctx);

/* ---------- 跑应用 ---------- */
try {
  vm.runInContext(src, ctx, { filename: 'app.js' });
  ok('脚本执行无异常（含 IDB 不可用降级）', true);
} catch (e) {
  ok('脚本执行无异常（含 IDB 不可用降级）', false, (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e)));
}

setTimeout(async () => {
  const K = ctx.__KD;
  if (!K) { results.push('FAIL  内部函数未导出'); console.log(results.join('\n')); process.exit(1); }

  ok('启动创建了会话', K.S.convs.length === 1, 'convs=' + K.S.convs.length);
  ok('标题渲染', byId('convTitle').textContent === '新的对话', byId('convTitle').textContent);
  ok('模型标签渲染', byId('modelName').textContent === 'deepseek-flash', byId('modelName').textContent);
  ok('降级 localStorage 已写入', store.size > 0, [...store.keys()].join(','));
  ok('剩余字符文案', /剩余\s[\d.]+\s?万字?/.test(byId('ctxText').textContent), byId('ctxText').textContent);

  /* Markdown */
  ok('md 粗体', K.md('**粗体**').includes('<strong>粗体</strong>'), K.md('**粗体**'));
  ok('md 斜体', K.md('*斜*').includes('<em>斜</em>'), K.md('*斜*'));
  ok('md 行内代码', K.md('用 `x=1` 表示').includes('<code>x=1</code>'));
  ok('md 代码块 + 复制按钮', /<div class="codebox"><button class="cpy"/.test(K.md('```js\nlet a=1;\n```')), K.md('```js\nlet a=1;\n```').slice(0, 80));
  ok('md 代码块转义', K.md('```\na < b && c > d\n```').includes('&lt;') && !K.md('```\na<b\n```').includes('a<b'));
  ok('md 标题', K.md('## 小标题').includes('<h2>小标题</h2>'), K.md('## 小标题'));
  ok('md 无序列表', (function () { const t = K.md('- 一\n- 二'); return t.includes('<ul>') && t.includes('<li>一') && t.includes('<li>二') && t.includes('</ul>'); })(), K.md('- 一\n- 二'));
  ok('md 有序列表', (function () { const t = K.md('1. 一\n2. 二'); return t.includes('<ol>') && t.includes('<li>一') && t.includes('</ol>'); })(), K.md('1. 一\n2. 二'));
  ok('md 嵌套列表', (function () { const t = K.md('- 一\n  - 二\n    - 三'); return (t.match(/<ul>/g) || []).length === 3 && t.includes('</ul></ul></ul>'); })(), K.md('- 一\n  - 二\n    - 三'));
  ok('md 引用', K.md('> 引用').includes('<blockquote>引用</blockquote>'), K.md('> 引用'));
  ok('md 表格', (function () { const t = K.md('| a | b |\n|---|---|\n| 1 | 2 |'); return t.includes('<th>a</th>') && t.includes('<td>1</td>'); })(), K.md('| a | b |\n|---|---|\n| 1 | 2 |'));
  ok('md 链接', K.md('[名字](https://x.com)').includes('<a href="https://x.com"'), K.md('[名字](https://x.com)'));
  ok('md XSS 转义', !K.md('<img src=x onerror=alert(1)>').includes('<img'), K.md('<img src=x onerror=alert(1)>'));
  ok('md 段落换行', K.md('第一行\n第二行').includes('<p>第一行<br>第二行</p>'), K.md('第一行\n第二行'));
  ok('md 空输入不炸', K.md('') === '' && K.md(null) === '');

  /* token 估算 */
  ok('estTokens 中文', (function () { const t = K.estTokens('你好世界'); return t >= 2 && t <= 4; })(), String(K.estTokens('你好世界')));
  ok('estTokens 空串', K.estTokens('') === 0);

  /* 请求构造 */
  const conv = {
    summary: '用户叫小明，喜欢简洁的回答。',
    messages: [
      { role: 'user', content: '早期问题', archived: true },
      { role: 'assistant', content: '早期回答', archived: true },
      { role: 'user', content: '现在的问题' },
    ],
  };
  const msgs = K.buildRequestMessages(conv);
  ok('archived 被排除', !msgs.some((m) => m.content === '早期问题'));
  ok('摘要以 system 注入', msgs.some((m) => m.role === 'system' && m.content.includes('小明')));
  ok('近期消息保留', msgs.some((m) => m.content === '现在的问题'));

  /* 会话分组 */
  const now = Date.now();
  ok('分组：今天', K.relGroup(now) === '今天', K.relGroup(now));
  ok('分组：昨天', K.relGroup(now - 86400000 * 1.2) === '昨天', K.relGroup(now - 86400000 * 1.2));
  ok('分组：最近 7 天', K.relGroup(now - 86400000 * 4) === '最近 7 天', K.relGroup(now - 86400000 * 4));

  /* 压缩：按权重挑选 + 分叉新副本，原文一条不删 */
  const c2 = { id: 't', summary: '', archivedCount: 0, messages: [], title: '测试对话' };
  for (let i = 0; i < 40; i++) {
    c2.messages.push({ role: 'user', content: '第' + i + '轮问题，' + '内容'.repeat(200), ts: Date.now() - (40 - i) * 3600000 });
    c2.messages.push({ role: 'assistant', content: '第' + i + '轮回答，' + '内容'.repeat(200), ts: Date.now() - (40 - i) * 3600000 });
  }
  c2.messages.push({ role: 'user', content: '记住：以后都用中文回答', ts: Date.now() });
  K.S.settings.compactChars = 20000;
  ctx.fetch = () => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve({ choices: [{ message: { content: '【记忆】摘要内容' } }] }),
  });
  let copy = null, err = null;
  try { copy = await K.compact(c2); } catch (e) { err = e; }
  ok('压缩成功并返回新副本', !!copy, err ? String(err) : '');
  ok('原对话一条不删（81 条）', c2.messages.length === 81, 'len=' + c2.messages.length);
  ok('原对话没有被标记归档', c2.messages.every((m) => !m.archived));
  ok('副本标题 = 原名 + 副本', !!copy && copy.title === '测试对话 副本', copy && copy.title);
  ok('副本带记忆摘要', !!copy && /摘要内容/.test(copy.summary));
  ok('副本只保留近期消息', !!copy && copy.messages.length > 0 && copy.messages.length < 81, copy && ('len=' + copy.messages.length));
  ok('原对话记录了分叉去向', c2.forkedTo === (copy && copy.id));
  ok('切点落在 user', !copy || !copy.messages.length || copy.messages[0].role === 'user');

  /* 导出：App 内必须走原生保存（WebView 不处理 a.download） */
  let saved = null;
  ctx.window.KoudaiNative = {
    saveFile(name, mime, text) { saved = { name, mime, text }; return '下载/' + name; },
  };
  const okDl = K.downloadFile('测试-2026.md', '# 内容', 'text/markdown');
  ok('导出走原生保存', okDl === true && !!saved, saved ? saved.name : '没调用');
  ok('导出文件名与内容正确', !!saved && saved.name === '测试-2026.md' && saved.text === '# 内容', saved && saved.mime);
  delete ctx.window.KoudaiNative;

  /* 当前时间必须传给模型（只有最后一条用户消息带，别把历史也污染了） */
  const tc = {
    id: 't', summary: '',
    messages: [
      { role: 'user', content: '现在几点', ts: Date.now() },
      { role: 'assistant', content: '……', ts: Date.now() },
      { role: 'user', content: '再说一次', ts: Date.now() },
    ],
  };
  K.S.settings.reminder = true;
  const withReminder = K.buildRequestMessages(tc).filter((m) => m.role === 'latest_reminder');
  const lastR = withReminder[withReminder.length - 1];
  ok('最后一条提醒带当前时间', !!lastR && /现在的时间是 \d{4} 年/.test(lastR.content), lastR && lastR.content.split('\n').pop().slice(0, 40));
  ok('历史提醒不带时间', withReminder.slice(0, -1).every((m) => !/现在的时间是/.test(m.content)));

  K.S.settings.reminder = false;
  const offMsgs = K.buildRequestMessages(tc).filter((m) => m.role === 'latest_reminder');
  ok('关掉提醒也照样告诉时间', offMsgs.length === 1 && /现在的时间是/.test(offMsgs[0].content), 'len=' + offMsgs.length);
  K.S.settings.reminder = true;

  console.log(results.join('\n'));
  const fails = results.filter((r) => r.startsWith('FAIL'));
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' PASS');
  process.exit(fails.length ? 1 : 0);
}, 400);
