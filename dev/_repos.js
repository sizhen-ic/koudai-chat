(async () => {
  const r = await fetch('https://api.github.com/users/sizhen-ic/repos?per_page=100&sort=updated', {
    headers: { 'User-Agent': 'probe', Accept: 'application/vnd.github+json' },
  });
  if (!r.ok) { console.log('API ' + r.status); return; }
  const list = await r.json();
  console.log('公开仓库数量: ' + list.length);
  for (const x of list.slice(0, 20)) console.log('  ' + x.name + '  (' + (x.private ? 'private' : 'public') + ')  ' + (x.description || ''));
  const has = list.find((x) => x.name.toLowerCase() === 'koudai-chat');
  console.log(has ? '\n已存在同名公开仓库: ' + has.full_name : '\n没有公开的 koudai-chat 仓库');
})().catch(e => console.log('ERR ' + e.message));
