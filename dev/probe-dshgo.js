/* 探查 dsh-Go 源码：它在跟谁通信、申请了哪些权限 */
const OWNER = 'ccch1mneyyy';
const REPO = 'dsh-Go';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const RAW = `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/`;

const KEYWORDS = [
  'umami', 'posthog', 'sentry', 'firebase', 'amplitude', 'mixpanel', 'bugly',
  'talkingdata', 'growingio', 'appsflyer', 'adjust', 'datadog', 'bugsnag',
  'google-analytics', 'googletagmanager', 'sensorsdata', 'onesignal',
  'analytics', 'telemetry', 'usage_stats', '事件上报', '埋点',
];

async function j(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'privacy-probe', Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.json();
}
async function text(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'privacy-probe' } });
  if (!r.ok) return null;
  return r.text();
}

(async () => {
  console.log('== 1. 拉取文件树 ==');
  const tree = await j(`${API}/git/trees/main?recursive=1`);
  const all = tree.tree.filter((t) => t.type === 'blob');
  console.log('文件总数: ' + all.length + '  truncated=' + !!tree.truncated);

  const interesting = all
    .filter((t) => t.size && t.size < 400000)
    .filter((t) => /\.(dart|kt|java|js|ts|xml|yaml|yml|json|gradle|kts)$/.test(t.path))
    .filter((t) => !/\.(png|jpg|webp|gif|ttf|otf)$/.test(t.path))
    .filter((t) => /(^app\/|^packages\/|^runtime\/|manifest|privacy|stat|analytics|telemetry|settings)/i.test(t.path));

  console.log('待查文件: ' + interesting.length);

  // 优先：清单、清单权限、任何名字带统计/隐私的
  const prio = interesting.filter((t) => /AndroidManifest|privacy|stat|analytics|telemetry|settings/i.test(t.path));
  const rest = interesting.filter((t) => !prio.includes(t));
  const pick = prio.concat(rest).slice(0, 90);

  console.log('实际下载: ' + pick.length + '\n');

  const hosts = new Map();
  const kwHits = [];
  const perms = [];

  let idx = 0;
  async function worker() {
    while (idx < pick.length) {
      const f = pick[idx++];
      let body;
      try { body = await text(RAW + f.path.split('/').map(encodeURIComponent).join('/')); }
      catch (e) { continue; }
      if (!body) continue;

      if (/AndroidManifest\.xml$/.test(f.path)) {
        for (const m of body.matchAll(/<uses-permission[^>]*android:name="([^"]+)"/g)) {
          perms.push({ file: f.path, perm: m[1] });
        }
      }

      const lower = body.toLowerCase();
      for (const k of KEYWORDS) {
        if (lower.includes(k.toLowerCase())) {
          const line = body.split('\n').find((l) => l.toLowerCase().includes(k.toLowerCase()));
          kwHits.push({ file: f.path, kw: k, line: (line || '').trim().slice(0, 160) });
        }
      }

      for (const m of body.matchAll(/https?:\/\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/g)) {
        let u;
        try { u = new URL(m[0]); } catch (e) { continue; }
        const h = u.host;
        if (!h) continue;
        if (/github|githubusercontent|schema\.org|w3\.org|json-schema|kotlinlang|dart\.dev|flutter\.dev|pub\.dev|apache\.org|android\.com|google\.com\/?$|example\.com|localhost|127\.0\.0\.1|deepseek\.com|api\.deepseek/.test(h)) continue;
        if (!hosts.has(h)) hosts.set(h, { count: 0, files: new Set() });
        const rec = hosts.get(h);
        rec.count++;
        rec.files.add(f.path);
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);

  console.log('== 2. 权限（AndroidManifest） ==');
  if (!perms.length) console.log('  没找到 AndroidManifest 里的 uses-permission');
  const uniqPerm = [...new Set(perms.map((p) => p.perm))].sort();
  uniqPerm.forEach((p) => console.log('  ' + p));

  console.log('\n== 3. 第三方 SDK / 埋点关键词 ==');
  if (!kwHits.length) console.log('  没命中');
  const seen = new Set();
  for (const h of kwHits) {
    const key = h.kw;
    if (seen.has(key)) continue;
    seen.add(key);
    console.log('  [' + h.kw + '] ' + h.file + ' :: ' + h.line);
  }

  console.log('\n== 4. 出现的外部域名（按出现次数） ==');
  const sorted = [...hosts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 40);
  if (!sorted.length) console.log('  没找到（可能排除规则太宽）');
  for (const [h, rec] of sorted) {
    console.log('  ' + h.padEnd(42) + ' x' + String(rec.count).padEnd(4) + '  ' + [...rec.files].slice(0, 2).join(', '));
  }
})().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
