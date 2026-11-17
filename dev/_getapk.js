const fs = require('node:fs');
const OWNER = 'sizhen-ic', REPO = 'koudai-chat';
const H = { 'User-Agent': 'probe', Accept: 'application/vnd.github+json' };
const OUT = 'C:/Users/zhenge/Documents/deepseek-harness/default-workspace/phone-chat/build/koudai-apk.zip';

(async () => {
  const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/artifacts?per_page=9`, { headers: H });
  if (!r.ok) { console.log('artifacts API ' + r.status); return; }
  const j = await r.json();
  console.log('产物数量: ' + j.total_count);
  for (const a of j.artifacts) {
    console.log(`  ${a.name}  id=${a.id}  ${(a.size_in_bytes / 1024 / 1024).toFixed(2)} MB  expired=${a.expired}`);
  }
  const live = j.artifacts.filter((a) => !a.expired).sort((x, y) => y.id - x.id)[0];
  if (!live) { console.log('没有可用产物'); return; }

  console.log('\n下载: ' + live.name + ' (id=' + live.id + ')');
  const dl = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/artifacts/${live.id}/zip`, {
    headers: { 'User-Agent': 'probe' },
    redirect: 'follow',
  });
  if (!dl.ok) { console.log('下载失败 ' + dl.status + ' ' + (await dl.text()).slice(0, 200)); return; }
  const buf = Buffer.from(await dl.arrayBuffer());
  fs.mkdirSync('C:/Users/zhenge/Documents/deepseek-harness/default-workspace/phone-chat/build', { recursive: true });
  fs.writeFileSync(OUT, buf);
  console.log('已保存: ' + OUT + '  (' + (buf.length / 1024).toFixed(0) + ' KB)');
})().catch((e) => console.log('ERR ' + e.message));
