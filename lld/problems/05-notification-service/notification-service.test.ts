import * as starter from './starter';
import * as reference from './reference';
import type { Channel, Message, NotificationServiceOptions } from './reference';

// `npm test` checks your starter.ts; `npm run test:ref` checks the reference.
const { NotificationService, TemplateRegistry, PreferenceStore, PermanentError, EmailChannel, SmsChannel } = (
  process.env.REF ? reference : starter
) as typeof reference;

class FakeChannel implements Channel {
  readonly sent: Message[] = [];
  constructor(readonly type: string, private failures = 0) {}
  async send(message: Message): Promise<void> {
    if (this.failures-- > 0) throw new Error('provider timeout');
    this.sent.push(message);
  }
}

function setup(overrides: Partial<NotificationServiceOptions> = {}) {
  let now = 0;
  const delays: number[] = [];
  const email = new FakeChannel('EMAIL');
  const sms = new FakeChannel('SMS');
  const templates = new TemplateRegistry();
  templates.register('order', { subject: 'Order {{orderId}}', body: 'Hi {{name}}, order {{orderId}} is placed.' });
  templates.register('otp', { body: 'Your OTP is {{otp}}' });
  const preferences = new PreferenceStore();
  preferences.set('u1', { contacts: { EMAIL: 'asha@example.com', SMS: '+919800000001' } });
  preferences.set('u2', { contacts: { EMAIL: 'ravi@example.com', SMS: '+919800000002' }, optOut: ['SMS'] });
  preferences.set('u3', { contacts: { EMAIL: 'meena@example.com' } });

  const service = new NotificationService({
    channels: [email, sms],
    templates,
    preferences,
    clock: () => now,
    sleep: async (ms) => void delays.push(ms),
    retry: { maxAttempts: 3, baseDelayMs: 100 },
    rateLimit: { maxPerWindow: 2, windowMs: 60_000 },
    dedupeWindowMs: 5_000,
    ...overrides,
  });
  return { service, email, sms, templates, preferences, delays, advance: (ms: number) => (now += ms) };
}

const order = { templateId: 'order', data: { name: 'Asha', orderId: 'O42' } };

