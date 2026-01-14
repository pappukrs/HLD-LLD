# Part 4: Reliability, Resilience & Observability - Master Guide

## 🎯 Learning Objective
By the end of this guide, you'll be able to design fault-tolerant systems, implement comprehensive monitoring, secure applications against attacks, and recover from disasters - skills that distinguish senior engineers in interviews.

---

## Module 4.1: Reliability Patterns (Deep Dive)

### 🔴 Circuit Breaker Pattern

**Core Concept**: Prevents cascading failures by stopping requests to failing services, just like an electrical circuit breaker prevents overload.

#### **Three States (COH Mnemonic)**
1. **Closed (Normal Operation)**
   - All requests pass through
   - Failures are counted
   - When failure threshold exceeded → Open

2. **Open (Failing)**
   - All requests fail immediately (no actual calls)
   - Saves resources, prevents cascading failures
   - After timeout period → Half-Open

3. **Half-Open (Testing)**
   - Limited requests allowed through
   - If successful → Closed
   - If failed → Open again

#### **Implementation Details**

```typescript
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  
  constructor(
    private failureThreshold: number = 5,      // Open after 5 failures
    private successThreshold: number = 2,      // Close after 2 successes
    private timeout: number = 60000,           // 60s before retry
    private monitoringWindow: number = 10000   // Count failures in 10s
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.timeout) {
        this.state = 'HALF_OPEN';
        console.log('Circuit breaker: OPEN → HALF_OPEN');
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successCount = 0;
        console.log('Circuit breaker: HALF_OPEN → CLOSED');
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.log('Circuit breaker: CLOSED → OPEN');
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount
    };
  }
}

// Usage Example
const paymentServiceBreaker = new CircuitBreaker(3, 2, 30000);

async function makePayment(orderId: string) {
  try {
    return await paymentServiceBreaker.execute(async () => {
      const response = await fetch(`/api/payment/${orderId}`);
      if (!response.ok) throw new Error('Payment failed');
      return response.json();
    });
  } catch (error) {
    // Fallback: queue for later processing
    await queueFailedPayment(orderId);
    return { status: 'queued' };
  }
}
```

**Configuration Guidelines**:
- **Failure Threshold**: 50-60% error rate or 5 consecutive failures
- **Timeout**: 30-60 seconds for most services
- **Success Threshold**: 2-3 successful requests before closing

---

### 🔄 Retry Logic with Exponential Backoff & Jitter

**Why Needed**: Transient failures (network blips, temporary overload) shouldn't fail requests permanently.

#### **Exponential Backoff Formula**
```
wait_time = base_delay * (2 ^ attempt) + random_jitter
```

**Jitter**: Random delay to prevent thundering herd (all clients retrying simultaneously)

#### **Advanced Implementation**

