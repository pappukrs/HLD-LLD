// H32 · Blob storage: presigned multipart upload, per-part retry, block dedup, lifecycle cost.
// Run: npx tsx hld/6-building-blocks/H32-blob-storage/demo.ts
import { createHash, createHmac } from 'node:crypto';

const MB = 1024 * 1024;
const SECRET = 'server-side-signing-secret';

// ---- 1. Presigned URL: the API signs, it never touches the bytes ----
function presign(key: string, verb: 'PUT' | 'GET', expiresAt: number): string {
  const sig = createHmac('sha256', SECRET).update(`${verb}\n${key}\n${expiresAt}`).digest('hex').slice(0, 16);
  return `https://bucket.s3/${key}?verb=${verb}&exp=${expiresAt}&sig=${sig}`;
}
function verify(url: string, verb: string, now: number): string {
  const u = new URL(url);
  const key = u.pathname.slice(1);
  const exp = Number(u.searchParams.get('exp'));
  const good = createHmac('sha256', SECRET).update(`${verb}\n${key}\n${exp}`).digest('hex').slice(0, 16);
  if (u.searchParams.get('verb') !== verb || u.searchParams.get('sig') !== good) return '403 bad signature';
  if (now > exp) return '403 expired';
  return '200 ok';
}

// ---- 2. Multipart upload over a flaky network ----
// Deterministic "network": a part fails on its first try if (part * 7) % 5 === 0.
function sendPart(part: number, attempt: number): boolean {
  return !(attempt === 1 && (part * 7) % 5 === 0);
}
function multipartUpload(sizeBytes: number, partSize: number, parallel: number) {
  const parts = Math.ceil(sizeBytes / partSize);
  let sentBytes = 0;
  let retries = 0;
  const etags: string[] = [];
  for (let p = 1; p <= parts; p++) {
    const bytes = Math.min(partSize, sizeBytes - (p - 1) * partSize);
    let attempt = 1;
    while (!sendPart(p, attempt)) {
      sentBytes += bytes; // wasted, but only this part
      retries++;
      attempt++;
    }
    sentBytes += bytes;
    etags.push(`"etag-${p}"`);
  }
  const rounds = Math.ceil(parts / parallel);
  return { parts, retries, sentBytes, etags, rounds };
}

// ---- 3. Block dedup: name 4 MB blocks by SHA-256, upload only missing ones ----
const store = new Map<string, { bytes: number; refs: number }>();
function blocksOf(content: string, blockChars: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < content.length; i += blockChars) out.push(content.slice(i, i + blockChars));
  return out;
}
function syncFile(user: string, content: string): { uploaded: number; skipped: number } {
  const hashes = blocksOf(content, 8).map((b) => createHash('sha256').update(b).digest('hex'));
  let uploaded = 0;
  let skipped = 0;
  for (const h of hashes) {
    const have = store.get(h);
    if (have) { have.refs++; skipped++; } else { store.set(h, { bytes: 4 * MB, refs: 1 }); uploaded++; }
  }
  console.log(`  ${user.padEnd(6)} ${hashes.length} blocks -> uploaded ${uploaded}, already on server ${skipped}`);
  return { uploaded, skipped };
}

// ---- 4. Lifecycle cost for a year of photos ----
const PRICE = { standard: 0.023, ia: 0.0125, glacier: 0.0036 }; // USD per GB-month
function yearCost(gbPerDay: number, withLifecycle: boolean): number {
  let total = 0;
  for (let month = 1; month <= 12; month++) {
    // Data written in each earlier month, aged by now.
    for (let age = 0; age < month; age++) {
      const gb = gbPerDay * 30;
      const days = age * 30;
      const price = !withLifecycle || days < 30 ? PRICE.standard : days < 90 ? PRICE.ia : PRICE.glacier;
      total += gb * price;
    }
  }
  return total;
}

function main(): void {
  console.log('== 1. Presigned URL (API signs, client uploads direct) ==');
  const now = 1_000_000;
  const url = presign('u/42/f/123/v1', 'PUT', now + 900);
  console.log('  url:', url);
  console.log('  PUT within 15 min      ->', verify(url, 'PUT', now + 60));
  console.log('  GET with a PUT URL     ->', verify(url, 'GET', now + 60));
  console.log('  PUT after 16 min       ->', verify(url, 'PUT', now + 960));
  console.log('  key changed by client  ->', verify(url.replace('123', '999'), 'PUT', now + 60));

  console.log('\n== 2. 200 MB video, multipart with 16 MB parts, 4 in parallel ==');
  const size = 200 * MB;
  const r = multipartUpload(size, 16 * MB, 4);
  console.log(`  parts=${r.parts}, failed parts retried=${r.retries}, rounds of 4 parallel=${r.rounds}`);
  console.log(`  bytes sent = ${(r.sentBytes / MB).toFixed(0)} MB for a ${(size / MB).toFixed(0)} MB file`);
  console.log(`  CompleteMultipartUpload with ${r.etags.length} ETags -> one object`);
  // Same failures with one single PUT: any failure restarts the whole file.
  const singleFails = r.retries > 0 ? 1 : 0;
  console.log(`  single PUT instead: one drop restarts all -> ~${((size * (1 + singleFails)) / MB).toFixed(0)} MB sent, and no resume`);

  console.log('\n== 3. Block dedup (Dropbox-style), blocks named by SHA-256 ==');
  const video = 'AAAAAAAABBBBBBBBCCCCCCCCDDDDDDDD';
  syncFile('asha', video);
  syncFile('ravi', video); // same file, different user
  syncFile('asha', 'AAAAAAAABBBBBBBBXXXXXXXXDDDDDDDD'); // edited one block
  const stored = store.size;
  console.log(`  logical blocks = 12, physical blocks stored = ${stored} (${stored * 4} MB instead of 48 MB)`);

  console.log('\n== 4. Storage cost: 1M photos/day x 2 MB = ~2,000 GB/day, first year ==');
  const plain = yearCost(2000, false);
  const tiered = yearCost(2000, true);
  console.log(`  all in S3 Standard          : $${plain.toFixed(0)}`);
  console.log(`  lifecycle 30d IA, 90d Glacier: $${tiered.toFixed(0)}  (saves ${(100 - (tiered / plain) * 100).toFixed(0)}%)`);
  console.log(`  erasure coding 6+3 = 1.5x raw vs 3x replication: half the disks for the same durability class`);
}

main();
