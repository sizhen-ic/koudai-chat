/* 读取 APK v2/v3 签名块里的证书指纹（用于确认签名是否固定） */
const fs = require('node:fs');
const crypto = require('node:crypto');

function u64(b, off) { return Number(b.readBigUInt64LE(off)); }

function certHashes(file) {
  const b = fs.readFileSync(file);
  const magic = Buffer.from('APK Sig Block 42', 'utf8');
  const idx = b.lastIndexOf(magic);
  if (idx < 0) return { error: '没有 v2/v3 签名块' };

  const sizeFieldPos = idx - 8;
  const blockSize = u64(b, sizeFieldPos);
  const blockStart = idx + 8 - blockSize;   // 块起点（含首个 size 字段）
  const pairsStart = blockStart + 8;
  const pairsEnd = sizeFieldPos;

  const ids = [];
  const certs = [];
  let p = pairsStart;
  while (p + 12 <= pairsEnd) {
    const len = u64(b, p);
    const id = b.readUInt32LE(p + 8);
    const vStart = p + 12;
    const vEnd = p + 8 + len;
    if (len <= 4 || vEnd > pairsEnd) break;
    ids.push('0x' + id.toString(16) + '(' + len + 'B)');

    if (id === 0x7109871a || id === 0xf05368c0) {  // v2 / v3
      let q = vStart;
      const signersLen = b.readUInt32LE(q); q += 4;
      const signersEnd = q + signersLen;
      while (q + 4 <= signersEnd) {
        const signerLen = b.readUInt32LE(q); q += 4;
        const signerEnd = q + signerLen;
        if (q + 4 > signerEnd) break;
        const signedLen = b.readUInt32LE(q); q += 4;
        const signedEnd = q + signedLen;
        if (q + 4 > signedEnd) break;
        const digLen = b.readUInt32LE(q); q += 4 + digLen;
        if (q + 4 > signedEnd) break;
        const certsLen = b.readUInt32LE(q); q += 4;
        const certsEnd = q + certsLen;
        while (q + 4 <= certsEnd) {
          const cLen = b.readUInt32LE(q); q += 4;
          if (q + cLen > certsEnd) break;
          const der = b.slice(q, q + cLen);
          q += cLen;
          const h = crypto.createHash('sha256').update(der).digest('hex');
          if (!certs.some((x) => x.h === h)) certs.push({ h, id: '0x' + id.toString(16), len: cLen });
        }
        q = signerEnd;
      }
    }
    p = vEnd;
  }
  return { blockSize, ids, certs };
}

for (const f of process.argv.slice(2)) {
  const r = certHashes(f);
  console.log('\n' + f.replace(/.*[\\/]/, ''));
  if (r.error) { console.log('  ' + r.error); continue; }
  console.log('  签名块 ' + r.blockSize + ' 字节，包含: ' + r.ids.join(' '));
  if (!r.certs.length) { console.log('  未解析出证书'); continue; }
  for (const c of r.certs) {
    console.log('  ' + c.id + '  证书 ' + c.len + ' B  指纹 ' + c.h.slice(0, 32) + '…');
  }
}
