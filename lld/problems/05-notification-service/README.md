# 05 · Notification Service

> Asked at: Razorpay, PhonePe, Swiggy, Flipkart, Atlassian, Uber. Close to real fintech work: OTPs, payment alerts, order updates.
> Time box: **75 min** (15 min design, 45 min code, 15 min tests and extensions)
> Patterns you should reach for: **Strategy** (channels), **Template Method** (the fixed send steps), **Observer** (delivery events)

## Your v1 attempt: what to fix

Your first attempt is in [`v1-attempt.js`](./v1-attempt.js). Channels as strategies is the right idea. These are the issues an interviewer will find:

1. **The Observer wrapper adds nothing.** `NotificationObserver` only forwards `notify()` to `channel.send()`. `subscribe()` + `notifyAll()` is just a list of channels with a loop. Observer helps when many unknown parties react to one event (an `OrderPlaced` event goes to notifications, analytics and loyalty). Here the channel is chosen per user, so it is a Strategy. Use Observer for **delivery status events** (audit log, metrics) instead.
2. **There is no recipient.** `notifyAll("Order placed")` goes to every channel with no user and no address. A notification is always for a user, and each channel needs that user's email, phone or device token.
3. **No user preferences.** Users opt out of SMS or marketing email. Some users have no phone number. In many countries (India included) there are rules about promotional messages, so preferences are not optional.
4. **No templates.** Raw strings in the calling code. Product teams change copy without a deploy, and you need `{{name}}` and `{{orderId}}` placeholders. Missing data should fail at accept time, not when the SMS goes out.
5. **`send()` is synchronous.** A real provider call is a network call. It is slow and it fails. If the order API waits for the SMS gateway, a slow gateway slows down checkout. Accept fast, put the job on a queue (RabbitMQ in your stack), and let a worker deliver.
6. **No retry with backoff.** A timeout from the SMS gateway should be retried with growing delays. A bad email address should **not** be retried. You need to tell transient errors from permanent ones.
7. **One failing channel stops the rest.** If `EmailChannel.send()` throws inside the `for` loop, SMS and push are never sent.
8. **No per-user rate limit.** A bug in an upstream service can send a user 500 SMS in a minute. That costs money and annoys the user.
9. **No dedupe.** Upstream services retry too. Without a dedupe key, the user gets the same OTP twice.
10. **No result.** Nothing records whether a message was sent, skipped or failed, or how many attempts it took. Support teams and audits need this.

## Problem statement (as the interviewer says it)

"Design a notification service. Other services call it to send a notification to a user over email, SMS or push.
Users can opt out of channels. Messages come from templates. Delivery can fail and must be retried.
Don't let one user get spammed, and don't send the same OTP twice. Make it easy to add WhatsApp later."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Sync or async? | `notify()` validates and queues, then returns at once. `processQueue()` is the worker that delivers |
| Which channels for a request? | The requested ones, or all registered channels if none are given |
| User opted out, or has no address for a channel? | That channel is `SKIPPED`. The others still go out |
| Unknown user, template or channel, or missing template data? | Throw in `notify()`. These are caller bugs |
| Template syntax? | `{{name}}` placeholders in `subject` (optional) and `body` |
| Retry? | `maxAttempts` total tries. Delay before retry n = `baseDelayMs × 2^(n-1)`. `sleep` is injected |
| Which errors are not retried? | `PermanentError` (for example, an invalid address) |
| One channel fails? | The other channels are not affected. Channels are sent in parallel |
| Per-user rate limit? | At most `maxPerWindow` accepted notifications per user per `windowMs` (sliding window). Over the limit → `RATE_LIMITED` |
| Dedupe? | Same `(userId, dedupeKey)` inside `dedupeWindowMs` → `DUPLICATE`. Checked before the rate limit, so duplicates do not use quota |
| Delivery events? | `onDelivery(listener)` gets every `DeliveryResult`. It returns an unsubscribe function |
| Real queue, scheduling, quiet hours, priorities? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const templates = new TemplateRegistry();
templates.register('order', { subject: 'Order {{orderId}}', body: 'Hi {{name}}, order {{orderId}} is placed.' });

const preferences = new PreferenceStore();
preferences.set('u1', { contacts: { EMAIL: 'asha@example.com', SMS: '+919800000001' }, optOut: ['PUSH'] });

