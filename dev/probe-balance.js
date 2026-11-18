const https = require('node:https');

function probe(label, opts) {
  return new Promise((resolve) => {
    const req = https.request(opts, (res) => {
      const h = res.headers;
      const cors = Object.keys(h).filter((k) => k.startsWith('access-control'));
      let body = '';
      res.on('data', (c) => { if (body.length < 300) body += c; });
      res.on('end', () => {
        console.log('--- ' + label + ' ---');
        console.log('status: ' + res.statusCode);
        console.log('cors: ' + (cors.length ? JSON.stringify(Object.fromEntries(cors.map((k) => [k, h[k]]))) : 'NONE'));
        if (body) console.log('body: ' + body.slice(0, 200));
        resolve();
      });
    });
    req.on('error', (e) => { console.log('--- ' + label + ' --- ERR ' + e.code); resolve(); });
    req.setTimeout(15000, () => { console.log('--- ' + label + ' --- TIMEOUT'); req.destroy(); });
    req.end();
  });
}

(async () => {
  await probe('OPTIONS /user/balance', {
    host: 'api.deepseek.com', path: '/user/balance', method: 'OPTIONS',
    headers: {
      Origin: 'https://appassets.androidplatform.net',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization',
    },
  });
  await probe('GET /user/balance (no key)', {
    host: 'api.deepseek.com', path: '/user/balance', method: 'GET',
    headers: { Origin: 'https://appassets.androidplatform.net' },
  });
})();
