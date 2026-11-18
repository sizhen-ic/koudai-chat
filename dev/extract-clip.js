const fs = require('node:fs');

const SRC = 'C:/Users/zhenge/.dsh/profiles/desktop/node_modules/dsh-boot-animation/lib/clips.data.js';
const OUT = 'C:/Users/zhenge/Documents/deepseek-harness/default-workspace/phone-chat/build';
const ID = process.argv[2] || 'cyberpunk';

console.log('读取 clips.data.js ...');
const s = fs.readFileSync(SRC, 'utf8');
console.log('文件长度:', (s.length / 1024 / 1024).toFixed(1), 'MB');

const re = new RegExp('export const ' + ID + ' = "([A-Za-z0-9+/=]+)"');
const m = re.exec(s);
if (!m) {
  console.log('没找到 clip:', ID);
  const ids = [...s.matchAll(/export const (\w+) = "/g)].map((x) => x[1]);
  console.log('可用的有:', ids.join(', '));
  process.exit(1);
}

const b64 = m[1];
console.log('base64 长度:', (b64.length / 1024 / 1024).toFixed(2), 'MB');
const buf = Buffer.from(b64, 'base64');
const out = OUT + '/' + ID + '.mp4';
fs.writeFileSync(out, buf);
console.log('已写出:', out, (buf.length / 1024 / 1024).toFixed(2), 'MB');
console.log('前 16 字节:', buf.slice(0, 16).toString('hex'));
