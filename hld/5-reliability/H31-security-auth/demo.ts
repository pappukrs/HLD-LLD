// H31 · Security: real RS256 JWT sign/verify with node:crypto, tampering and alg:none attacks,
// PKCE, refresh token rotation with reuse detection, and an ownership (IDOR) check.
// Run: npx tsx hld/5-reliability/H31-security-auth/demo.ts
import { createHash, createSign, createVerify, generateKeyPairSync, randomBytes } from 'node:crypto';

const b64u = (x: Buffer | string) => Buffer.from(x).toString('base64url');
const json = (o: object) => b64u(JSON.stringify(o));

// ---- Auth server key pair. Only the auth server holds the private key.
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const JWKS = new Map<string, typeof publicKey>([['k-2026-10', publicKey]]); // what the gateway caches

function signJwt(claims: object, kid = 'k-2026-10'): string {
  const head = json({ alg: 'RS256', typ: 'JWT', kid });
  const body = json(claims);
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey);
  return `${head}.${body}.${b64u(sig)}`;
}

type Claims = { sub: string; scope: string; role: string; iss: string; aud: string; exp: number };

function verifyJwt(token: string, nowSec: number): Claims {
  const [h, p, s] = token.split('.');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString()) as { alg: string; kid: string };
  if (header.alg !== 'RS256') throw new Error(`alg "${header.alg}" not allowed`);
  const key = JWKS.get(header.kid);
  if (!key) throw new Error('unknown kid');
  const ok = createVerify('RSA-SHA256').update(`${h}.${p}`).verify(key, Buffer.from(s ?? '', 'base64url'));
  if (!ok) throw new Error('bad signature');
  const c = JSON.parse(Buffer.from(p, 'base64url').toString()) as Claims;
  if (c.exp < nowSec - 30) throw new Error('expired');
  if (c.iss !== 'https://auth.shop.in' || c.aud !== 'api') throw new Error('wrong iss/aud');
  return c;
}

function tryVerify(label: string, token: string, now: number): void {
  try {
    const c = verifyJwt(token, now);
    console.log(`${label.padEnd(30)} -> OK  sub=${c.sub} role=${c.role}`);
  } catch (e) {
    console.log(`${label.padEnd(30)} -> 401 (${(e as Error).message})`);
  }
}

function jwtDemo(): void {
  console.log('\n== 1. JWT: sign with private key, verify with public key ==');
  const now = 1_792_300_000;
  const token = signJwt({ sub: 'user_42', scope: 'orders:read', role: 'user', iss: 'https://auth.shop.in', aud: 'api', exp: now + 600 });
  const [h, p, s] = token.split('.');
  console.log('payload is readable by anyone:', Buffer.from(p, 'base64url').toString());

  tryVerify('valid token', token, now);
  const evilPayload = json({ ...JSON.parse(Buffer.from(p, 'base64url').toString()), role: 'admin' });
  tryVerify('payload edited to role=admin', `${h}.${evilPayload}.${s}`, now);
  tryVerify('alg:none, no signature', `${json({ alg: 'none', kid: 'k-2026-10' })}.${evilPayload}.`, now);
  tryVerify('same token 20 min later', token, now + 1200);
}

function pkceDemo(): void {
  console.log('\n== 2. PKCE: a stolen authorization code is useless ==');
  const verifier = b64u(randomBytes(32)); // 43 chars, stays in the app
  const challenge = b64u(createHash('sha256').update(verifier).digest());
  const codes = new Map<string, { challenge: string; used: boolean }>([['SplxlO', { challenge, used: false }]]);

  const exchange = (code: string, v: string | undefined): string => {
    const c = codes.get(code);
    if (!c || c.used) return '400 invalid_grant (unknown or already used code)';
    if (!v || b64u(createHash('sha256').update(v).digest()) !== c.challenge) return '400 invalid_grant (verifier does not match)';
    c.used = true;
    return '200 tokens issued';
  };
  console.log(`verifier ${verifier.slice(0, 10)}... (${verifier.length} chars), challenge ${challenge.slice(0, 10)}...`);
  console.log('attacker: code, no verifier      ->', exchange('SplxlO', undefined));
  console.log('attacker: code, guessed verifier ->', exchange('SplxlO', 'guess'));
  console.log('real app: code + verifier        ->', exchange('SplxlO', verifier));
  console.log('replay the same code             ->', exchange('SplxlO', verifier));
}

function refreshDemo(): void {
  console.log('\n== 3. Refresh token rotation with reuse detection ==');
  const tokens = new Map<string, { family: string; status: 'active' | 'used' | 'revoked' }>();
  let n = 0;
  const issue = (family: string) => { const t = `rt_${++n}`; tokens.set(t, { family, status: 'active' }); return t; };
  const refresh = (t: string): string => {
    const rec = tokens.get(t);
    if (!rec || rec.status === 'revoked') return '401 revoked';
    if (rec.status === 'used') {
      for (const r of tokens.values()) if (r.family === rec.family) r.status = 'revoked';
      return '401 REUSE DETECTED -> whole family revoked, user must log in';
    }
    rec.status = 'used';
    return `200 new access JWT + ${issue(rec.family)}`;
  };
  const rt1 = issue('fam_A');
  console.log(`app refreshes ${rt1}  ->`, refresh(rt1));
  console.log(`thief replays ${rt1}  ->`, refresh(rt1));
  console.log('app refreshes rt_2  ->', refresh('rt_2'));
}

function idorDemo(): void {
  console.log('\n== 4. Ownership check in the service (IDOR) ==');
  const orders = [{ id: 1001, userId: 'user_42', total: 499 }, { id: 1002, userId: 'user_77', total: 2999 }];
  const unsafe = (id: number) => orders.find((o) => o.id === id);
  const safe = (id: number, caller: string) => orders.find((o) => o.id === id && o.userId === caller); // WHERE id=? AND user_id=?
  for (const id of [1001, 1002]) {
    const u = unsafe(id), s = safe(id, 'user_42');
    console.log(`user_42 GET /orders/${id}: unsafe -> ${u ? '200 ' + JSON.stringify(u) : '404'} | safe -> ${s ? '200' : '404'}`);
  }
}

function main(): void {
  jwtDemo();
  pkceDemo();
  refreshDemo();
  idorDemo();
}

main();