```typescript
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;        // milliseconds
  maxDelay: number;         // cap the exponential growth
  retryableErrors: string[];
  jitter: boolean;
}

class RetryStrategy {
  constructor(private config: RetryConfig) {}

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string = ''
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        if (attempt > 0) {
          console.log(`${context}: Success on attempt ${attempt + 1}`);
        }
        
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Don't retry non-retryable errors
        if (!this.isRetryable(error)) {
          throw error;
        }
        
        // Don't wait after last attempt
        if (attempt < this.config.maxRetries) {
          const delay = this.calculateDelay(attempt);
          console.log(`${context}: Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    
    throw new Error(`${context}: Failed after ${this.config.maxRetries + 1} attempts. Last error: ${lastError.message}`);
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = this.config.baseDelay * Math.pow(2, attempt);
    
    // Cap at maxDelay
    const cappedDelay = Math.min(exponentialDelay, this.config.maxDelay);
    
    // Add jitter (0-100% of delay)
    if (this.config.jitter) {
      const jitter = Math.random() * cappedDelay;
      return Math.floor(cappedDelay + jitter);
    }
    
    return cappedDelay;
  }

  private isRetryable(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // HTTP status codes that are retryable
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    if (error.response && retryableStatusCodes.includes(error.response.status)) {
      return true;
    }
    
    // Custom retryable errors
    if (this.config.retryableErrors.includes(error.message)) {
      return true;
    }
    
    return false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage Examples
const defaultRetry = new RetryStrategy({
  maxRetries: 3,
  baseDelay: 1000,    // Start with 1 second
  maxDelay: 10000,    // Cap at 10 seconds
  retryableErrors: ['TemporaryFailure'],
  jitter: true
});

// Example 1: Database query
async function fetchUserData(userId: string) {
  return defaultRetry.executeWithRetry(
    async () => {
      const result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (!result.rows.length) throw new Error('UserNotFound'); // Not retryable
      return result.rows[0];
    },
    `FetchUser(${userId})`
  );
}

// Example 2: External API call
const aggressiveRetry = new RetryStrategy({
  maxRetries: 5,
  baseDelay: 500,
  maxDelay: 30000,
  retryableErrors: [],
  jitter: true
});

async function callThirdPartyAPI(endpoint: string) {
  return aggressiveRetry.executeWithRetry(
    async () => {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    },
    `ThirdPartyAPI(${endpoint})`
  );
}
```

**Delay Progression Example**:
```
Attempt 0: 1000ms + jitter(0-1000) = 1000-2000ms
Attempt 1: 2000ms + jitter(0-2000) = 2000-4000ms
Attempt 2: 4000ms + jitter(0-4000) = 4000-8000ms
Attempt 3: 8000ms + jitter(0-8000) = 8000-16000ms (capped at maxDelay if configured)
```

---

### 🚢 Bulkhead Pattern (Resource Isolation)

**Concept**: Like compartments in a ship, isolate resources so one failing component doesn't sink the entire system.

#### **Types of Bulkheads**

1. **Thread Pool Isolation**
```typescript
class ThreadPoolBulkhead {
  private queues: Map<string, Array<() => Promise<any>>> = new Map();
  private activeCount: Map<string, number> = new Map();
  
  constructor(private pools: Map<string, number>) {} // service -> max concurrent
  
  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const maxConcurrent = this.pools.get(serviceName) || 10;
    const active = this.activeCount.get(serviceName) || 0;
    
    if (active >= maxConcurrent) {
      throw new Error(`Bulkhead full for ${serviceName}`);
    }
    
    this.activeCount.set(serviceName, active + 1);
    
    try {
      return await operation();
    } finally {
      this.activeCount.set(serviceName, (this.activeCount.get(serviceName) || 1) - 1);
    }
  }
}

const bulkhead = new ThreadPoolBulkhead(new Map([
  ['payment-service', 5],      // Max 5 concurrent payment calls
  ['email-service', 10],       // Max 10 concurrent email sends
  ['analytics-service', 20]    // Max 20 concurrent analytics calls
]));
```

2. **Connection Pool Isolation**
```typescript
// Database connection pools
const readPool = new Pool({ max: 20 });   // 20 connections for reads
const writePool = new Pool({ max: 5 });   // 5 connections for writes
const analyticsPool = new Pool({ max: 10 }); // 10 for analytics queries

// Critical writes never blocked by long-running analytics
```

3. **Semaphore-based Resource Limiting**
```typescript
class Semaphore {
  private current: number = 0;
  private queue: Array<() => void> = [];
  
  constructor(private max: number) {}
  
  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    
    return new Promise(resolve => this.queue.push(resolve));
  }
  
  release(): void {
    this.current--;
    const next = this.queue.shift();
    if (next) {
      this.current++;
      next();
    }
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }
}

const apiSemaphore = new Semaphore(100); // Max 100 concurrent API requests
```

**Real-World Example: E-commerce System**
```
Total Resources: 100 threads
- Checkout: 30 threads (critical)
- Product Search: 40 threads (high traffic)
- Recommendations: 20 threads (nice to have)
- Admin Panel: 10 threads (low priority)

If recommendations service hangs, it only affects 20 threads, not entire system.
```

---

### ⏱️ Timeout Strategies

**Types of Timeouts**:

1. **Connection Timeout**: Max time to establish connection
2. **Read Timeout**: Max time waiting for response after connection
3. **Request Timeout**: Total end-to-end time

```typescript
interface TimeoutConfig {
  connection: number;
  read: number;
  total: number;
}

class TimeoutManager {
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string = 'Operation timed out'
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      )
    ]);
  }
}

