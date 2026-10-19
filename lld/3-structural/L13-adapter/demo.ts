// L13 · Adapter: run with `npx tsx lld/3-structural/L13-adapter/demo.ts`
// Domain: one PaymentService, three gateway SDKs with different shapes, adapters that map
// units, async style and errors. Plus util.promisify and a fallback router.

import { promisify } from 'node:util';

const section = (t: string) => console.log(`\n=== ${t} ===`);

// ---------- YOUR types (the target) ----------
interface ChargeReq { orderId: string; paise: number }
interface ChargeResult { ref: string; status: 'PENDING' | 'CAPTURED' }
interface PaymentProvider { readonly name: string; charge(r: ChargeReq): Promise<ChargeResult> }
class PaymentDeclinedError extends Error { override name = 'PaymentDeclinedError'; constructor(readonly reason: string) { super(reason); } }
class ProviderUnavailableError extends Error { override name = 'ProviderUnavailableError'; }

// ---------- three third-party SDKs (adaptees) you cannot change ----------
const gatewayASdk = {
  orders: {
    async create(req: { amount: string; receipt: string }): Promise<{ id: string; status: 'created' }> {
      if (req.amount === '13.00') throw { error: { code: 'BAD_REQUEST_ERROR', reason: 'card_declined' } };
      if (req.amount === '99.00') throw { error: { code: 'GATEWAY_TIMEOUT' } };
      return { id: `order_${req.receipt}`, status: 'created' };
    },
  },
};
const gatewayBSdk = {
  pay(amountPaise: number, cb: (code: number, id: string | null) => void): void {
    setImmediate(() => (amountPaise === 1300 ? cb(51, null) : cb(0, `B-${amountPaise}`)));
  },
};
const gatewayCSdk = {
  async charge(req: { cents: number; ccy: string }): Promise<{ status: 'SUCCESS' | 'FAILED'; txn?: string; reason?: string }> {
    return req.cents === 1300 ? { status: 'FAILED', reason: 'DO_NOT_HONOR' } : { status: 'SUCCESS', txn: `C9-${req.cents}` };
  },
};

// ---------- adapters: one per adaptee ----------
class GatewayAAdapter implements PaymentProvider {
  readonly name = 'GatewayA';
  constructor(private sdk: typeof gatewayASdk) {}
  async charge(r: ChargeReq): Promise<ChargeResult> {
    try {
      const o = await this.sdk.orders.create({ amount: (r.paise / 100).toFixed(2), receipt: r.orderId }); // paise -> rupees string
      return { ref: o.id, status: 'PENDING' };
    } catch (e) {
      const code = (e as { error?: { code?: string } }).error?.code;
      if (code === 'BAD_REQUEST_ERROR') throw new PaymentDeclinedError('CARD_DECLINED');
      throw new ProviderUnavailableError(`GatewayA: ${code ?? 'unknown'}`);
    }
  }
}

const B_CODES: Record<number, string> = { 51: 'INSUFFICIENT_FUNDS', 54: 'EXPIRED_CARD' };
class GatewayBAdapter implements PaymentProvider {
  readonly name = 'GatewayB';
  constructor(private sdk: typeof gatewayBSdk) {}
  charge(r: ChargeReq): Promise<ChargeResult> {
    return new Promise((ok, fail) =>
      this.sdk.pay(r.paise, (code, id) =>
        code === 0 && id ? ok({ ref: id, status: 'CAPTURED' }) : fail(new PaymentDeclinedError(B_CODES[code] ?? `B_${code}`)),
      ),
    );
  }
}

class GatewayCAdapter implements PaymentProvider {
  readonly name = 'GatewayC';
  constructor(private sdk: typeof gatewayCSdk) {}
  async charge(r: ChargeReq): Promise<ChargeResult> {
    const res = await this.sdk.charge({ cents: r.paise, ccy: 'inr' });
    if (res.status === 'FAILED') throw new PaymentDeclinedError('CARD_DECLINED'); // failure hidden in a 200
    return { ref: res.txn!, status: 'CAPTURED' };
  }
}

// ---------- the client: knows only PaymentProvider ----------
class PaymentService {
  constructor(private provider: PaymentProvider) {}
  async pay(orderId: string, paise: number): Promise<string> {
    try {
      const r = await this.provider.charge({ orderId, paise });
      return `${this.provider.name}: ${r.status} ref=${r.ref}`;
    } catch (e) {
      if (e instanceof PaymentDeclinedError) return `${this.provider.name}: DECLINED (${e.reason})`;
      throw e;
    }
  }
}

// Same interface, so composing a fallback is trivial (this one is a Composite/Decorator-ish wrapper).
class FallbackProvider implements PaymentProvider {
  readonly name = 'Fallback';
  constructor(private chain: PaymentProvider[]) {}
  async charge(r: ChargeReq): Promise<ChargeResult> {
    for (const p of this.chain) {
      try { return await p.charge(r); } catch (e) {
        if (!(e instanceof ProviderUnavailableError)) throw e; // a decline is final; only outages fall through
        console.log(`  ${p.name} unavailable -> next`);
      }
    }
    throw new ProviderUnavailableError('all providers down');
  }
}

async function main() {
  const adapters: PaymentProvider[] = [
    new GatewayAAdapter(gatewayASdk), new GatewayBAdapter(gatewayBSdk), new GatewayCAdapter(gatewayCSdk),
  ];

  section('1. Same call, three SDKs');
  for (const a of adapters) console.log(await new PaymentService(a).pay('ord_81', 49900));

  section('2. Declines: three error styles -> one PaymentDeclinedError');
  for (const a of adapters) console.log(await new PaymentService(a).pay('ord_82', 1300));

  section('3. Fallback: A is down (amount 99.00 triggers a timeout), C takes over');
  const svc = new PaymentService(new FallbackProvider([adapters[0], adapters[2]]));
  console.log(await svc.pay('ord_83', 9900));

  section('4. Node ships an adapter: util.promisify (callback -> promise)');
  const payAsync = promisify((paise: number, cb: (err: Error | null, id?: string) => void) =>
    gatewayBSdk.pay(paise, (code, id) => (code === 0 ? cb(null, id ?? '') : cb(new Error(`code ${code}`)))),
  );
  console.log('promisified pay ->', await payAsync(25000));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
