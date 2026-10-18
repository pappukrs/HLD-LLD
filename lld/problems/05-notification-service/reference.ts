// 05 · Notification Service: reference solution.
// Read this only after your own attempt passes (or after 75 minutes).

export type ChannelType = string; // 'EMAIL' | 'SMS' | 'PUSH' | anything you add

export interface Message {
  readonly notificationId: string;
  readonly userId: string;
  readonly channel: ChannelType;
  readonly to: string;
  readonly subject?: string;
  readonly body: string;
}

export interface Channel {
  readonly type: ChannelType;
  send(message: Message): Promise<void>;
}

/** Throw this for errors that a retry cannot fix (bad address, unsubscribed device). */
export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentError';
  }
}

/** The real provider call (SES, an SMS gateway, FCM). Injected so tests can fake it. */
export type Transport = (message: Message) => Promise<void>;

export interface Template {
  subject?: string;
  body: string; // placeholders look like {{name}}
}

export interface UserPreferences {
  contacts: Partial<Record<ChannelType, string>>; // channel -> address
  optOut?: ChannelType[];
}

export interface NotificationRequest {
  userId: string;
  templateId: string;
  data?: Record<string, string | number>;
  channels?: ChannelType[]; // default: every registered channel
  dedupeKey?: string; // same key for the same user inside the dedupe window = duplicate
}

export type AcceptStatus = 'QUEUED' | 'DUPLICATE' | 'RATE_LIMITED';

export interface Accepted {
  readonly id: string;
  readonly status: AcceptStatus;
}

export type DeliveryStatus = 'SENT' | 'FAILED' | 'SKIPPED';

export interface DeliveryResult {
  readonly notificationId: string;
  readonly userId: string;
  readonly channel: ChannelType;
  readonly status: DeliveryStatus;
  readonly attempts: number;
  readonly error?: string;
}

export type DeliveryListener = (result: DeliveryResult) => void;

export interface RetryPolicy {
  maxAttempts: number; // total tries, including the first
  baseDelayMs: number; // delay before retry n = baseDelayMs * 2^(n-1)
}

export interface UserRateLimit {
  maxPerWindow: number;
  windowMs: number;
}

export interface NotificationServiceOptions {
  channels: Channel[];
  templates: TemplateRegistry;
  preferences: PreferenceStore;
  clock?: () => number;
  sleep?: (ms: number) => Promise<void>;
  retry?: RetryPolicy; // default { maxAttempts: 3, baseDelayMs: 1000 }
  rateLimit?: UserRateLimit; // default { maxPerWindow: 10, windowMs: 60_000 }
  dedupeWindowMs?: number; // default 10 min
}

// Template Method: send() fixes the steps (validate, format, deliver).
// Subclasses only say what a valid address is and how to shape the message.
export abstract class BaseChannel implements Channel {
  abstract readonly type: ChannelType;

  constructor(private readonly transport: Transport) {}

  async send(message: Message): Promise<void> {
    if (!this.isValidAddress(message.to)) {
      throw new PermanentError(`Invalid ${this.type} address: ${message.to}`);
    }
    await this.transport(this.format(message));
  }

  protected abstract isValidAddress(to: string): boolean;

  protected format(message: Message): Message {
    return message;
  }
}

export class EmailChannel extends BaseChannel {
  readonly type = 'EMAIL';

  protected isValidAddress(to: string): boolean {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to);
  }
}

export class SmsChannel extends BaseChannel {
  readonly type = 'SMS';

  protected isValidAddress(to: string): boolean {
    return /^\+\d{10,15}$/.test(to);
  }

  protected format(message: Message): Message {
    const { subject, ...rest } = message; // SMS has no subject line
    return rest;
  }
}

export class PushChannel extends BaseChannel {
  readonly type = 'PUSH';

  protected isValidAddress(to: string): boolean {
    return to.trim().length > 0; // a device token
  }
}

export class TemplateRegistry {
  private readonly templates = new Map<string, Template>();

  register(id: string, template: Template): void {
    this.templates.set(id, template);
  }

  render(id: string, data: Record<string, string | number> = {}): Template {
    const template = this.templates.get(id);
    if (!template) throw new Error(`Unknown template ${id}`);
    const fill = (text: string) =>
      text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
        if (!(name in data)) throw new Error(`Template ${id} needs "${name}"`);
        return String(data[name]);
      });
    return {
      subject: template.subject === undefined ? undefined : fill(template.subject),
      body: fill(template.body),
    };
  }
}

export class PreferenceStore {
  private readonly prefs = new Map<string, UserPreferences>();