// Progressive timeout example
async function fetchWithProgressiveTimeout(url: string) {
  const timeout = new TimeoutManager();
  
  try {
    // Try with short timeout first
    return await timeout.executeWithTimeout(
      () => fetch(url),
      1000,
      'Fast path timeout'
    );
  } catch (error) {
    // Fallback to slower path
    return await timeout.executeWithTimeout(
      () => fetch(url + '?cache=fallback'),
      5000,
      'Fallback timeout'
    );
  }
}
```

**Timeout Guidelines**:
- **Fast operations** (cache, local DB): 50-200ms
- **Standard APIs**: 1-3 seconds
- **External services**: 5-10 seconds
- **Batch jobs**: 30-60 seconds

---

### 🎭 Graceful Degradation

**Concept**: System continues with reduced functionality instead of complete failure.

#### **Degradation Strategies**

```typescript
class FeatureToggle {
  private features: Map<string, boolean> = new Map();
  
  async executeWithDegradation<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    featureName: string
  ): Promise<T> {
    if (!this.features.get(featureName)) {
      console.log(`Feature ${featureName} disabled, using fallback`);
      return fallback();
    }
    
    try {
      return await primary();
    } catch (error) {
      console.log(`Primary failed for ${featureName}, degrading to fallback`);
      this.features.set(featureName, false); // Disable feature temporarily
      return fallback();
    }
  }
}

// Real-world example: Product page
async function renderProductPage(productId: string) {
  const toggle = new FeatureToggle();
  
  // Core data (required)
  const product = await fetchProduct(productId);
  
  // Enhanced features (optional)
  const recommendations = await toggle.executeWithDegradation(
    () => fetchRecommendations(productId),
    () => Promise.resolve([]), // Empty array fallback
    'recommendations'
  );
  
  const reviews = await toggle.executeWithDegradation(
    () => fetchReviews(productId),
    () => Promise.resolve({ average: 0, count: 0 }),
    'reviews'
  );
  
  const inventory = await toggle.executeWithDegradation(
    () => fetchRealTimeInventory(productId),
    () => Promise.resolve({ available: true }), // Optimistic fallback
    'real-time-inventory'
  );
  
  return {
    product,
    recommendations,
    reviews,
    inventory
  };
}
```

**Degradation Levels**:
1. **Full functionality**: All features working
2. **Reduced features**: Non-critical features disabled
3. **Core only**: Only essential operations
4. **Read-only mode**: No writes, display cached data
5. **Static fallback**: Pre-generated static pages

---

### 🌪️ Chaos Engineering Principles

**Definition**: Deliberately injecting failures to test system resilience.

#### **Chaos Experiments**

```typescript
class ChaosMonkey {
  private enabled: boolean = process.env.CHAOS_ENABLED === 'true';
  
  // Randomly fail requests
  async injectLatency(operation: () => Promise<any>, probability: number = 0.1) {
    if (this.enabled && Math.random() < probability) {
      const delay = Math.random() * 5000; // 0-5 seconds
      console.log(`[CHAOS] Injecting ${delay}ms latency`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    return operation();
  }
  
  async injectFailure(operation: () => Promise<any>, probability: number = 0.05) {
    if (this.enabled && Math.random() < probability) {
      console.log('[CHAOS] Injecting failure');
      throw new Error('Chaos-induced failure');
    }
    return operation();
  }
  
  async injectException(operation: () => Promise<any>, probability: number = 0.05) {
    if (this.enabled && Math.random() < probability) {
      const exceptions = [
        new Error('ECONNREFUSED'),
        new Error('ETIMEDOUT'),
        { response: { status: 503 } }
      ];
      throw exceptions[Math.floor(Math.random() * exceptions.length)];
    }
    return operation();
  }
}

const chaos = new ChaosMonkey();

// Usage in services
async function callPaymentService(amount: number) {
  return chaos.injectLatency(
    () => chaos.injectFailure(
      async () => {
        const response = await fetch('/api/payment', {
          method: 'POST',
          body: JSON.stringify({ amount })
        });
        return response.json();
      },
      0.05 // 5% failure rate
    ),
    0.1 // 10% latency injection
  );
}
```

**Chaos Engineering Steps**:
1. **Define steady state**: Normal behavior metrics
2. **Hypothesize**: System should tolerate X failure
3. **Inject failure**: Kill service, add latency, corrupt data
4. **Observe**: Does system maintain steady state?
5. **Improve**: Fix gaps, add resilience patterns

---

## Module 4.2: Monitoring & Alerting

### 📊 RED & USE Metrics

#### **RED Method (Request-Driven Services)**
```
Rate - Requests per second
Errors - Failed requests per second
Duration - Latency distribution (p50, p95, p99)
```

#### **USE Method (Resource-Oriented)**
```
Utilization - % time resource is busy
Saturation - Degree of queued work
Errors - Error count
```

**Implementation with Prometheus**:

```typescript
import { Counter, Histogram, Gauge, register } from 'prom-client';

class MetricsCollector {
  // RED Metrics
  private requestCounter = new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'path', 'status']
  });
  
  private requestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'path'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10] // seconds
  });
  
  // USE Metrics
  private cpuUsage = new Gauge({
    name: 'cpu_usage_percent',
    help: 'CPU usage percentage'
  });
  
  private memoryUsage = new Gauge({
    name: 'memory_usage_bytes',
    help: 'Memory usage in bytes'
  });
  
  private dbConnectionPool = new Gauge({
    name: 'db_connection_pool_size',
    help: 'Database connection pool',
    labelNames: ['state'] // 'active', 'idle', 'waiting'
  });
  
  recordRequest(method: string, path: string, status: number, duration: number) {
    this.requestCounter.inc({ method, path, status: status.toString() });
    this.requestDuration.observe({ method, path }, duration / 1000);
  }
  
  updateResourceMetrics() {
    const usage = process.memoryUsage();
    this.memoryUsage.set(usage.heapUsed);
    this.cpuUsage.set(process.cpuUsage().user / 1000000); // Convert to %
  }
  
  getMetrics() {
    return register.metrics();
  }
}

