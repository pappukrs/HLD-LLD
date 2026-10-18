// P05 · Adapter
// Run: npx tsx lld/concepts/patterns/p05-adapter.ts
import { promisify } from 'node:util';

// ---------- two fake third-party SDKs with different shapes ----------
class SmsAClient {
  messages = {
    create: async (req: { to: string; body: string }) => ({ sid: `SMa_${req.to.slice(-4)}`, status: 'queued' }),
  };
}
class SmsBClient {
  // callback style; numeric error codes; 0 = success
  send(phone: string, text: string, cb: (code: number, id: string) => void): void {
    setTimeout(() => (phone.length === 10 ? cb(0, `B-${Date.now() % 10000}`) : cb(21, '')), 5);
  }
}
const smsA = new SmsAClient();
const smsB = new SmsBClient();

// ---------- before: the service knows both SDKs ----------
async function sendOtpBefore(provider: 'A' | 'B', phone: string, otp: string): Promise<string> {
  if (provider === 'A') {
    const r = await smsA.messages.create({ to: `+91${phone}`, body: `OTP ${otp}` });
    return r.sid;
  }
  return new Promise((resolve, reject) =>
    smsB.send(phone, `OTP ${otp}`, (code, id) => (code === 0 ? resolve(id) : reject(new Error(String(code))))),
  );
}

// ---------- after: our target interface + one adapter per SDK ----------
interface SendResult { messageId: string }
interface SmsSender {
  readonly name: string;
  send(phone: string, text: string): Promise<SendResult>;
}
class SmsDeliveryError extends Error {}

class SmsAAdapter implements SmsSender {
  readonly name = 'provider-A';
  constructor(private readonly client: SmsAClient) {}
  async send(phone: string, text: string): Promise<SendResult> {
    const res = await this.client.messages.create({ to: `+91${phone}`, body: text });
    return { messageId: res.sid };
  }
}

class SmsBAdapter implements SmsSender {
  readonly name = 'provider-B';
  constructor(private readonly client: SmsBClient) {}
  send(phone: string, text: string): Promise<SendResult> {
    return new Promise((resolve, reject) =>
      this.client.send(phone, text, (code, id) =>
        code === 0 ? resolve({ messageId: id }) : reject(new SmsDeliveryError(`provider-B code ${code}`)),
      ),
    );
  }
}

class OtpService {
  constructor(private readonly senders: SmsSender[]) {}
  async sendOtp(phone: string, otp: string): Promise<string> {
    for (const s of this.senders) {
      try {
        const r = await s.send(phone, `Your OTP is ${otp}`);
        return `${s.name} sent ${r.messageId}`;
      } catch (e) {
        console.log(`  ${s.name} failed: ${(e as Error).message}, trying next`);
      }
    }
    throw new SmsDeliveryError('all providers failed');
  }
}

// a failing adapter to show fallback
class DownAdapter implements SmsSender {
  readonly name = 'provider-down';
  async send(): Promise<SendResult> { throw new SmsDeliveryError('timeout'); }
}

async function main() {
  console.log('--- before ---');
  console.log(await sendOtpBefore('A', '9876543210', '1234'));
  console.log(await sendOtpBefore('B', '9876543210', '1234'));

  console.log('\n--- after: service sees only SmsSender ---');
  const service = new OtpService([new DownAdapter(), new SmsBAdapter(smsB), new SmsAAdapter(smsA)]);
  console.log(await service.sendOtp('9876543210', '482913'));

  console.log('\n--- util.promisify is a built-in adapter ---');
  function legacyFetchRate(currency: string, cb: (err: Error | null, rate?: number) => void) {
    setTimeout(() => cb(null, currency === 'USD' ? 83.2 : 1), 5);
  }
  const fetchRate = promisify(legacyFetchRate);
  console.log('USD rate:', await fetchRate('USD'));
}

await main();

export {};
