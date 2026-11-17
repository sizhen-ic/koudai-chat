const https = require('node:https');

function probe(label, opts) {
  return new Promise((resolve) => {
    const req = https.request(opts, (res) => {
      const h = res.headers;
      const cors = Object.keys(h).filter((k) => k.startsWith('access-control'));
      console.log('--- ' + label + ' ---');
      console.log('status: ' + res.statusCode);
      console.log('cors: ' + (cors.length ? JSON.stringify(Object.fromEntries(cors.map((k) => [k, h[k]]))) : 'NONE'));
      res.resume();
      resolve();
    });
    req.on('error', (e) => { console.log('--- ' + label + ' --- ERROR ' + e.code); resolve(); });
    req.setTimeout(20000, () => { console.log('--- ' + label + ' --- TIMEOUT'); req.destroy(); });
    req.end();
  });
}

(async () => {
  // 文件上传：multipart + Authorization 会触发预检
  await probe('OPTIONS /files', {
    host: 'api.deepseek.com', path: '/files', method: 'OPTIONS',
    headers: {
      'Origin': 'http://127.0.0.1:8080',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  // GET /models 预检
  await probe('OPTIONS /models', {
    host: 'api.deepseek.com', path: '/models', method: 'GET',
    headers: { 'Origin': 'http://127.0.0.1:8080' },
  });
  // chat/completions 带工具参数时会不会多要求 header
  await probe('OPTIONS /chat/completions (tools)', {
    host: 'api.deepseek.com', path: '/chat/completions', method: 'OPTIONS',
    headers: {
      'Origin': 'http://127.0.0.1:8080',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type,x-request-id',
    },
  });
})();
