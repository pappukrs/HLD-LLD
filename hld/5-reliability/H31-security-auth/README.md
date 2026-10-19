# H31 · Security: authn, authz, JWT, OAuth2

> **Time:** ~50 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/5-reliability/H31-security-auth/demo.ts`)
> **Builds on:** [H04 API design](../../1-basics/H04-api-design/README.md) · [H06 Proxies and API gateway](../../1-basics/H06-proxies-api-gateway/README.md) · [H25 Microservices](../H25-microservices/README.md) · **Used in:** [Payment system](../../case-studies/08-payment-system/README.md), [Digital wallet](../../case-studies/28-digital-wallet/README.md), [Chat system](../../case-studies/06-chat-system/README.md), [File storage](../../case-studies/15-file-storage/README.md) (share links), every design's API layer

## The idea in one line

Authentication proves **who** is calling, authorization decides **what** they may do: use short-lived signed tokens (JWT via OAuth2/OIDC) for users, scoped credentials or mTLS for services, and check ownership of every resource in the service, not just at login.

## Why it matters (the problem it solves)

- A session table checked on every request becomes a hot dependency for 50 services.
- A user changes `/api/orders/1001` to `/api/orders/1002` and sees someone else's order. This is an **IDOR**, part of **broken access control**, #1 in the OWASP Top 10 (2021).
- A partner app needs to read a user's data without ever seeing the user's password.
- One leaked internal credential lets an attacker call every internal service.

In HLD rounds, security is usually one or two sentences, but they must be the right sentences: "OIDC with PKCE, short-lived RS256 JWTs verified at the gateway with JWKS, rotating refresh tokens, ownership checks in each service, mTLS between services."

## How it works

### AuthN vs AuthZ

| | Authentication (authn) | Authorization (authz) |
|---|---|---|
| Question | Who are you? | Are you allowed to do this to this resource? |
| Evidence | Password + MFA, passkey, client certificate, signed token | Roles, scopes, ownership, policies |
| Fails with | `401 Unauthorized` (really "unauthenticated") | `403 Forbidden` (or `404` to hide existence) |
| Where | Identity provider, then the gateway verifies the token | Gateway (coarse: scope) + service (fine: ownership) |

### Sessions vs tokens

| | Server session | JWT (self-contained token) |
|---|---|---|
| Client holds | Opaque session id in a cookie | Signed token with claims |
| Server check | Look up session in Redis/DB | Verify signature + `exp` locally (no network) |
| Revocation | Delete the session: instant | Hard: valid until `exp` unless you keep a denylist |
| Fits | Web app with one backend | Many services, mobile apps, APIs |

### JWT anatomy

```
eyJhbGciOiJSUzI1NiIsImtpZCI6ImstMjAyNi0xMCJ9 . eyJzdWIiOiJ1c2VyXzQyIiwic2NvcGUiOi... . Xy9mQ2...
            header (base64url)                        payload (base64url)                signature