// Express middleware
const metrics = new MetricsCollector();

app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    metrics.recordRequest(req.method, req.path, res.statusCode, duration);
  });
  
  next();
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(metrics.getMetrics());
});
```

---

### 📝 Structured Logging

**Why Structured**: Easily queryable, machine-parseable logs.

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service: string;
  traceId?: string;
  userId?: string;
  metadata?: Record<string, any>;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

class StructuredLogger {
  constructor(
    private service: string,
    private minLevel: LogLevel = LogLevel.INFO
  ) {}
  
  private log(level: LogLevel, message: string, metadata?: Record<string, any>, error?: Error) {
    if (level < this.minLevel) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      service: this.service,
      traceId: this.getTraceId(),
      metadata
    };
    
    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }
    
    console.log(JSON.stringify(entry));
  }
  
  debug(message: string, metadata?: Record<string, any>) {
    this.log(LogLevel.DEBUG, message, metadata);
  }
  
  info(message: string, metadata?: Record<string, any>) {
    this.log(LogLevel.INFO, message, metadata);
  }
  
  warn(message: string, metadata?: Record<string, any>) {
    this.log(LogLevel.WARN, message, metadata);
  }
  
  error(message: string, error?: Error, metadata?: Record<string, any>) {
    this.log(LogLevel.ERROR, message, metadata, error);
  }
  
  fatal(message: string, error?: Error, metadata?: Record<string, any>) {
    this.log(LogLevel.FATAL, message, metadata, error);
  }
  
  private getTraceId(): string | undefined {
    // Get from async context or request headers
    return (global as any).currentTraceId;
  }
}

// Usage
const logger = new StructuredLogger('payment-service');

logger.info('Payment processed', {
  orderId: 'ORD-123',
  amount: 99.99,
  currency: 'USD',
  duration: 234
});

// Output:
// {
//   "timestamp": "2026-01-14T10:30:00.000Z",
//   "level": "INFO",
//   "message": "Payment processed",
//   "service": "payment-service",
//   "traceId": "abc-123-def",
//   "metadata": {
//     "orderId": "ORD-123",
//     "amount": 99.99,
//     "currency": "USD",
//     "duration": 234
//   }
// }
```

**Log Levels Usage**:
- **DEBUG**: Detailed info for development
- **INFO**: Normal operations (user login, order placed)
- **WARN**: Degraded state but operational (high latency, retry succeeded)
- **ERROR**: Operation failed but system stable
- **FATAL**: System crash, data loss

---

### 🔍 Distributed Tracing

**Problem**: In microservices, one request touches many services. How to trace the full flow?

