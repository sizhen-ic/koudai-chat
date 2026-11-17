/* v1.1 新功能：附件请求构造、用途判定、思考/联网参数 */
const fs = require('node:fs');
const vm = require('node:vm');

const HTML = fs.readFileSync('C:/Users/zhenge/Documents/deepseek-harness/default-workspace/phone-chat/index.html', 'utf8');
const START = '/*__APP_JS_START__*/', END = '/*__APP_JS_END__*/';
let src = HTML.slice(HTML.indexOf(START) + START.length, HTML.indexOf(END));
src = src.replace(/\}\)\(\);\s*$/, 'globalThis.__KD = { S, buildRequestMessages, buildChatBody, purposeOf, filesEndpoint, humanSize };})();');

const results = [];
const ok = (n, c, e) => results.push((c ? 'PASS' : 'FAIL') + '  ' + n + (e ? '   [' + e + ']' : ''));

const els = new Map();
function el(name) {
  const e = {
    __name: name, children: [], dataset: {}, style: {}, value: '', textContent: '', innerHTML: '', checked: false,
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

const ctx = {
  console: { log(){}, warn(){}, error(){} },
  localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  document: {
    querySelector: (s) => (s.charAt(0) === '#' ? byId(s.slice(1)) : el(s)),
    querySelectorAll: () => [], createElement: (t) => el(t), createDocumentFragment: () => el('#f'),
    addEventListener(){}, body: el('body'), execCommand: () => true, visibilityState: 'visible',
  },
  navigator: {}, location: { protocol: 'file:', reload(){} },
  window: { addEventListener(){}, innerHeight: 800 },
  setTimeout, clearTimeout, Promise, Math, Date, JSON, Object, Array, String, Number, Error, RegExp, Set, Map,
  confirm: () => true, alert(){}, prompt: () => 'x',
  Blob: function(){}, URL: { createObjectURL: () => 'blob:x', revokeObjectURL(){} },
  fetch: () => Promise.reject(new Error('offline')),
  indexedDB: undefined,
};
ctx.globalThis = ctx;
ctx.window.document = ctx.document;

vm.createContext(ctx);
try { vm.runInContext(src, ctx, { filename: 'app.js' }); ok('脚本执行无异常', true); }
catch (e) { ok('脚本执行无异常', false, String(e && e.message)); }

setTimeout(() => {
  const K = ctx.__KD;
  if (!K) { console.log(results.join('\n') + '\nFAIL 未导出'); process.exit(1); }

  /* ---- 附件用途 ---- */
  ok('图片 → user_data', K.purposeOf({ name: 'a.jpg', type: 'image/jpeg' }) === 'user_data');
  ok('PDF（默认）→ text_recognition', K.purposeOf({ name: 'a.pdf', type: '' }) === 'text_recognition');
  K.S.settings.richLayout = true;
  ok('PDF（开启图文）→ rich_layout', K.purposeOf({ name: 'a.pdf', type: '' }) === 'rich_layout_recognition');
  K.S.settings.richLayout = false;
  ok('Word → text_recognition', K.purposeOf({ name: 'b.docx', type: '' }) === 'text_recognition');
  ok('txt → user_data', K.purposeOf({ name: 'c.txt', type: 'text/plain' }) === 'user_data');
  ok('xlsx → user_data', K.purposeOf({ name: 'd.xlsx', type: '' }) === 'user_data');

  /* ---- Files 端点 ---- */
  K.S.settings.baseUrl = 'https://api.deepseek.com';
  ok('根地址 → /files', K.filesEndpoint() === 'https://api.deepseek.com/files', K.filesEndpoint());
  K.S.settings.baseUrl = 'https://api.deepseek.com/v1';
  ok('带 /v1 → 仍 /files', K.filesEndpoint() === 'https://api.deepseek.com/files', K.filesEndpoint());

  /* ---- 请求构造：文字 + 附件 ---- */
  const conv = { summary: '', messages: [
    { role: 'user', content: '看看这张图', atts: [{ kind: 'image', name: 'x.png', fileId: 'file-api-1', thumb: 'data:x' }] },
    { role: 'assistant', content: '好的' },
    { role: 'user', content: '', atts: [{ kind: 'file', name: 'a.pdf', fileId: 'file-api-2' }] },
  ] };
  const msgs = K.buildRequestMessages(conv);
  const withText = msgs.find((m) => Array.isArray(m.content));
  ok('有附件的消息变成内容数组', !!withText, JSON.stringify(msgs.map(m => typeof m.content)));
  ok('数组里有 text 块', !!(withText && withText.content[0] && withText.content[0].type === 'text'));
  const fileBlocks = (withText ? withText.content : []).filter((b) => b.type === 'file');
  ok('数组里有 file 块并带 file_id', fileBlocks.length === 1 && fileBlocks[0].file_id === 'file-api-1', JSON.stringify(fileBlocks));
  const onlyAtt = msgs.filter((m) => Array.isArray(m.content)).pop();
  ok('纯附件消息不含空 text 块', onlyAtt && onlyAtt.content.every((b) => b.type !== 'text'), JSON.stringify(onlyAtt && onlyAtt.content));

  /* ---- 思考 / 联网参数 ---- */
  K.S.settings.think = false; K.S.settings.web = false;
  let b = K.buildChatBody([{ role: 'user', content: 'x' }]);
  ok('关思考 → thinking.disabled', b.thinking && b.thinking.type === 'disabled', JSON.stringify(b.thinking));
  ok('关思考 → 带 temperature', typeof b.temperature === 'number');
  ok('关联网 → 没有 tools', !b.tools);

  K.S.settings.think = true;
  b = K.buildChatBody([{ role: 'user', content: 'x' }]);
  ok('开思考 → thinking.enabled', b.thinking && b.thinking.type === 'enabled');
  ok('开思考 → reasoning_effort', b.reasoning_effort === 'high', String(b.reasoning_effort));
  ok('开思考 → 不带 temperature', b.temperature === undefined);

  K.S.settings.web = true;
  b = K.buildChatBody([{ role: 'user', content: 'x' }]);
  ok('开联网 → 两个服务端工具', Array.isArray(b.tools) && b.tools.length === 2, JSON.stringify(b.tools));
  ok('工具名正确', b.tools[0].type === 'deepseek_web_search' && b.tools[1].type === 'deepseek_read_url');

  console.log(results.join('\n'));
  const fails = results.filter((r) => r.startsWith('FAIL'));
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' PASS');
  process.exit(fails.length ? 1 : 0);
}, 500);
