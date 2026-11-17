const RAW = 'https://raw.githubusercontent.com/ccch1mneyyy/dsh-Go/main/';
async function get(f) {
  const r = await fetch(RAW + f, { headers: { 'User-Agent': 'probe' } });
  return r.ok ? await r.text() : '## ' + r.status;
}

(async () => {
  const stats = await get('app/lib/usage/usage_stats.dart');
  const lines = stats.split('\n');
  console.log('########## usage_stats.dart 尾部（发送逻辑） ##########');
  console.log(lines.slice(200).join('\n').slice(0, 7000));

  console.log('\n\n########## usage_ledger.dart ##########');
  console.log((await get('app/lib/usage/usage_ledger.dart')).slice(0, 5000));

  console.log('\n\n########## usage_net.dart ##########');
  console.log((await get('app/lib/usage/usage_net.dart')).slice(0, 3000));

  console.log('\n\n########## UsagePlugin.kt ##########');
  console.log((await get('app/android/app/src/main/kotlin/io/github/ccch1mneyyy/dsh_app/usage/UsagePlugin.kt')).slice(0, 6000));

  console.log('\n\n########## usage_stats_section.dart ##########');
  console.log((await get('app/lib/ui/settings/usage_stats_section.dart')).slice(0, 4000));
})().catch((e) => { console.error('ERROR ' + e.message); process.exit(1); });