```typescript
import { v4 as uuidv4 } from 'uuid';

class DistributedTracing {
  // Generate unique trace ID for entire request chain
  static generateTraceId(): string {
    return uuidv4();
  }
  
  // Generate span ID for each service call
  static generateSpanId(): string {
    return uuidv4().substring(0, 8);
  }
}

// Express middleware to inject trace context
app.use((req, res, next) => {
  // Extract or generate trace ID
  req.traceId = req.headers['x-trace-id'] as string || DistributedTracing.generateTraceId();
  req.spanId = DistributedTracing.generateSpanId();
  req.parentSpanId = req.headers['x-parent-span-id'] as string;
  
  // Store in async context
  (global as any).currentTraceId = req.traceId;
  
  // Propagate to response
  res.setHeader('x-trace-id', req.traceId);
  
  next();
});

// Service-to-service call with trace propagation
async function callDownstreamService(url: string, traceId: string, spanId: string) {
  const newSpanId = DistributedTracing.generateSpanId();
  
  const response = await fetch(url, {
    headers: {
      'x-trace-id': traceId,
      'x-parent-span-id': spanId,
      'x-span-id': newSpanId
    }
  });
  
  return response.json();
}

// Logging with trace context
logger.info('Processing order', {
  traceId: req.traceId,
  spanId: req.spanId,
  parentSpanId: req.parentSpanId,
  operation: 'CreateOrder'
});
```

**Trace Visualization**:
```
[API Gateway] traceId: abc-123
  ├─ [Auth Service] spanId: span-1, parent: root, duration: 50ms
  ├─ [Order Service] spanId: span-2, parent: root, duration: 200ms
  │   ├─ [Inventory Service] spanId: span-3, parent: span-2, duration: 30ms
  │   └─ [Payment Service] spanId: span-4, parent: span-2, duration: 150ms
  │       └─ [External Gateway] spanId: span-5, parent: span-4, duration: 120ms
  └─ [Notification Service] spanId: span-6, parent: root, duration: 100ms
```

---

### 🎯 SLI, SLO, SLA (Detailed)

#### **Definitions**
- **SLI (Service Level Indicator)**: Quantitative measure (e.g., latency, error rate)
- **SLO (Service Level Objective)**: Target value for SLI (e.g., 99.9% uptime)
- **SLA (Service Level Agreement)**: Contract with consequences if SLO violated

**Mnemonic: Indicator < Objective < Agreement**

#### **Real Examples**

```typescript
interface SLI {
  name: string;
  description: string;
  query: string;
  unit: string;
}

interface SLO {
  sli: string;
  target: number;
  window: string; // '30d', '7d'
  errorBudget?: number;
}

const slis: SLI[] = [
  {
    name: 'api_availability',
    description: 'Percentage of successful API requests',
    query: '(sum(rate(http_requests_total{status!~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) * 100',
    unit: 'percentage'
  },
  {
    name: 'api_latency_p99',
    description: '99th percentile response time',
    query: 'histogram_quantile(0.99, http_request_duration_seconds_bucket)',
    unit: 'seconds'
  },
  {
    name: 'order_processing_success',
    description: 'Percentage of orders successfully processed',
    query: '(orders_completed / orders_attempted) * 100',
    unit: 'percentage'
  }
];

const slos: SLO[] = [
  {
    sli: 'api_availability',
    target: 99.9,        // 99.9% availability
    window: '30d',
    errorBudget: 0.1     // 0.1% errors allowed = 43 minutes downtime/month
  },
  {
    sli: 'api_latency_p99',
    target: 0.5,         // 500ms
    window: '30d'
  },
  {
    sli: 'order_processing_success',
    target: 99.95,       // 99.95% success
    window: '7d'
  }
];

// Error Budget Calculation
class ErrorBudgetCalculator {
  calculateRemainingBudget(
    totalRequests: number,
    failedRequests: number,
    targetAvailability: number
  ): { budget: number; remaining: number; consumed: number } {
    const allowedFailures = totalRequests * (1 - targetAvailability / 100);
    const remaining = allowedFailures - failedRequests;
    const consumed = (failedRequests / allowedFailures) * 100;
    
    return {
      budget: allowedFailures,
      remaining: Math.max(0, remaining),
      consumed: Math.min(100, consumed)
    };
  }
}

// Example: For 1M requests/month with 99.9% SLO
const calc = new ErrorBudgetCalculator();
const result = calc.calculateRemainingBudget(1000000, 500, 99.9);
// {
//   budget: 1000 failures allowed,
//   remaining: 500 failures left,
//   consumed: 50% of error budget used
// }
```

