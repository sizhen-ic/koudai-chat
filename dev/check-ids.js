const fs = require('node:fs');
const path = require('node:path');
const p = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(p, 'utf8');

const defined = new Set();
for (const m of src.matchAll(/\bid="([^"]+)"/g)) defined.add(m[1]);

const used = new Set();
for (const m of src.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)) used.add(m[1]);
for (const m of src.matchAll(/getElementById\('([A-Za-z0-9_-]+)'\)/g)) used.add(m[1]);

const missing = [...used].filter((x) => !defined.has(x));
const unused = [...defined].filter((x) => !used.has(x));

console.log('定义 id: ' + defined.size + ' -> ' + [...defined].join(', '));
console.log('引用 id: ' + used.size + ' -> ' + [...used].join(', '));
console.log(missing.length ? "FAIL 引用了不存在的 id: " + missing.join(', ') : "PASS 所有 $('#id') 都有对应元素");
console.log('仅 CSS/结构使用的 id: ' + (unused.join(', ') || '（无）'));

// 检查 class 名在 JS 与 CSS 中的一致性（粗查）
const cssClasses = new Set();
const styleBlock = src.slice(src.indexOf('<style>'), src.indexOf('</style>'));
for (const m of styleBlock.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)) cssClasses.add(m[1]);
const jsClasses = new Set();
for (const m of src.matchAll(/className\s*=\s*'([^']+)'/g)) m[1].split(/\s+/).forEach((c) => c && jsClasses.add(c));
for (const m of src.matchAll(/classList\.(?:add|remove|toggle)\('([^']+)'\)/g)) jsClasses.add(m[1]);

const noStyle = [...jsClasses].filter((c) => !cssClasses.has(c));
console.log(noStyle.length ? 'WARN 以下 class 没有对应样式: ' + noStyle.join(', ') : 'PASS 动态 class 都有样式定义');

process.exit(missing.length ? 1 : 0);