describe('05 · Notification Service', () => {
  describe('accept and deliver', () => {
    it('queues on notify and sends nothing until the worker runs', async () => {
      const { service, email } = setup();
      expect(service.notify({ userId: 'u1', ...order }).status).toBe('QUEUED');
      expect(service.pendingCount).toBe(1);
      expect(email.sent).toHaveLength(0);
      await service.processQueue();
      expect(service.pendingCount).toBe(0);
      expect(email.sent).toHaveLength(1);
    });

    it('renders the template and sends to every channel the user has', async () => {
      const { service, email, sms } = setup();
      const { id } = service.notify({ userId: 'u1', ...order });
      const results = await service.processQueue();
      expect(results.map((r) => [r.channel, r.status])).toEqual([['EMAIL', 'SENT'], ['SMS', 'SENT']]);
      expect(email.sent[0]).toMatchObject({
        notificationId: id,
        to: 'asha@example.com',
        subject: 'Order O42',
        body: 'Hi Asha, order O42 is placed.',
      });
      expect(sms.sent[0].to).toBe('+919800000001');
    });

    it('skips opted-out channels and channels with no address', async () => {
      const { service, sms } = setup();
      service.notify({ userId: 'u2', ...order });
      service.notify({ userId: 'u3', ...order });
      const results = await service.processQueue();
      expect(results.filter((r) => r.status === 'SKIPPED').map((r) => r.userId)).toEqual(['u2', 'u3']);
      expect(sms.sent).toHaveLength(0);
    });

    it('sends only to the requested channels', async () => {
      const { service, email, sms } = setup();
      service.notify({ userId: 'u1', templateId: 'otp', data: { otp: '1234' }, channels: ['SMS'] });
      await service.processQueue();
      expect(email.sent).toHaveLength(0);
      expect(sms.sent[0].body).toBe('Your OTP is 1234');
    });

    it('throws at notify time for an unknown user, template, channel or missing data', () => {
      const { service } = setup();
      expect(() => service.notify({ userId: 'nobody', ...order })).toThrow();
      expect(() => service.notify({ userId: 'u1', templateId: 'missing' })).toThrow();
      expect(() => service.notify({ userId: 'u1', ...order, channels: ['FAX'] })).toThrow();
      expect(() => service.notify({ userId: 'u1', templateId: 'order', data: { name: 'Asha' } })).toThrow();
      expect(service.pendingCount).toBe(0);
    });
  });

  describe('retries', () => {
    it('retries a transient failure with exponential backoff', async () => {
      const flaky = new FakeChannel('EMAIL', 2);
      const { service, delays } = setup({ channels: [flaky] });
      service.notify({ userId: 'u1', ...order });
      const [result] = await service.processQueue();
      expect(result).toMatchObject({ status: 'SENT', attempts: 3 });
      expect(delays).toEqual([100, 200]);
    });

    it('gives up after maxAttempts and reports FAILED', async () => {
      const down = new FakeChannel('EMAIL', 10);
      const { service, delays } = setup({ channels: [down] });
      service.notify({ userId: 'u1', ...order });
      const [result] = await service.processQueue();
      expect(result).toMatchObject({ status: 'FAILED', attempts: 3, error: 'provider timeout' });
      expect(delays).toEqual([100, 200]);
    });

    it('does not retry a permanent error, such as a bad email address', async () => {
      const transport = vi.fn(async () => {});
      const { service, preferences, delays } = setup({ channels: [new EmailChannel(transport)] });
      preferences.set('bad', { contacts: { EMAIL: 'not-an-email' } });
      service.notify({ userId: 'bad', ...order });
      const [result] = await service.processQueue();
      expect(result).toMatchObject({ status: 'FAILED', attempts: 1 });
      expect(transport).not.toHaveBeenCalled();
      expect(delays).toEqual([]);
      expect(new PermanentError('x')).toBeInstanceOf(Error);
    });

    it('keeps delivering on other channels when one channel is down', async () => {
      const email = new FakeChannel('EMAIL', 10);
      const sms = new FakeChannel('SMS');
      const { service } = setup({ channels: [email, sms] });
      service.notify({ userId: 'u1', ...order });
      const results = await service.processQueue();
      expect(results.map((r) => r.status)).toEqual(['FAILED', 'SENT']);
      expect(sms.sent).toHaveLength(1);
    });
  });

  describe('dedupe and rate limit', () => {
    it('drops a duplicate inside the dedupe window and accepts it after', () => {
      const { service, advance } = setup();
      const otp = { userId: 'u1', templateId: 'otp', data: { otp: '1' }, dedupeKey: 'login-otp' };
      expect(service.notify(otp).status).toBe('QUEUED');
      advance(4_999);
      expect(service.notify(otp).status).toBe('DUPLICATE');
      advance(1);
      expect(service.notify(otp).status).toBe('QUEUED');
      expect(service.pendingCount).toBe(2);
    });

    it('rate limits per user, not globally', () => {
      const { service, advance } = setup();
      expect(service.notify({ userId: 'u1', ...order }).status).toBe('QUEUED');
      expect(service.notify({ userId: 'u1', ...order }).status).toBe('QUEUED');
      expect(service.notify({ userId: 'u1', ...order }).status).toBe('RATE_LIMITED');
      expect(service.notify({ userId: 'u2', ...order }).status).toBe('QUEUED');
      advance(60_000);
      expect(service.notify({ userId: 'u1', ...order }).status).toBe('QUEUED');
    });
  });

  describe('events and extensibility', () => {
    it('tells delivery listeners about every result until they unsubscribe', async () => {
      const { service } = setup();
      const seen: string[] = [];
      const off = service.onDelivery((r) => seen.push(`${r.channel}:${r.status}`));
      service.notify({ userId: 'u2', ...order });
      await service.processQueue();
      off();
      service.notify({ userId: 'u1', ...order });
      await service.processQueue();
      expect(seen.sort()).toEqual(['EMAIL:SENT', 'SMS:SKIPPED']); // channels run in parallel
    });

    it('lets a channel shape its message: SMS drops the subject (Template Method hook)', async () => {
      const sent: Message[] = [];
      const { service } = setup({ channels: [new SmsChannel(async (m) => void sent.push(m))] });
      service.notify({ userId: 'u1', ...order });
      await service.processQueue();
      expect(sent[0].subject).toBeUndefined();
      expect(sent[0].body).toBe('Hi Asha, order O42 is placed.');
    });

    it('accepts a new channel type without changing the service (Open/Closed)', async () => {
      const whatsapp = new FakeChannel('WHATSAPP');
      const { service, preferences } = setup({ channels: [whatsapp] });
      preferences.set('u9', { contacts: { WHATSAPP: '+919800000009' } });
      service.notify({ userId: 'u9', templateId: 'otp', data: { otp: '9' } });
      const [result] = await service.processQueue();
      expect(result.status).toBe('SENT');
      expect(whatsapp.sent[0].to).toBe('+919800000009');
    });
  });
});