#### **SLA Example with Penalties**
```typescript
interface SLA {
  slo: SLO;
  penalties: {
    threshold: number;  // % below target
    credit: number;     // % service credit
  }[];
}

const paymentServiceSLA: SLA = {
  slo: {
    sli: 'api_availability',
    target: 99.9,
    window: '30d'
  },
  penalties: [
    { threshold: 99.5, credit: 10 },   // 99.5-99.9%: 10% credit
    { threshold: 99.0, credit: 25 },   // 99.0-99.5%: 25% credit
    { threshold: 0, credit: 100 }      // Below 99.0%: 100% credit
  ]
};
```

#### **Alert Fatigue Prevention**
- **Symptoms**: Ignoring alerts, slow response, missed critical events.
- **Rules (TASP Mnemonic)**:
  1. **T**icket-only: Not every alert needs a page. Minor issues generate tickets.
  2. **A**ctionable: If there's no clear step to take, shouldn't be an alert.
  3. **S**mptom-based: Alert on "User cannot checkout" rather than "CPU is high".
  4. **P**age-worthy: Only wake up an engineer for SLO violations.

#### **Observability vs Monitoring**
- **Monitoring**: "Is the system healthy?" (Known unknowns). Dashboards and alerts.
- **Observability**: "Why is the system behaving like this?" (Unknown unknowns). Traces, logs, and high-cardinality data.

---

## Module 4.3: Rate Limiting & Throttling (Deep Dive)

### 🚀 Advanced Algorithms

#### **1. Token Bucket (Detailed)**
- **Concept**: A bucket with capacity $N$, refilled at rate $R$. Each request takes a token.
- **Burst Handling**: Allows bursts up to bucket capacity $N$.
- **Best For**: Systems that can handle occasional spikes.

#### **2. Leaky Bucket**
- **Concept**: Requests enter bucket; leak at a fixed rate.
- **Smoothing**: Forces a constant processing rate, regardless of spikes.
- **Best For**: Constant-rate traffic shaping (e.g., streaming).

#### **3. Fixed Window Counter**
- **Concept**: Count requests in fixed time windows (e.g., 100/min).
- **Edge Problem**: Can allow 200 requests in 1 second at the boundary of two windows.

#### **4. Sliding Window Log / Counter**
- **Log**: Store timestamps of every request. Exact but high memory usage.
- **Counter**: Blend current and previous window counts. Good balance.

### 🛠️ Implementation Examples

```javascript
// Distributed Rate Limiter with Redis (Sliding Window Counter)
async function isAllowed(userId, limit, windowSizeInSeconds) {
    const now = Date.now();
    const windowStart = now - (windowSizeInSeconds * 1000);
    const key = `ratelimit:${userId}`;

    // Atomic operation in Redis
    const [count] = await redis.multi()
        .zremrangebyscore(key, 0, windowStart) // Remove old requests
        .zadd(key, now, now)                  // Add current request
        .zcard(key)                            // Get current count
        .expire(key, windowSizeInSeconds)      // Cleanup
        .exec();

    return count <= limit;
}
```

### 🧠 Practice: Algorithm Selection Scenarios
1. **Scenario**: Public API for a Startup. Need to handle spikes but keep average rate.
   - **Choice**: **Token Bucket**.
2. **Scenario**: Sending emails to customers. Email provider has strict 10/sec limit.
   - **Choice**: **Leaky Bucket** (shaping).
3. **Scenario**: Simple rate limit for a non-critical internal tool.
   - **Choice**: **Fixed Window** (easy to implement).

---

## Module 4.4: Security Best Practices

### 🛡️ OWASP Top 10 (ISA Mnemonic)
1. **I**njection (SQLi, Command Injection)
2. **S**ensitive Data Exposure (Lack of encryption)
3. **A**uthentication Broken (Weak passwords, session hijacking)

### 🔒 Core Security Patterns

#### **1. Preventing SQL Injection**
- Use **Parameterized Queries** / Prepared Statements.
- **Never** concatenate user input into SQL strings.

```javascript
// ❌ Dangerous
db.query("SELECT * FROM users WHERE id = " + req.params.id);

// ✅ Secure
db.query("SELECT * FROM users WHERE id = ?", [req.params.id]);
```

