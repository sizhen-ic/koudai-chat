/* 数学公式渲染：KaTeX 已加载 / 未加载 两种情况 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DIR = path.join(__dirname, '..') + '/';
const HTML = fs.readFileSync(DIR + 'index.html', 'utf8');
const START = '/*__APP_JS_START__*/', END = '/*__APP_JS_END__*/';
let src = HTML.slice(HTML.indexOf(START) + START.length, HTML.indexOf(END));
src = src.replace(/\}\)\(\);\s*$/, 'globalThis.__KD = { md, renderMath };})();');

const results = [];
const ok = (n, c, e) => results.push((c ? 'PASS' : 'FAIL') + '  ' + n + (e ? '   [' + String(e).slice(0, 160) + ']' : ''));

function makeCtx(withKatex) {
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
  ctx.window.self = ctx;
  vm.createContext(ctx);

  if (withKatex) {
    const katex = fs.readFileSync(DIR + 'katex/katex.min.js', 'utf8');
    try { vm.runInContext(katex, ctx, { filename: 'katex.min.js' }); } catch (e) { results.push('WARN katex 加载失败: ' + e.message); }
    ctx.window.katex = ctx.katex;
  }
  vm.runInContext(src, ctx, { filename: 'app.js' });
  return ctx;
}

setTimeout(() => {
  /* ---- 有 KaTeX ---- */
  const a = makeCtx(true);
  const A = a.__KD;
  ok('KaTeX 已加载', !!(a.katex || (a.window && a.window.katex)), Object.keys(a).filter(k => /katex/i.test(k)).join(','));

  const inline = A.md('能量公式是 $E=mc^2$，很经典。');
  ok('行内公式被渲染', inline.indexOf('class="katex"') >= 0, inline.slice(0, 120));
  ok('公式源码不再裸露', inline.indexOf('mc^2') < 0 || inline.indexOf('katex') >= 0);

  const block = A.md('$$\n\\frac{a}{b} = c\n$$');
  ok('块级公式被渲染', block.indexOf('katex-display') >= 0, block.slice(0, 120));

  const bracket = A.md('\\[\\int_0^1 x\\,dx\\]');
  ok('\\[...\\] 被渲染', bracket.indexOf('katex') >= 0, bracket.slice(0, 120));

  const paren = A.md('\\(a^2+b^2=c^2\\)');
  ok('\\(...\\) 被渲染', paren.indexOf('katex') >= 0, paren.slice(0, 120));

  const money = A.md('这个 $5，那个 $10');
  ok('价格不被误判为公式', money.indexOf('katex') < 0, money.slice(0, 120));

  const mixed = A.md('**结论**：$x^2 \\geq 0$\n\n- 第一点\n- 第二点');
  ok('公式与 Markdown 共存', mixed.indexOf('<strong>结论</strong>') >= 0 && mixed.indexOf('katex') >= 0, mixed.slice(0, 160));

  const bad = A.md('$\\frac{a}{');
  ok('残缺公式不崩', typeof bad === 'string' && bad.length > 0, bad.slice(0, 80));

  /* ---- 没有 KaTeX（回退） ---- */
  const ctxNo = makeCtx(false);
  const n = ctxNo.__KD.md('$E=mc^2$');
  ok('无 KaTeX 时退回等宽显示', n.indexOf('class="tex"') >= 0, n.slice(0, 120));

  console.log(results.join('\n'));
  const fails = results.filter((r) => r.startsWith('FAIL'));
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' PASS');
  process.exit(fails.length ? 1 : 0);
}, 300);