  set(userId: string, preferences: UserPreferences): void {
    this.prefs.set(userId, preferences);
  }

  get(userId: string): UserPreferences | undefined {
    return this.prefs.get(userId);
  }
}

interface Job {
  id: string;
  userId: string;
  channels: ChannelType[];
  content: Template;
}

export class NotificationService {
  private readonly channels = new Map<ChannelType, Channel>();
  private readonly templates: TemplateRegistry;
  private readonly preferences: PreferenceStore;
  private readonly clock: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly retry: RetryPolicy;
  private readonly rateLimit: UserRateLimit;
  private readonly dedupeWindowMs: number;

  private readonly queue: Job[] = [];
  private readonly listeners = new Set<DeliveryListener>();
  private readonly sentAt = new Map<string, number[]>(); // userId -> accept times (sliding log)
  private readonly seen = new Map<string, number>(); // userId:dedupeKey -> accept time
  private nextId = 1;

  constructor(options: NotificationServiceOptions) {
    for (const c of options.channels) this.channels.set(c.type, c);
    this.templates = options.templates;
    this.preferences = options.preferences;
    this.clock = options.clock ?? Date.now;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.retry = options.retry ?? { maxAttempts: 3, baseDelayMs: 1000 };
    this.rateLimit = options.rateLimit ?? { maxPerWindow: 10, windowMs: 60_000 };
    this.dedupeWindowMs = options.dedupeWindowMs ?? 10 * 60_000;
  }

  /**
   * Validates and queues. Fast and synchronous, like publishing to RabbitMQ.
   * Programming errors (unknown user, template, channel, missing data) throw here, not later.
   */
  notify(request: NotificationRequest): Accepted {
    const { userId, dedupeKey } = request;
    if (!this.preferences.get(userId)) throw new Error(`Unknown user ${userId}`);
    const channels = request.channels ?? [...this.channels.keys()];
    for (const c of channels) if (!this.channels.has(c)) throw new Error(`Unknown channel ${c}`);
    const content = this.templates.render(request.templateId, request.data);

    const id = `N${this.nextId++}`;
    const now = this.clock();

    // Dedupe before the rate limit, so a duplicate does not use up the user's quota.
    const dedupeId = dedupeKey === undefined ? undefined : `${userId}:${dedupeKey}`;
    if (dedupeId !== undefined) {
      const at = this.seen.get(dedupeId);
      if (at !== undefined && now - at < this.dedupeWindowMs) return { id, status: 'DUPLICATE' };
    }

    const times = (this.sentAt.get(userId) ?? []).filter((t) => now - t < this.rateLimit.windowMs);
    if (times.length >= this.rateLimit.maxPerWindow) {
      this.sentAt.set(userId, times);
      return { id, status: 'RATE_LIMITED' };
    }
    times.push(now);
    this.sentAt.set(userId, times);
    if (dedupeId !== undefined) this.seen.set(dedupeId, now);

    this.queue.push({ id, userId, channels, content });
    return { id, status: 'QUEUED' };
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  /** The worker. In production this is a queue consumer; here tests call it directly. */
  async processQueue(): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];
    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      // Channels are independent: a slow or failing SMS must not delay the email.
      const perChannel = await Promise.all(job.channels.map((c) => this.deliver(job, c)));
      results.push(...perChannel);
    }
    return results;
  }

  /** Observer: audit logs, metrics, webhooks. Returns an unsubscribe function. */
  onDelivery(listener: DeliveryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async deliver(job: Job, type: ChannelType): Promise<DeliveryResult> {
    const result = await this.attempt(job, type);
    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch {
        // A broken listener must not break delivery.
      }
    }
    return result;
  }

  private async attempt(job: Job, type: ChannelType): Promise<DeliveryResult> {
    const base = { notificationId: job.id, userId: job.userId, channel: type };
    const prefs = this.preferences.get(job.userId);
    const to = prefs?.contacts[type];
    if (prefs?.optOut?.includes(type)) return { ...base, status: 'SKIPPED', attempts: 0, error: 'opted out' };
    if (!to) return { ...base, status: 'SKIPPED', attempts: 0, error: 'no address' };

    const channel = this.channels.get(type)!;
    const message: Message = { ...base, to, ...job.content };
    for (let attempt = 1; ; attempt++) {
      try {
        await channel.send(message);
        return { ...base, status: 'SENT', attempts: attempt };
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        if (e instanceof PermanentError || attempt >= this.retry.maxAttempts) {
          return { ...base, status: 'FAILED', attempts: attempt, error };
        }
        await this.sleep(this.retry.baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }
}
