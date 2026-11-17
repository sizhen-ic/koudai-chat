/* 第二轮：把 app/lib 下的 Dart 全扫一遍，找"匿名统计"到底上报了什么 */
const OWNER = 'ccch1mneyyy', REPO = 'dsh-Go';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/`;

const WANT = ['匿名', 'anonymous', 'telemetry', 'analytics', '上报', '统计', 'usage_stats', '事件'];

async function j(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'probe', Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.json();
}

(async () => {
  const tree = await j(`${API}/git/trees/main?recursive=1`);
  const blobs = tree.tree.filter((t) => t.type === 'blob' && t.size);

  const lib = blobs.filter((t) => /^app\/lib\/.*\.dart$/.test(t.path) && t.size < 90000);
  const android = blobs.filter((t) => /^app\/android\/app\/src\/main\/.*\.(xml|kt)$/.test(t.path) && t.size < 200000);
  console.log('app/lib dart: ' + lib.length + '   android 配置: ' + android.length);

  const pick = lib.concat(android);
  const files = new Map();
  let i = 0;
  async function worker() {
    while (i < pick.length) {
      const f = pick[i++];
      const url = RAW + f.path.split('/').map(encodeURIComponent).join('/');
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'probe' } });
        if (r.ok) files.set(f.path, await r.text());
      } catch (e) { /* skip */ }
    }
  }
  await Promise.all(Array.from({ length: 10 }, worker));
  console.log('成功下载: ' + files.size + '\n');

  /* --- A. 关键词命中 --- */
  console.log('== A. "统计/上报/匿名" 相关代码 ==');
  const hits = [];
  for (const [path, body] of files) {
    const lines = body.split('\n');
    for (let n = 0; n < lines.length; n++) {
      const l = lines[n];
      for (const w of WANT) {
        if (l.includes(w)) { hits.push({ path, n: n + 1, w, line: l.trim().slice(0, 170) }); break; }
      }
    }
  }
  console.log('命中行数: ' + hits.length);
  for (const h of hits.slice(0, 60)) console.log('  ' + h.path + ':' + h.n + '  ' + h.line);

  /* --- B. 外部域名 --- */
  console.log('\n== B. 代码里出现的域名 ==');
  const hosts = new Map();
  for (const [path, body] of files) {
    for (const m of body.matchAll(/https?:\/\/([A-Za-z0-9._-]+)/g)) {
      const h = m[1].toLowerCase();
      if (/github|githubusercontent|schema|w3\.org|dart\.dev|flutter\.dev|pub\.dev|apache|android\.com|kotlinlang|gradle|maven|json-schema|example\.com|localhost|127\.|deepseek|w3|xmlns/.test(h)) continue;
      if (!hosts.has(h)) hosts.set(h, new Set());
      hosts.get(h).add(path);
    }
  }
  for (const [h, set] of [...hosts.entries()].sort((a, b) => b[1].size - a[1].size)) {
    console.log('  ' + h.padEnd(40) + ' 出现在 ' + set.size + ' 个文件，例如 ' + [...set][0]);
  }

  /* --- C. 无障碍 / Shizuku / 包可见性 --- */
  console.log('\n== C. AndroidManifest 里的服务与特殊声明 ==');
  const man = files.get('app/android/app/src/main/AndroidManifest.xml') || '';
  for (const tag of ['service', 'queries', 'package ', 'accessibility']) {
    const hits2 = man.split('\n').filter((l) => l.includes(tag));
    if (hits2.length) {
      console.log('  -- ' + tag + ' --');
      hits2.slice(0, 8).forEach((l) => console.log('    ' + l.trim().slice(0, 190)));
    }
  }

  /* --- D. 网络出口集中点 --- */
  console.log('\n== D. 疑似"上报"的客户端类（文件名含 report/track/stat/anon）==');
  for (const path of files.keys()) {
    if (/report|track|stat|anon|telemetry|analytics/i.test(path)) console.log('  ' + path);
  }
})().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
