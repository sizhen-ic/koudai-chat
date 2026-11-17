const fs = require('node:fs');
const path = require('node:path');

const root = path.join(process.env.DSH_INSTALL_DIR, 'docs');
const terms = ['imagePixelBudget', 'imageMaxBytes', 'inputModalities', 'image_url', 'multimodal'];
const hits = [];

function walk(dir, depth) {
  if (depth > 3) return;
  let items = [];
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) { walk(p, depth + 1); continue; }
    if (!/\.(md|json)$/.test(it.name)) continue;
    let txt = '';
    try { txt = fs.readFileSync(p, 'utf8'); } catch (e) { continue; }
    if (txt.length > 900000) continue;
    const lines = txt.split('\n');
    for (const term of terms) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].indexOf(term) >= 0) {
          hits.push({ file: path.relative(root, p), line: i + 1, term, text: lines[i].trim().slice(0, 220) });
        }
      }
    }
  }
}
walk(root, 0);

const byFile = new Map();
for (const h of hits) {
  if (!byFile.has(h.file)) byFile.set(h.file, []);
  byFile.get(h.file).push(h);
}
console.log('total hits: ' + hits.length + ' in ' + byFile.size + ' files\n');
let n = 0;
for (const [file, list] of byFile) {
  console.log('### ' + file);
  for (const h of list.slice(0, 6)) {
    console.log('  [' + h.term + '] L' + h.line + ': ' + h.text);
  }
  console.log('');
  if (++n > 12) { console.log('...'); break; }
}
