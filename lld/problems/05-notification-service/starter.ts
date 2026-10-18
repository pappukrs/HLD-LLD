// 05 · Notification Service: your implementation goes here.
// Keep the exported names and signatures; the tests import them.
// Run: npx vitest run lld/problems/05-notification-service

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

// Template Method: send() fixes the steps. Subclasses fill in the hooks.
export abstract class BaseChannel implements Channel {
  abstract readonly type: ChannelType;

  constructor(transport: Transport) {
    // TODO
  }

  async send(message: Message): Promise<void> {
    throw new Error('TODO: invalid address -> PermanentError; else transport(format(message))');
  }

  protected abstract isValidAddress(to: string): boolean;

  protected format(message: Message): Message {
    return message;
  }
}

export class EmailChannel extends BaseChannel {
  readonly type = 'EMAIL';

  protected isValidAddress(to: string): boolean {
    throw new Error('TODO');
  }
}

export class SmsChannel extends BaseChannel {
  readonly type = 'SMS';

  protected isValidAddress(to: string): boolean {
    throw new Error('TODO: + followed by 10 to 15 digits');
  }

  protected format(message: Message): Message {
    throw new Error('TODO: SMS has no subject');
  }
}

export class PushChannel extends BaseChannel {
  readonly type = 'PUSH';

  protected isValidAddress(to: string): boolean {
    throw new Error('TODO');
  }
}

export class TemplateRegistry {
  register(id: string, template: Template): void {
    throw new Error('TODO');
  }

  render(id: string, data?: Record<string, string | number>): Template {
    throw new Error('TODO: replace {{name}}; throw on unknown template or missing data');
  }
}

export class PreferenceStore {
  set(userId: string, preferences: UserPreferences): void {
    throw new Error('TODO');
  }

  get(userId: string): UserPreferences | undefined {
    throw new Error('TODO');
  }
}

export class NotificationService {
  constructor(options: NotificationServiceOptions) {
    // TODO
  }

  /** Validates and queues. Throws on unknown user, template, channel or missing data. */
  notify(request: NotificationRequest): Accepted {
    throw new Error('TODO: dedupe, then per-user rate limit, then enqueue');
  }

  get pendingCount(): number {
    throw new Error('TODO');
  }

  /** The worker: drains the queue, sends with retry and backoff. */
  async processQueue(): Promise<DeliveryResult[]> {
    throw new Error('TODO');
  }

  /** Returns an unsubscribe function. */
  onDelivery(listener: DeliveryListener): () => void {
    throw new Error('TODO');
  }
}