header:  {"alg":"RS256","kid":"k-2026-10"}
payload: {"sub":"user_42","scope":"orders:read","iss":"https://auth.shop.in","aud":"api","exp":1792300000,"jti":"a81f"}
signature = RS256( base64url(header) + "." + base64url(payload), auth server's PRIVATE key )
```

- **Signed, not encrypted.** Anyone with the token can read the payload. No secrets or PII in it.
- **HS256** (shared secret): every service that verifies can also forge tokens. **RS256 / ES256**: only the auth server holds the private key; services get the **public** key from a **JWKS** endpoint, picked by `kid`, cached, refreshed on an unknown `kid` (that is how keys rotate).
- Always check `alg` against an allow-list (reject `none`), signature, `exp` (with ~30 s clock skew), `iss`, `aud`. Then scopes.
- **Access token**: 5–15 min. **Refresh token**: opaque, stored server-side, **rotated on every use**. If an old refresh token is used again, someone stole it: revoke the whole token family.
- In browsers, keep tokens in `HttpOnly; Secure; SameSite` cookies (JS cannot read them, so XSS cannot steal them; add CSRF protection), or keep them in a BFF on the server. Not in `localStorage`.

### OAuth 2.0 + OIDC: authorization code with PKCE

OAuth 2.0 is **delegated authorization** ("let this app act for me with these scopes"). **OpenID Connect** adds authentication on top: an **ID token** (a JWT) that says who the user is.

```
Browser            App (client)               Auth server                 API
  │  click Login     │                           │                         │
  │─────────────────►│ verifier = random(43+)    │                         │
  │                  │ challenge = SHA256(verifier)                        │
  │◄── 302 /authorize?client_id&redirect_uri&scope&state&code_challenge ──│
  │──────────────────────────────────────────────►│ login + MFA + consent   │
  │◄──────────── 302 /callback?code=abc&state ────│ (code: ~60 s, one use)  │
  │── code ─────────►│                           │                         │
  │                  │── POST /token code + verifier ─►│ SHA256(verifier) == challenge?
  │                  │◄─ access JWT, refresh, id_token ─│                    │
  │                  │── GET /orders  Authorization: Bearer <JWT> ───────────►│ verify locally
```

- **PKCE** binds the code to the app that started the flow. A stolen code (from logs, a malicious app, a redirect) is useless without the verifier.
- **`state`** (or nonce) stops CSRF on the callback.
- The app never sees the password. The auth server is the only place that does.

| Flow | Use for |
|---|---|
| Authorization code + **PKCE** | Web apps, SPAs, mobile apps (the default) |
| Client credentials | Service-to-service, merchant server → your API |
| Refresh token | New access tokens without logging in again |
| Device code | TVs, CLIs |
| Implicit, password grant | **Do not use.** Removed in OAuth 2.1 |

### Authorization models

- **RBAC**: roles → permissions (`admin`, `support`, `viewer`). Simple; roles multiply over time.
- **ABAC**: rules on attributes (`user.org == doc.org && amount < user.limit`). Flexible; harder to audit. Tools: OPA (Rego), AWS Cedar.
- **ReBAC**: permissions from relationships ("editor of folder that contains doc"). Google **Zanzibar**; open source SpiceDB, OpenFGA. Fits Google Drive / Notion style sharing.
- **Ownership check in the service, always**: `SELECT ... WHERE id = :id AND user_id = :callerId`. The gateway cannot know who owns order 1002. Return 404 to avoid leaking that it exists.

### Service-to-service and other essentials

- **mTLS** between services (certificates issued and rotated by a mesh such as Istio/Linkerd), or **client-credentials** tokens with narrow scopes.
- **Merchant API keys**: key id + secret, store only a **hash** of the secret, allow 2 active keys for rotation, separate test/live.
- **Webhook signing**: HMAC-SHA256 over timestamp + raw body; verify with a constant-time compare; reject old timestamps (replay).
- **Secrets** in Vault / AWS Secrets Manager / KMS, never in git or baked into images.
- **Encryption**: TLS 1.2+ in transit; at rest with **envelope encryption** (KMS master key encrypts per-record data keys).
- **Passwords**: argon2id or bcrypt (slow, salted), never plain SHA-256. Rate-limit login and OTP ([H26](../H26-rate-limiting/README.md)); add MFA.

## In TypeScript

Verifying a JWT the right way (Node `crypto`, no library), then the ownership check:

```ts
import { createVerify } from 'node:crypto';

function verifyJwt(token: string, jwks: Map<string, string>, now = Date.now() / 1000) {
  const [h, p, sig] = token.split('.');
  const header = JSON.parse(Buffer.from(h, 'base64url').toString());
  if (header.alg !== 'RS256') throw new Error('alg not allowed');          // blocks "none" and HS/RS confusion
  const pubKey = jwks.get(header.kid);
  if (!pubKey) throw new Error('unknown kid: refresh JWKS once, then fail');
  const ok = createVerify('RSA-SHA256').update(`${h}.${p}`).verify(pubKey, Buffer.from(sig, 'base64url'));
  if (!ok) throw new Error('bad signature');
  const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (claims.exp < now - 30) throw new Error('expired');
  if (claims.iss !== 'https://auth.shop.in' || claims.aud !== 'api') throw new Error('wrong issuer/audience');
  return claims as { sub: string; scope: string };
}

// In the order service: the token proves WHO; the query proves OWNERSHIP.
async function getOrder(db: { findOrder(id: string, userId: string): Promise<object | null> }, id: string, sub: string) {
  const order = await db.findOrder(id, sub);          // WHERE id = $1 AND user_id = $2
  return order ?? { status: 404 };                     // not 403: do not reveal it exists
}
```

[demo.ts](demo.ts) generates an RSA key pair, signs and verifies tokens, rejects a tampered and an `alg:none` token, runs PKCE, rotates refresh tokens with reuse detection, and shows the IDOR check.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Server sessions in Redis | Web app, need instant logout | Lookup per request; shared store |
| Stateless JWT | Many services, local verification | Revocation; token size on every request |
| JWT + short TTL + `jti` denylist | Need both scale and fast revocation | Small Redis lookup for the denylist |
| Opaque token + introspection | High-risk APIs, instant revocation | Network call per request (cache briefly) |
| RBAC | Few stable roles | Role explosion |
| ABAC / ReBAC | Multi-tenant, sharing, fine-grained rules | Policy engine to run and audit |
| mTLS | Internal zero-trust network | Certificate management (use a mesh) |

Do not build your own identity provider for a startup: use Auth0, Okta, Keycloak, Cognito. Do not use long-lived JWTs (24 h) as "sessions" with no revocation path. Do not use HS256 when more than one service verifies tokens.

## Common mistakes

- Trusting the JWT payload without verifying the signature, or accepting `alg: none`.
- HS256 with the secret shared across 30 services.
- Putting email, phone or PAN in the payload ("it's encoded, so it's hidden").
- Storing tokens in `localStorage`.
- Checking only "is logged in" at the gateway and never checking ownership in the service (IDOR).
- Returning 403 for someone else's resource (it confirms the id exists). Return 404.
- Long-lived access tokens with no refresh rotation; no plan for "log out everywhere".
- Using implicit flow or password grant in a new design.
- Logging tokens, OTPs or passwords.

## Say this in the interview

> "Users sign in through an OIDC provider using the authorization code flow with PKCE, so the app never sees passwords and a stolen code is useless. The provider issues a 10-minute RS256 access token and a rotating refresh token kept server-side. The gateway verifies the signature locally against cached JWKS keys, checks expiry, issuer, audience and scope, and passes the user id downstream."

> "Each service still checks ownership itself: every query is scoped by the caller, like `WHERE id = ? AND merchant_id = ?`, and a mismatch returns 404. Services talk over mTLS from the mesh. To log someone out everywhere, we revoke their refresh token family; the access token dies within 10 minutes, or immediately if we add its jti to a Redis denylist."

## Your experience hook

- **SenseGrass Express gateway**: you implemented **JWT auth** at the gateway so services verify tokens without a shared session store. Upgrade the story: RS256 + JWKS instead of a shared secret, short TTL + refresh rotation, and per-service ownership checks.
- **Payment orchestration**: provider **webhooks** must be verified (HMAC signature + timestamp) before you trust a "payment succeeded" event; dedupe by provider event id. Merchant API keys stored hashed, with test/live separation.
- **Video SFU**: signaling over WSS should authenticate the socket on connect (token in the first message or cookie, not in the URL query, which ends up in logs), and the room join must check that the user is allowed in that room (authz per resource).

## Numbers to remember

- Access token TTL **5–15 min**; refresh token days to weeks, **rotated** on use.
- Auth code lifetime **~60 s**, single use. PKCE verifier **43–128** chars.
- bcrypt/argon2 tuned so one hash takes **~100–250 ms**.
- RS256 verify: **tens of microseconds**; signing is slower (auth server only).
- 6-digit OTP = **1M** values; allow **3–5** attempts per OTP.
- OWASP Top 10 (2021) #1: **broken access control**.

## Self-test

<details><summary>1. Is the data inside a JWT payload secret?</summary>

No. It is only base64url-encoded and signed. Anyone with the token can decode it. Use JWE if you truly need encryption, or keep sensitive data out.
</details>

<details><summary>2. Why RS256 over HS256 with 30 services?</summary>

With HS256 every verifier holds the secret and could mint tokens; one leaked service = forged tokens for all. With RS256 only the auth server has the private key; services hold the public key.
</details>

<details><summary>3. GET /orders/1002 returns another merchant's order. Name the bug and the fix.</summary>

IDOR / broken access control. Scope every query by the caller's identity (`WHERE id = ? AND merchant_id = ?`) in the service, and return 404 on mismatch.
</details>

<details><summary>4. What does PKCE protect against?</summary>

A stolen authorization code. The token endpoint requires the `code_verifier` whose SHA-256 matches the `code_challenge` sent at the start. An attacker who only has the code cannot exchange it.
</details>

<details><summary>5. How do you log a user out everywhere when you use JWTs?</summary>

Revoke all their refresh tokens server-side so no new access tokens are issued. Existing access tokens die at their short TTL; for instant cut-off, add their `jti` (or a per-user "issued before T is invalid" timestamp) to a Redis denylist checked by the gateway.
</details>

<details><summary>6. An old refresh token is presented again after it was rotated. What do you do?</summary>

Treat it as theft: one of the two parties has a stolen copy. Revoke the whole refresh token family and force a new login.
</details>

<details><summary>7. Authorization: gateway or service?</summary>

Both. The gateway does coarse checks (valid token, scope `orders:read`). The service does fine checks (this user owns this order), because only it knows the resource.
</details>

## Go deeper

- Case studies: [Payment system](../../case-studies/08-payment-system/README.md) (merchant keys, webhook signing), [Digital wallet](../../case-studies/28-digital-wallet/README.md)
- Related: [H06 API gateway](../../1-basics/H06-proxies-api-gateway/README.md), [H26 Rate limiting](../H26-rate-limiting/README.md) (login and OTP limits)
- Archive notes: [hld-parts/part3.md](../../../archive/notes/hld-parts/part3.md) ("MODULE 3.4: AUTHENTICATION & AUTHORIZATION": JWT, OAuth 2.0 flows, RBAC vs ABAC), [hld-parts/part8.md](../../../archive/notes/hld-parts/part8.md) ("OAuth2 & JWT Deep Dive"), [hld-parts/part4.md](../../../archive/notes/hld-parts/part4.md) ("Security Best Practices")
- RFC 6749 (OAuth 2.0), RFC 7636 (PKCE), RFC 7519 (JWT), RFC 9700 (OAuth 2.0 Security BCP); OWASP cheat sheets (JWT, Authentication, Password Storage); "Zanzibar" (USENIX ATC 2019)
