# H30 · Observability: logs, metrics, traces, SLOs

> **Time:** ~45 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/5-reliability/H30-observability/demo.ts`)
> **Builds on:** [H25 Microservices](../H25-microservices/README.md) · [H27 Resilience](../H27-resilience/README.md) · [H02 Back-of-envelope](../../1-basics/H02-back-of-envelope/README.md) (the nines) · **Used in:** [Metrics and monitoring](../../case-studies/19-metrics-monitoring/README.md), [Ad click aggregation](../../case-studies/20-ad-click-aggregation/README.md), [Payment system](../../case-studies/08-payment-system/README.md), and the "how would you monitor this?" question at the end of every HLD round

## The idea in one line

Metrics tell you **that** something is wrong, traces tell you **where**, logs tell you **why**; define SLOs on what users feel and page when the error budget burns too fast.

## Why it matters (the problem it solves)

Checkout success drops from 98% to 91% at 9 p.m. during a sale. There are 40 services. Without observability you SSH into pods and grep text logs while revenue leaks. With it:

1. An SLO burn-rate alert pages the on-call within ~5 minutes.
2. The dashboard shows errors only on `POST /payments`, only for one bank.
3. An exemplar trace shows 2.8 s spent in Payment → Bank API, ending in a timeout.
4. The logs for that `trace_id` say `ETIMEDOUT` from the bank's new endpoint.
5. The breaker for that bank is opened, traffic is routed to another PSP. Total: 12 minutes.

Interviewers ask "how would you monitor this?" at the end of almost every design. A crisp answer (RED metrics, traces with context propagation, structured logs, SLOs with burn-rate alerts) is cheap points.

## How it works

### The three signals

| Signal | What it is | Answers | Cost driver |
|---|---|---|---|
| **Metrics** | Numbers over time with labels: `http_requests_total{route,status}` | Is it broken? How much? Trend? | Label **cardinality** |
| **Traces** | A tree of timed spans for one request across services | Which hop is slow or failing? | Volume → sampling |
| **Logs** | Timestamped events, structured JSON | What exactly happened in this request? | GB/day, retention |

Join them with ids: every log line carries `trace_id` and `span_id`; metric buckets carry **exemplars** (a sample trace id), so you click from a latency spike straight to a slow trace.

### What to measure

- **RED** for every service: **R**ate (req/s), **E**rrors (failed/s or %), **D**uration (latency histogram).
- **USE** for every resource (CPU, memory, disk, DB pool, queue): **U**tilisation, **S**aturation (waiting, queue length), **E**rrors.
- **Four golden signals** (Google SRE): latency, traffic, errors, saturation.
- **Business metrics**: payment success rate per PSP / bank / method, orders per minute, refunds pending. These often catch what technical metrics miss.
- **Async**: Kafka **consumer lag**, oldest message age, DLQ size.
- **Node.js specific**: **event loop lag**, heap used, GC pauses. A blocked event loop slows every request while CPU looks fine.

### Latency: percentiles from histograms

```
100 requests:  most 35–145 ms, a few 250–550 ms, 2 at ~2,000+ ms
average  ≈ 160 ms      ← looks healthy
p50      ≈ 95 ms
p99      ≈ 2,300 ms    ← 1 in 100 calls waits 2 s+. A page making 20 calls hits one ~18% of the time.
```

- Report **p50, p95, p99** (p99.9 on hot paths). Never alert on the average.
- Record latency as a **histogram** (bucket counts) in each pod. Buckets **add** across pods; then compute the percentile.
- You **cannot average p99s**. Pod A (1,000 req, p99 ~145 ms) and pod B (10 req, p99 ~2.2 s) average to ~1.2 s, but the real fleet p99 is ~340 ms.

### Cardinality

Every unique label combination is a separate time series in Prometheus.

```
route(20) × status(5) × method(3)              = 300 series        fine
+ pod(50)                                      = 15,000 series     fine
+ user_id(1,000,000)                           = 15 billion        Prometheus falls over
```

High-cardinality values (`user_id`, `payment_id`, `order_id`) go in **logs and trace attributes**, never metric labels.

### Tracing

```
trace 4bf92f35…  (traceparent: 00-4bf92f35…-00f067aa…-01)
gateway   ├────────────────────────────────────────┤ 320 ms
order       ├──────────────────────────────────────┤ 300 ms
inventory     ├─┤ 12 ms
payment          ├──────────────────────────────────┤ 280 ms
bank API          ├─────────────────────────────────┤ 260 ms  ✗ timeout
```

- Context travels in the W3C **`traceparent`** header (trace id, parent span id, sampled flag). Through Kafka/RabbitMQ it rides in **message headers**, so async consumers join the same trace.
- **OpenTelemetry** is the standard SDK + wire protocol (OTLP) for traces, metrics and logs. Node auto-instrumentation covers http, express, pg, redis, kafkajs, grpc.
- **Sampling.** Head-based (decide at the start, keep 1%) is cheap but usually drops the rare failing trace. **Tail-based** (the collector buffers whole traces and keeps all errors + slow ones + 1% of the rest) costs more, keeps what matters.

### Logs

- Structured JSON (`pino` in Node): `{"level":"error","msg":"bank call failed","trace_id":"4bf9…","merchant_id":"m_42","bank":"HDFC","latency_ms":2003,"err":"ETIMEDOUT"}`.
- Never log secrets, card numbers, CVV, OTPs, full Aadhaar, passwords. Mask PII.
- Ship with an agent (Fluent Bit, Vector) to Loki, Elasticsearch/OpenSearch or a vendor. Hot retention 7–30 days, then archive to S3.
- Log levels with intent: `error` = someone should look; `info` = business events; `debug` off in production (or sampled).

### SLI, SLO, SLA, error budget

- **SLI**: a measured ratio, e.g. "% of `POST /payments` that return non-5xx within 1 s".
- **SLO**: the target, e.g. **99.9% over 30 days**.
- **SLA**: a contract with penalties, looser than the SLO (e.g. 99.5%).
- **Error budget** = 1 − SLO = 0.1% of requests ≈ **43.2 min** of full outage per 30 days. Budget left → ship fast. Budget gone → freeze risky releases, fix reliability.

### Burn-rate alerting

```
burn rate = observed error rate / allowed error rate (0.1%)
1×    → budget lasts exactly 30 days
14.4× → 2% of the monthly budget in 1 hour → PAGE now      (window 1 h, confirm with 5 min)
6×    → 5% in 6 hours                     → page            (window 6 h, confirm with 30 min)
1×    → 10% in 3 days                     → ticket, not a page
```

Alert on **symptoms** users feel (error rate, latency SLO), not causes (CPU 80%). Causes go on dashboards for debugging. The short "confirm" window makes the alert reset quickly after a fix.

## In TypeScript

A histogram that merges across pods, and a burn-rate check:

```ts
const BUCKETS = [25, 50, 100, 250, 500, 1000, 2500, Infinity]; // ms upper bounds