#### **2. XSS & CSRF Protection**
- **XSS**: Sanitize input, use `Content-Security-Policy`.
- **CSRF**: Use Anti-CSRF tokens and `SameSite: Strict` cookies.

#### **3. Secret Management**
- Use **AWS Secrets Manager** or **HashiCorp Vault**.
- Avoid hardcoding API keys in `config.js` or `.env` files checked into git.

#### **4. DDoS Protection Strategies**
- **Layer 7**: Web Application Firewall (WAF), CAPTCHA.
- **Layer 4**: Cloudflare/AWS Shield, Rate limiting at the Edge.

---

## Module 4.5: Disaster Recovery & Backups

### ⏱️ RTO vs RPO (Mnemonic: Time to Recover vs Point to Recover)
- **RTO (Recovery Time Objective)**: Maximum allowable downtime. "How fast must it be back?"
- **RPO (Recovery Point Objective)**: Maximum allowable data loss. "How much data can we lose?"

### 📂 Backup Strategies
1. **Full Backup**: Complete copy. Slow, expensive, easiest recovery.
2. **Incremental**: Only changes since *last backup*. Fast, hard to restore (replays chain).
3. **Differential**: Only changes since *last full backup*. Balance of speed and restore complexity.

### 🌎 Disaster Recovery Architectures
1. **Backup & Restore**: (RTO: 24h+). Cheapest. Store backups in S3.
2. **Pilot Light**: (RTO: Hours). DB is running/replicated, apps are offshore.
3. **Warm Standby**: (RTO: Minutes). Scaled-down version of system always running.
4. **Multi-Site (Active-Active)**: (RTO: Seconds). Full system in two regions. Zero downtime.

### 🧠 Mnemonics for Module 4.5
- **3-2-1 Backup Rule**:
  - **3** copies of data.
  - **2** different media types.
  - **1** offsite copy.

---

## 🚀 Part 4 Practice: Hands-on Exercises

### 🧠 Practice 1: Design a Disaster Recovery Plan
**Challenge**: Design a DR plan for a high-traffic FinTech app with $RTO < 5min$ and $RPO = 0$.
**Solution**:
1. **Active-Active** multi-region setup.
2. **Synchronous DB replication** across regions.
3. Global Load Balancer (Route 53) with health checks.
4. Automated failover scripts.

### 🧠 Practice 2: Security Audit for e-Commerce
**Challenge**: Find 3 vulnerabilities in a system that stores user passwords in plain text and accepts un-sanitized reviews.
**Solution**:
1. **Sensitive Data Exposure**: Hash passwords with Argon2/BCrypt.
2. **XSS**: Use libraries like `DOMPurify` for reviews.
3. **Injection**: Ensure ORM uses parameterized queries.

---

## ✨ Mnemonics for Part 4
- **Circuit Breaker: COH** (Closed/Open/Half-Open)
- **Metrics: RED & USE**
- **Rate Limit: TLFS** (Token, Leaky, Fixed, Sliding)
- **Security: ISA** (Injection, Sensitive, Auth)
- **Backup: 3-2-1**

---

## ❓ Interview Q&A (Reliability & Security)

**Q1: How do you handle a thundering herd problem during a service outage?**
*A: Use **Retry with Jitter** so clients don't all hit the server at once. Implement **Rate Limiting** at the gateway to protect the recovering service.*

**Q2: Difference between SLO and SLA?**
*A: SLO is an internal goal (99.9% uptime). SLA is a legal contract with the customer (if we go under 99.5%, we pay you back).*

**Q3: When would you use a Token Bucket over a Leaky Bucket?**
*A: Token buckets are better when your application can handle bursts of traffic. Leaky buckets are better when you must enforce a strictly fixed processing rate.*

---

# Final Summary: HLD Master Guide Success

🎉 **You have completed the entire High-Level Design Master Guide!**

### What You've Mastered:
1. **Part 1**: Networking, DBs, Caching, and Core Theory.
2. **Part 2**: Scaling to millions, Sharding, Replication, and Global Load Balancing.
3. **Part 3**: Microservices, EDA (Sagas/CQRS), API Design, and Auth.
4. **Part 4**: Resilience, Observability, Security, and Disaster Recovery.

**Final Advice**: Don't just read - build! Pick one case study (e.g., Designing Uber) and apply every single pattern you've learned here. Good luck with your interviews! 🚀