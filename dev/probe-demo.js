const targets = [
  ['https://cdn.deepseek.com/chat-demo', 'GET'],
  ['https://cdn.deepseek.com/chat-demo/', 'GET'],
  ['https://raw.githubusercontent.com/deepseek-ai/chat-demo/main/README.md', 'GET'],
];

(async () => {
  for (const [url, method] of targets) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const r = await fetch(url, { method, signal: ctrl.signal, headers: { 'User-Agent': 'probe' } });
      clearTimeout(t);
      const ct = r.headers.get('content-type') || '';
      const len = r.headers.get('content-length') || '?';
      console.log('\n=== ' + url);
      console.log('status=' + r.status + '  type=' + ct + '  len=' + len);
      if (ct.includes('text') || ct.includes('json') || ct.includes('markdown')) {
        const body = await r.text();
        console.log('--- body (' + body.length + ' chars) ---');
        console.log(body.slice(0, 3000));
      }
    } catch (e) {
      console.log('\n=== ' + url + '  ERROR ' + e.message);
    }
  }
})();