class Histogram {
  counts = BUCKETS.map(() => 0);
  observe(ms: number) { this.counts[BUCKETS.findIndex((b) => ms <= b)]++; }
  merge(o: Histogram) { o.counts.forEach((c, i) => (this.counts[i] += c)); return this; }
  quantile(q: number): number {            // upper bound of the bucket holding the q-th request
    const total = this.counts.reduce((a, b) => a + b, 0);
    let seen = 0;
    for (let i = 0; i < BUCKETS.length; i++) {
      seen += this.counts[i];
      if (seen >= q * total) return BUCKETS[i];
    }
    return Infinity;
  }
}

function shouldPage(errors1h: number, total1h: number, errors5m: number, total5m: number, slo = 0.999) {
  const allowed = 1 - slo;
  const burn1h = errors1h / total1h / allowed;
  const burn5m = errors5m / total5m / allowed;
  return burn1h >= 14.4 && burn5m >= 14.4;   // fast burn, still happening now
}
```

[demo.ts](demo.ts) simulates two pods, shows average vs p99, the wrong "average of p99s", cardinality growth, trace propagation with `traceparent`, and an error budget with burn-rate alerts.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Pull metrics (Prometheus scrape) | Long-lived services in K8s | Short-lived jobs need a push gateway |
| Push metrics (StatsD, OTLP push) | Serverless, batch jobs | Receiver must handle floods |
| Head sampling | High volume, tight cost | Misses rare failures |
| Tail sampling | Need every error / slow trace | Collector buffers whole traces (memory) |
| Logs for everything | Small scale | Cost explodes; slow for trends; use metrics instead |
| Self-hosted (Prometheus, Grafana, Loki, Tempo, Jaeger) | Cost control, data residency | You run and scale it (Thanos/Mimir past ~1M series) |
| Vendor (Datadog, New Relic, Grafana Cloud) | Small platform team | Bill grows with hosts, cardinality and log volume |

Do not page on every metric. Alert fatigue makes people ignore the one page that matters. Do not trace 100% at high volume without tail sampling; you pay to store traces nobody reads.

## Common mistakes

- Alerting on CPU or on the average latency instead of SLO symptoms.
- Averaging p99 across pods, or using summaries (pre-computed quantiles) that cannot be merged.
- `user_id` or `order_id` as a metric label.
- Losing trace context at the queue boundary (no headers on Kafka messages).
- Head sampling at 1% and then wondering why the failing request has no trace.
- Logging card numbers, tokens or OTPs.
- An SLO of 100%. Nothing is 100%, and a zero budget means you can never ship.
- No business metrics: everything is green while payment success rate for one bank is 40%.

## Say this in the interview

> "Every service exports RED metrics, with latency as Prometheus histograms so we can merge pods and read p99, plus business metrics like payment success rate per PSP and bank. Traces use OpenTelemetry with the W3C traceparent header, carried through Kafka headers too, and the collector does tail sampling: keep every error and slow trace, plus 1% of the rest. Logs are JSON with the trace id, and never contain card data."

> "The SLO for the payment API is 99.95% of requests succeeding within 1 second over 30 days. We page when the burn rate is above 14.4× over an hour and still high over the last 5 minutes; slow burns go to a ticket queue. High-cardinality ids stay in logs and traces, never in metric labels."

## Your experience hook

- **Video SFU**: you ran **Prometheus + Grafana** for the microservices. Name the metrics you would show: active rooms, producers/consumers per Mediasoup worker, worker CPU, signaling p99, join success rate, packet loss / RTT from WebRTC stats.
- **IoT platform, 10k devices**: connected sockets per node, messages/s in, Redis queue depth (saturation), batch flush latency, DB write latency. Consumer lag is the early warning before the DB falls behind.
- **Cache-aside at Chesa (~400 ms → ~160 ms)**: you proved that win with numbers. Say you would track cache hit ratio and p95 per endpoint, before and after.

## Numbers to remember

| Availability | Downtime / 30 days | Per year |
|---|---|---|
| 99% | 7.2 h | 3.65 days |
| 99.9% | **43.2 min** | 8.76 h |
| 99.95% | 21.6 min | 4.38 h |
| 99.99% | 4.3 min | 52.6 min |

- Burn rate **14.4×** for 1 h = **2%** of a 30-day budget. **6×** for 6 h = 5%.
- Prometheus scrape interval **15–30 s**; an alert needs 1–2 min to fire reliably.
- 1,000 pods × 500 series = **500k series**: one healthy Prometheus; beyond ~1–2M shard or use Thanos/Mimir/Cortex.
- Head sampling at **1%** keeps 1 of 100 traces; an error at 0.1% rate is kept ~once per 100,000 requests.

## Self-test

<details><summary>1. Why can't you average p99s across pods?</summary>

Percentiles do not combine linearly. A low-traffic pod with a high p99 distorts the average. Sum the histogram buckets across pods, then compute the percentile.
</details>

<details><summary>2. Is payment_id a good metric label?</summary>

No. Unbounded cardinality: one new time series per payment. Put it in logs and trace attributes.
</details>

<details><summary>3. SLO 99.9% over 30 days, and you have had 30 minutes of full outage. How much budget is left?</summary>

About 13 minutes (43.2 − 30), roughly 30% of the budget. Time to slow down risky releases.
</details>

<details><summary>4. Error rate is 1.44% against a 99.9% SLO. Burn rate? Page?</summary>

1.44% / 0.1% = 14.4×. If it holds over the 1-hour window and is still high in the last 5 minutes, page: at this rate the whole month's budget is gone in about 50 hours.
</details>

<details><summary>5. How do you find why p99 doubled after a deploy?</summary>

Split the latency histogram by version label (canary vs stable). Open exemplar traces from the slow buckets, see which span grew, read that span's logs. Check saturation (DB pool waits, event loop lag) on the same pods.
</details>

<details><summary>6. How does a trace continue through Kafka?</summary>

The producer injects `traceparent` into the message headers; the consumer extracts it and starts a child (or linked) span. OpenTelemetry's kafkajs instrumentation does this automatically.
</details>

<details><summary>7. Head or tail sampling for a payment API?</summary>

Tail sampling at the collector: keep 100% of errors and slow traces, a small % of normal ones. Head sampling would throw away most of the rare failures you need.
</details>

## Go deeper

- Case study: [Metrics and monitoring system](../../case-studies/19-metrics-monitoring/README.md) (build the system that stores all this)
- Related: [H27 Resilience](../H27-resilience/README.md) (alert on breaker state and fallback rate), [H21 Kafka](../../4-async/H21-kafka/README.md) (consumer lag)
- Archive notes: [hld-parts/part4.md](../../../archive/notes/hld-parts/part4.md) ("Module 4.2: Monitoring & Alerting": RED and USE, structured logging, distributed tracing, SLI/SLO/SLA), [hld-parts/part3.md](../../../archive/notes/hld-parts/part3.md) ("Distributed Tracing")
- Google *SRE* book ("Monitoring Distributed Systems", "Service Level Objectives"); *SRE Workbook* ("Alerting on SLOs"); OpenTelemetry docs; W3C Trace Context spec
