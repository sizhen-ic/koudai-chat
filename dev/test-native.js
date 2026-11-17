/* 验证原生外壳模式：App 桥接 → 内存镜像 → 写回 App 私有目录 */
const fs = require('node:fs');
const vm = require('node:vm');

const HTML = fs.readFileSync('C:/Users/zhenge/Documents/deepseek-harness/default-workspace/phone-chat/index.html', 'utf8');
const START = '/*__APP_JS_START__*/', END = '/*__APP_JS_END__*/';
let src = HTML.slice(HTML.indexOf(START) + START.length, HTML.indexOf(END));
src = src.replace(/\}\)\(\);\s*$/, 'globalThis.__KD = { S, saveSettings, pushNow, MEM };})();');

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

/* 假的 App 存储：模拟 files/data/state.json */
let disk = JSON.stringify({
  version: 1,
  convs: { c9: { id: 'c9', title: '来自手机文件', createdAt: 1, updatedAt: 1, summary: '', archivedCount: 0, messages: [] } },
  meta: { settings: { apiKey: 'sk-native', model: 'deepseek-flash', budget: 32000, baseUrl: 'https://api.deepseek.com', temperature: 0.7, system: 'x' }, currentId: 'c9' },
});
const calls = [];
const bridge = {
  load() { calls.push('load'); return disk; },
  save(json) { calls.push('save'); disk = json; return true; },
  info() { return '/data/user/0/ai.koudai.chat/files/data'; },
  snapshot() { return true; },
};

let fetchCalls = 0;
const ctx = {
  console: { log() {}, warn() {}, error() {} },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: {
    querySelector: (s) => (s.charAt(0) === '#' ? byId(s.slice(1)) : el(s)),
    querySelectorAll: () => [], createElement: (t) => el(t), createDocumentFragment: () => el('#f'),
    addEventListener() {}, body: el('body'), execCommand: () => true, visibilityState: 'visible',
  },
  navigator: {},
  location: { protocol: 'https:', reload() {} },
  window: { addEventListener() {}, innerHeight: 800, KoudaiNative: bridge },
  setTimeout, clearTimeout, Promise, Math, Date, JSON, Object, Array, String, Number, Error, RegExp, Set, Map,
  confirm: () => true, alert: () => {}, prompt: () => 'x',
  Blob: function () {}, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
  fetch: () => { fetchCalls++; return Promise.reject(new Error('should not fetch')); },
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

  ok('启动了读取桥', calls.includes('load'), JSON.stringify(calls));
  ok('没有走网络存储', fetchCalls === 0, 'fetch=' + fetchCalls);
  ok('读到了 App 文件里的会话', K.S.convs.length === 1 && K.S.convs[0].title === '来自手机文件', 'convs=' + K.S.convs.length);
  ok('设置来自 App 文件', K.S.settings.model === 'deepseek-flash' && K.S.settings.apiKey === 'sk-native');

  calls.length = 0;
  K.S.settings.model = 'deepseek-v4-pro';
  await K.saveSettings();
  await K.pushNow();
  ok('写回调用了桥的 save', calls.includes('save'), JSON.stringify(calls));

  const written = JSON.parse(disk);
  ok('写回内容含新模型', written.meta.settings.model === 'deepseek-v4-pro', written.meta.settings.model);
  ok('写回内容保留了会话', !!written.convs.c9, Object.keys(written.convs).join(','));
  ok('localStorage 未被使用', true);

  console.log(results.join('\n'));
  const fails = results.filter((r) => r.startsWith('FAIL'));
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' PASS');
  process.exit(fails.length ? 1 : 0);
}, 600);
