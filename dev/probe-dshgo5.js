const RAW = 'https://raw.githubusercontent.com/ccch1mneyyy/dsh-Go/main/';
(async () => {
  const r = await fetch(RAW + 'app/android/app/src/main/AndroidManifest.xml', { headers: { 'User-Agent': 'p' } });
  const body = await r.text();
  const lines = body.split('\n');
  console.log('== application 标签与关键开关 ==');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/allowBackup|fullBackupContent|dataExtractionRules|usesCleartextTraffic|debuggable|networkSecurityConfig|requestLegacyExternalStorage|preserveLegacyExternalStorage|accessibilityservice|exported="true"/.test(l)) {
      console.log(String(i + 1).padStart(4) + ': ' + l.trim().slice(0, 200));
    }
  }
  console.log('\n== 所有 service 声明的 label/name ==');
  for (const m of body.matchAll(/<service[\s\S]{0,400}?\/>/g)) {
    const blk = m[0];
    const name = (blk.match(/android:name="([^"]+)"/) || [])[1];
    const exp = (blk.match(/android:exported="([^"]+)"/) || [])[1];
    if (name) console.log('  ' + name.split('.').pop() + '   exported=' + (exp || 'default'));
  }
})();
