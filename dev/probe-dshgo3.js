/* 打印 usage_stats.dart 与 usage_stats_section.dart 的关键内容 */
const RAW = 'https://raw.githubusercontent.com/ccch1mneyyy/dsh-Go/main/';
const FILES = [
  'app/lib/usage/usage_stats.dart',
  'app/lib/ui/settings/usage_stats_section.dart',
  'app/android/app/src/main/kotlin/io/github/ccch1mneyyy/dsh_app/usage/UsagePlugin.kt',
];

(async () => {
  for (const f of FILES) {
    const url = RAW + f.split('/').map(encodeURIComponent).join('/');
    const r = await fetch(url, { headers: { 'User-Agent': 'probe' } });
    if (!r.ok) { console.log('### ' + f + ' -> ' + r.status); continue; }
    const body = await r.text();
    console.log('\n\n########## ' + f + '  (' + body.length + ' chars) ##########\n');
    console.log(body);
  }
})().catch((e) => { console.error('ERROR ' + e.message); process.exit(1); });