const service = new NotificationService({
  channels: [new EmailChannel(sesTransport), new SmsChannel(smsTransport)],
  templates,
  preferences,
  clock: () => Date.now(),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),   // injected, tests record delays
  retry: { maxAttempts: 3, baseDelayMs: 1000 },
  rateLimit: { maxPerWindow: 10, windowMs: 60_000 },
  dedupeWindowMs: 10 * 60_000,
});

service.notify({ userId: 'u1', templateId: 'order', data: { name: 'Asha', orderId: 'O42' }, dedupeKey: 'order-O42' });
// → { id: 'N1', status: 'QUEUED' | 'DUPLICATE' | 'RATE_LIMITED' }

await service.processQueue();
// → DeliveryResult[]: { notificationId, userId, channel, status: 'SENT' | 'FAILED' | 'SKIPPED', attempts, error? }

const off = service.onDelivery((result) => audit(result));

interface Channel { readonly type: string; send(message: Message): Promise<void> }
```

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `NotificationService`: the facade. `notify()` is the producer, `processQueue()` is the consumer
- `Channel` (interface, Strategy): one per medium. `type` is a string, so `WHATSAPP` needs no enum change
- `BaseChannel` (Template Method): `send()` = validate address → `format()` → transport. Subclasses give `isValidAddress()` and may override `format()` (SMS drops the subject)
- `Transport`: the provider call (SES, an SMS gateway, FCM), injected. Switching providers does not touch the channel logic
- `PermanentError`: marks errors that a retry cannot fix
- `TemplateRegistry`: stores and renders templates. Fails on missing data
- `PreferenceStore`: contacts and opt-outs per user. In production, a table plus a cache
- `Job`: an internal queued item with already-rendered content
- `DeliveryResult`: what happened per channel. `DeliveryListener` (Observer) gets each one

Flow: `notify` → validate → dedupe → rate limit → render → enqueue. Worker: dequeue → per channel (in parallel): preferences → send with retry → result → listeners.

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/05-notification-service` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 75 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Use a real queue.** One queue per channel (or per priority) in RabbitMQ or Kafka. Retries go to a delay queue, not a `sleep` in the worker, so the worker is free for other jobs. After the last attempt, send the job to a dead-letter queue.
2. **Add jitter to the backoff.** If a provider is down for a minute, every retry fires at the same time when it comes back. Use a random delay between 0 and the computed backoff ("full jitter").
3. **At-least-once delivery means duplicates.** The worker can crash after the provider accepted the message but before the ack. Pass an idempotency key to the provider when it supports one, and accept that some duplicates can still happen.
4. **Priorities.** An OTP must not wait behind a million marketing emails. Separate queues and workers for transactional and promotional traffic.
5. **Provider failover.** Two SMS providers. If one fails often, switch to the other. A circuit breaker per provider decides this.
6. **Quiet hours and scheduling.** Store a `sendAt`, and do not send promotional messages at night in the user's time zone.
7. **Dedupe and rate limit across servers.** In-memory maps work only in one process. Use Redis: `SET key NX EX <seconds>` for dedupe, and a counter with a TTL for the rate limit.

## Self-check before you call it done

- [ ] Adding WhatsApp means one new `Channel` class. No change in `NotificationService`.
- [ ] One failing channel cannot block or fail the other channels.
- [ ] Permanent errors are not retried. Transient errors are retried with growing delays.
- [ ] Time and sleep are injected. The tests take milliseconds, not seconds.
- [ ] Caller bugs throw early in `notify()`. Delivery problems become `FAILED` or `SKIPPED` results, not exceptions.

## Concepts used

- [Strategy](../../4-behavioral/L20-strategy/README.md) · [Template Method](../../4-behavioral/L26-template-method/README.md) · [Observer](../../4-behavioral/L21-observer/README.md) · [Concurrency in Node](../../5-machine-coding/L32-concurrency-in-node/README.md)
- HLD links: [Notification System](../../../hld/case-studies/05-notification-system) · [Message queues](../../../hld/4-async/H20-message-queues/README.md) · [Idempotency and delivery semantics](../../../hld/4-async/H22-delivery-semantics/README.md) · [Resilience patterns](../../../hld/5-reliability/H27-resilience/README.md)
- Visuals: [Observer and pub-sub](../../4-behavioral/L21-observer/visual.html) · [Delivery semantics](../../../hld/4-async/H22-delivery-semantics/visual.html) · [Circuit breaker and retries](../../../hld/5-reliability/H27-resilience/visual.html)
