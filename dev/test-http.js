/* 验证 HTTP 存储模式：探测 → 读取 → 写入 → 触发 PUT */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const START = '/*__APP_JS_START__*/', END = '/*__APP_JS_END__*/';
let src = HTML.slice(HTML.indexOf(START) + START.length, HTML.indexOf(END));
src = src.replace(/\}\)\(\);\s*$/, 'globalThis.__KD = { S, pushNow, saveSettings };})();');

const results = [];
const ok = (n, c, e) => results.push((c ? 'PASS' : 'FAIL') + '  ' + n + (e ? '   [' + e + ']' : ''));

const els = new Map();
function el(name) {
  const e = {
    __name: name, children: [], dataset: {}, style: {}, value: '', textContent: '', innerHTML: '',
    scrollTop: 0, scrollHeight: 0, clientHeight: 0, files: [],
    classList: { _s: new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)},
      toggle(c,v){ if(v===undefined) v=!this._s.has(c); v?this._s.add(c):this._s.delete(c) }, contains(c){return this._s.has(c)} },
    addEventListener(){}, removeEventListener(){}, setAttribute(){}, getAttribute(){return null},
    appendChild(n){e.children.push(n);return n}, insertBefore(n){e.children.unshift(n);return n},
    remove(){}, focus(){}, click(){}, reload(){},
    querySelector(){return el('stub')}, querySelectorAll(){return []}, closest(){return null},
  };
  return e;
}
const byId = (id) => { if (!els.has(id)) els.set(id, el('#' + id)); return els.get(id); };

const store = new Map();
const calls = [];
let serverState = {
  version: 1,
  convs: { c1: { id: 'c1', title: '服务端会话', createdAt: 1, updatedAt: 1, summary: '', archivedCount: 0, messages: [{ role: 'user', content: '你好', ts: 1 }] } },
  meta: {},
};

function fakeFetch(url, opts = {}) {
  const u = String(url);
  calls.push({ url: u, method: opts.method || 'GET' });
  if (u.includes('api/state') && (opts.method || 'GET') === 'GET') {
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(serverState), text: () => Promise.resolve('') });
  }
  if (u.includes('api/state') && opts.method === 'PUT') {
    serverState = JSON.parse(opts.body);
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }), text: () => Promise.resolve('') });
  }
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
}

const ctx = {
  console: { log() {}, warn() {}, error() {} },
  localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  document: {
    querySelector: (s) => (s.charAt(0) === '#' ? byId(s.slice(1)) : el(s)),
    querySelectorAll: () => [], createElement: (t) => el(t), createDocumentFragment: () => el('#f'),
    addEventListener() {}, body: el('body'), execCommand: () => true, visibilityState: 'visible',
  },
  navigator: {},
  location: { protocol: 'http:', reload() {} },
  window: { addEventListener() {}, innerHeight: 800 },
  setTimeout, clearTimeout, Promise, Math, Date, JSON, Object, Array, String, Number, Error, RegExp, Set, Map,
  confirm: () => true, alert: () => {}, prompt: () => 'x',
  Blob: function () {}, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  fetch: fakeFetch,
  indexedDB: undefined,
};
ctx.globalThis = ctx;
ctx.window.document = ctx.document;

vm.createContext(ctx);
try { vm.runInContext(src, ctx, { filename: 'app.js' }); ok('脚本执行无异常', true); }
catch (e) { ok('脚本执行无异常', false, String(e && e.message)); }

setTimeout(async () => {
  const K = ctx.__KD;
  if (!K) { console.log(results.join('\n') + '\nFAIL 未导出'); process.exit(1); }

  ok('启动时探测了 api/state', calls.some((c) => c.url.includes('api/state') && c.method === 'GET'), JSON.stringify(calls.slice(0, 3)));
  ok('会话已加载', K.S.convs.length === 1, 'convs=' + K.S.convs.length);

  // 写一次设置，应当触发 PUT
  calls.length = 0;
  K.S.settings.apiKey = 'sk-abc';
  K.S.settings.model = 'deepseek-flash';
  await K.saveSettings();
  await K.pushNow();
  const put = calls.find((c) => c.method === 'PUT');
  ok('写入触发 PUT', !!put, JSON.stringify(calls.map((c) => c.method + ' ' + c.url)));
  ok('PUT 内容含设置', !!put && serverState.meta && serverState.meta.settings && serverState.meta.settings.model === 'deepseek-flash',
     JSON.stringify(serverState.meta && serverState.meta.settings));
  ok('PUT 内容含会话', !!serverState.convs && Object.keys(serverState.convs).length === 1);

  console.log(results.join('\n'));
  const fails = results.filter((r) => r.startsWith('FAIL'));
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' PASS');
  process.exit(fails.length ? 1 : 0);
}, 500);
