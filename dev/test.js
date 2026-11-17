/* Node + 最小 DOM 桩：验证启动路径、Markdown、压缩算法、模型/会话逻辑 */
const fs = require('node:fs');
const vm = require('node:vm');

const BASE = 'C:/Users/zhenge/Documents/deepseek-harness/default-workspace/phone-chat/';
const HTML = fs.readFileSync(BASE + 'index.html', 'utf8');
const START = '/*__APP_JS_START__*/';
const END = '/*__APP_JS_END__*/';
const i1 = HTML.indexOf(START);
const i2 = HTML.indexOf(END);
let src = HTML.slice(i1 + START.length, i2);
src = src.replace(/\}\)\(\);\s*$/, 'globalThis.__KD = { estTokens, md, usageOf, buildRequestMessages, compact, relGroup, S, DEFAULTS };})();');

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
  ok('上下文文案', /上下文 0%/.test(byId('ctxText').textContent), byId('ctxText').textContent);

  /* Markdown */
  ok('md 粗体', K.md('**粗体**').includes('<strong>粗体</strong>'), K.md('**粗体**'));
  ok('md 斜体', K.md('*斜*').includes('<em>斜</em>'), K.md('*斜*'));
  ok('md 行内代码', K.md('用 `x=1` 表示').includes('<code>x=1</code>'));
  ok('md 代码块 + 复制按钮', /<div class="codebox"><button class="cpy"/.test(K.md('```js\nlet a=1;\n```')), K.md('```js\nlet a=1;\n```').slice(0, 80));
  ok('md 代码块转义', K.md('```\na < b && c > d\n```').includes('&lt;') && !K.md('```\na<b\n```').includes('a<b'));
  ok('md 标题', K.md('## 小标题').includes('<h2>小标题</h2>'), K.md('## 小标题'));
  ok('md 无序列表', K.md('- 一\n- 二').includes('<ul><li>一</li><li>二</li></ul>'), K.md('- 一\n- 二'));
  ok('md 有序列表', K.md('1. 一\n2. 二').includes('<ol><li>一</li><li>二</li></ol>'), K.md('1. 一\n2. 二'));
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

  /* 压缩 */
  const c2 = { id: 't', summary: '', archivedCount: 0, messages: [], title: 't' };
  for (let i = 0; i < 40; i++) {
    c2.messages.push({ role: 'user', content: '第' + i + '轮问题，' + '内容'.repeat(200) });
    c2.messages.push({ role: 'assistant', content: '第' + i + '轮回答，' + '内容'.repeat(200) });
  }
  K.S.settings.budget = 8000;
  const before = c2.messages.filter((m) => !m.archived).length;
  ctx.fetch = () => Promise.resolve({
    ok: true, status: 200,
    json: () => Promise.resolve({ choices: [{ message: { content: '【记忆】摘要内容' } }] }),
  });
  let okc = false, err = null;
  try { okc = await K.compact(c2); } catch (e) { err = e; }
  const after = c2.messages.filter((m) => !m.archived).length;
  ok('压缩执行成功', okc === true, err ? String(err) : '');
  ok('原文完整保留（80 条）', c2.messages.length === 80, 'len=' + c2.messages.length);
  ok('活跃消息减少', after < before, before + ' → ' + after);
  ok('摘要写入', /摘要内容/.test(c2.summary));
  ok('切点落在 user', c2.messages.filter((m) => !m.archived)[0].role === 'user');

  console.log(results.join('\n'));
  const fails = results.filter((r) => r.startsWith('FAIL'));
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' PASS');
  process.exit(fails.length ? 1 : 0);
}, 400);
