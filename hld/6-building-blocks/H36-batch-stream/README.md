# H36 · Batch and stream processing

> **Time:** ~50 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx hld/6-building-blocks/H36-batch-stream/demo.ts`)
> **Builds on:** [H21 Kafka](../../4-async/H21-kafka/README.md) · [H22 Delivery semantics](../../4-async/H22-delivery-semantics/README.md) · [H24 Event-driven and CQRS](../../4-async/H24-event-driven-cqrs/README.md) · [H16 Partitioning](../../3-databases/H16-partitioning-sharding/README.md) · **Used in:** Ad click aggregation, Metrics and monitoring, Leaderboard, Payment system (reconciliation), Live comments

## The idea in one line

**Batch** runs over a bounded dataset (yesterday's files) for complete, exact answers in hours; **stream** runs over an unbounded flow of events with windows, watermarks and state for answers in seconds. Most real systems use both: stream for dashboards and alerts, batch for numbers that touch money.

## Why it matters (the problem it solves)

- "Clicks per ad per minute": dashboards need it in seconds, invoices need it exact.
- "Card used in 5 cities in 10 minutes": must be flagged while the payment is in flight, not tomorrow.
- "Daily settlement report": must cover every transaction of the day, exactly once, and be rerunnable.

Running these as SQL on the production OLTP database every minute steals its CPU and IO, gets slower as data grows, and row stores are bad at scanning billions of rows. You move events **out** (Kafka, CDC) and process them in systems built for it.

## How it works

### Batch: bounded input, complete output

```
S3 / HDFS files (dt=2026-10-18/)          Spark job (DAG of stages)
  part-0.parquet --map--> (ad1,1) (ad2,1)  \
  part-1.parquet --map--> (ad1,1) (ad1,1)   >-- shuffle by key --> reduce: ad1=3, ad2=1
  part-2.parquet --map--> (ad2,1)          /                      -> write dt=2026-10-18/ (overwrite)
```

- **MapReduce model**: map (emit key/value), **shuffle** (move all values of a key to one machine: the expensive network step), reduce (aggregate). **Spark** runs the same idea in memory as a DAG of stages, often 10x faster than classic Hadoop MapReduce.
- Orchestrated by **Airflow** (or Dagster, Step Functions): scheduled DAGs with retries, dependencies and backfills.
- **Rerun-safe by design**: write output to a partition (`dt=2026-10-18/`) and overwrite it. A rerun replaces the result instead of adding to it. Batch jobs are idempotent for free.
- Inputs never change, so batch gives **complete, exact** answers. The cost is latency: hours.

### Stream: unbounded input, results in seconds

```
services --events--> Kafka (key = ad_id) --> Flink job (keyed state, windows, watermarks)
                                     |           |-- upsert --> ClickHouse / Druid / Pinot (dashboards)
                                     |           |-- alerts --> fraud / alert service
                                     |           '-- late events --> side output
                                     '-- raw archive --> S3 Parquet --> nightly Spark --> warehouse (exact)
```

#### Event time vs processing time

- **Event time**: when it happened (a timestamp inside the event).
- **Processing time**: when the job sees it.
- A phone offline for 10 minutes sends old events late; a Kafka partition can lag. Events arrive **out of order**. If you count by processing time, a click at 10:00:58 that arrives at 10:01:20 lands in the wrong minute. Aggregate by **event time** for correct results.

#### Windows

| Window | Shape | Example |
|---|---|---|
| Tumbling | Fixed size, no overlap | Clicks per ad per 1 minute |
| Sliding / hopping | Fixed size, overlapping | Transactions in the last 10 min, updated every 1 min |
| Session | Closes after a gap of inactivity | User session ends after 30 min idle |
| Global + trigger | One window, fire on count or time | Every 1,000 events |

```
event time  10:00          10:01          10:02          10:03
tumbling    [----- W1 -----)[----- W2 -----)[----- W3 -----)
hopping     [------ 10 min, slide 1 min ------)
              [------ 10 min ------)
session     [ * * *  *]  <gap 30m>  [* *   *]
```

#### Watermarks and late data

A **watermark** is the job's claim: "I do not expect any more events older than T." A common rule: `watermark = max event time seen - allowed out-of-orderness` (for example 30 s).

```
arrivals (event time):  0:05  0:20  0:41  1:10  0:58  1:35  0:40  2:10  2:35
max event time:         0:05  0:20  0:41  1:10  1:10  1:35  1:35  2:10  2:35
watermark (-30 s):      -     -     0:11  0:40  0:40  1:05  1:05  1:40  2:05
                                                        ^ W1 [0:00,1:00) fires: count 4
                                                              ^ 0:40 arrives after W1 closed: LATE
                                                                          ^ W2 fires: count 2
```

- When the watermark passes a window's end, the window **fires** (emits its result).
- Events older than the watermark are **late**. Options: drop them, send to a **side output** for later repair, or keep the window open a bit longer (**allowed lateness**) and emit an updated result.
- The trade-off: a bigger delay catches more stragglers but results come later. A smaller delay is fresher but drops more.

#### State and checkpoints

- Windows, counters and joins are **state**, kept per key next to the task (Flink uses RocksDB on local disk).
- Flink takes periodic **checkpoints**: a barrier flows through the job graph, and each task snapshots its state together with the **Kafka offsets** to S3.
- After a crash it restores state + offsets from the last checkpoint and **replays** events after it. State is exactly-once.
- But results emitted after the checkpoint get emitted **again**. For end-to-end exactly-once the **sink must be idempotent** (upsert by `(ad_id, window_start)`) or **transactional** (Kafka transactions, two-phase commit sinks). See [H22](../../4-async/H22-delivery-semantics/README.md).

#### Skew (hot keys)

A viral ad with 50% of clicks sends all its events to one task, which lags. Fix: **two-stage aggregation** with salted keys (`ad_id#0..#9`), pre-aggregate in parallel, then merge the 10 partial counts. More in [H37](../H37-data-at-scale/README.md).

### Lambda vs Kappa

| | Lambda | Kappa |
|---|---|---|
| Layout | Batch layer (exact) + speed layer (fast), merged at serving | One stream pipeline; reprocess by replaying the log |
| Pro | Batch fixes stream mistakes | One codebase |
| Con | Same logic written twice | Needs long log retention and a replay-capable engine; replays of months are slow |

Common practice today: streaming for real-time views, plus a nightly **batch reconciliation** job for anything that touches money (billing, payouts, settlements).

### Where the results go

- **OLTP** (Postgres, MySQL): row store, many small transactions. Not for big scans.
- **OLAP** (ClickHouse, Druid, Pinot, BigQuery, Snowflake): **columnar**, compressed, scans billions of rows per second. Reading 3 columns of 50 reads only those 3.
- **Data lake**: Parquet/ORC files in S3 with a table format (**Iceberg**, Delta Lake, Hudi) for schema evolution, partitions and ACID-like updates.
- **ETL vs ELT**: transform then load (ETL), or load raw then transform in the warehouse with SQL/dbt (ELT, more common now).

## In TypeScript

```ts
type Click = { adId: string; eventTime: number; id: string };

class TumblingCounter {
  private windows = new Map<number, Map<string, number>>(); // windowStart -> adId -> count
  private maxEventTime = 0;
  constructor(private sizeMs: number, private delayMs: number, private sink: Sink) {}

  onEvent(e: Click) {
    const start = Math.floor(e.eventTime / this.sizeMs) * this.sizeMs;
    if (start + this.sizeMs <= this.watermark()) return this.sink.late(e);   // window already fired
    const w = this.windows.get(start) ?? new Map<string, number>();
    w.set(e.adId, (w.get(e.adId) ?? 0) + 1);
    this.windows.set(start, w);
    this.maxEventTime = Math.max(this.maxEventTime, e.eventTime);
    for (const [s, counts] of this.windows) {
      if (s + this.sizeMs <= this.watermark()) {                             // watermark passed the end
        for (const [ad, n] of counts) this.sink.upsert(`${ad}|${s}`, n);     // idempotent: overwrite
        this.windows.delete(s);
      }
    }
  }
  private watermark() { return this.maxEventTime - this.delayMs; }
}
```

[demo.ts](demo.ts) runs this on out-of-order clicks, shows a late event going to the side output, crashes and replays from a checkpoint (the upsert sink stays correct, an increment sink double counts), and then runs a map-shuffle-reduce batch job to reconcile.

## Trade-offs / when NOT to use it

| Option | Use when | Weakness |
|---|---|---|
| Batch (Spark + Airflow) | Daily reports, ML training, reconciliation, backfills | Hours of delay |
| Micro-batch (Spark Structured Streaming) | Seconds to a minute is fine; team knows Spark | Latency floor; not per event |
| Stream (Flink, Kafka Streams) | Seconds or less, event-time windows, fraud, alerts | State, watermarks and upgrades are hard to operate |
| Plain Node consumer + Redis | Simple counters, per-event work | You rebuild windows, state and recovery yourself |
| Lambda | Money numbers need batch correctness | Two pipelines to keep in sync |
| Kappa | One logic path, log is replayable | Long replays are slow and costly |

Do not build a Flink cluster for "send an email when an order is placed". That is a plain queue consumer. Streaming engines pay off when you need **windows, joins or large keyed state**.

## Common mistakes

- Windowing by processing time. Counts shift whenever consumers lag or devices reconnect.
- Saying "Flink is exactly-once, so the sink is fine". Replays re-emit results; the sink must upsert or be transactional.
- No plan for late data. Say what happens: side output, allowed lateness, or batch fix-up.
- Using streaming numbers for invoices with no batch reconciliation.
- Ignoring hot keys: one viral key makes one task lag and holds back the watermark for everyone.
- Batch jobs that append instead of overwrite a partition, so a retry doubles the numbers.
- Running analytics SQL on the primary OLTP database.

## Say this in the interview

> "Click events go to Kafka keyed by ad id. A Flink job counts clicks in 1-minute tumbling windows by event time, with a watermark 30 seconds behind the max event time. Late events go to a side output. Results are upserted into ClickHouse keyed by ad id and window start, so a replay after a crash overwrites instead of double counting."

> "Raw events also land in S3 as Parquet. A nightly Spark job recomputes exact counts from the raw data, including late events, and those numbers are what we bill on. If stream and batch differ by more than, say, 0.1%, we alert. That is a Lambda-style setup, and I keep it because the numbers touch money."

## Your experience hook

- IoT platform (Matriot, 10k+ devices): you put a Redis queue and batch writes in front of the DB to absorb high-frequency telemetry. That is micro-batching. At 10x you would move to Kafka plus a stream job with per-device windows (for example 1-minute averages) and a time-series DB.
- Duplicate MQTT processing you eliminated is the same problem as stream replays: make processing idempotent by message id, or the sink double counts.
- Payment work: success-rate dashboards are a stream job; settlement and reconciliation against PSP files is a nightly batch job (see [H38](../H38-payments-domain/README.md)).

## Numbers to remember

| Fact | Value |
|---|---|
| Kafka -> Flink -> OLAP freshness | a few seconds end to end |
| Checkpoint interval | commonly 10 s to a few minutes |
| Typical watermark delay | seconds to a few minutes, from measured lateness |
| Columnar compression on event data | often 5 to 10x smaller than row storage |
| Estimate | 10B events/day x 200 B = 2 TB/day raw, ~200 to 400 GB/day as Parquet |
| Average rate | 10B/day ≈ 115k events/s, peak 2 to 3x |

## Self-test

<details><summary>1. A click happened at 10:00:58 but arrived at 10:01:20. Which 1-minute window counts it?</summary>

The 10:00 to 10:01 window (event time), as long as it arrives before the watermark passes 10:01 (or within allowed lateness). Otherwise it is late data.
</details>

<details><summary>2. Tumbling or sliding window for "transactions in the last 10 minutes, updated every minute"?</summary>

Sliding (hopping): size 10 minutes, slide 1 minute. Each event belongs to 10 windows.
</details>

<details><summary>3. Flink has exactly-once checkpoints. Why can the sink still get duplicates?</summary>

After a failure Flink replays from the last checkpoint and re-emits results it already wrote after that checkpoint. A non-idempotent sink (increment, append) counts them twice. Use upserts by key or a transactional sink.
</details>

<details><summary>4. What does the watermark delay trade off?</summary>

Completeness vs latency. A larger delay waits for more stragglers, so fewer late events, but results appear later. A smaller delay gives fresher results but more late data.
</details>

<details><summary>5. Why is a Spark batch job easy to make idempotent?</summary>

Its input is fixed, and it writes a whole output partition (`dt=...`) with overwrite. Running it twice gives the same result in the same place.
</details>

<details><summary>6. One ad gets 50% of events. What breaks and how do you fix it?</summary>

One task gets half the load and lags, which also holds back the watermark. Salt the key (`ad#0..#9`), pre-aggregate in parallel, then merge partial counts in a second stage.
</details>

<details><summary>7. Lambda or Kappa for ad billing?</summary>

Lambda-style: a stream for live dashboards plus a batch recompute from raw events for billing, because invoices must be exact and must include late data. Kappa is fine for views where a replay can fix mistakes.
</details>

## Go deeper

- Case studies: [Ad click aggregation](../../case-studies/20-ad-click-aggregation/README.md) · [Metrics and monitoring](../../case-studies/19-metrics-monitoring/README.md) · [Leaderboard](../../case-studies/21-leaderboard/README.md) · [Payment system](../../case-studies/08-payment-system/README.md)
- Related: [H35 Count-Min sketch](../H35-probabilistic-ds/README.md) for streaming top-k · [H37 Hot keys and counters](../H37-data-at-scale/README.md)
- Archive notes: [hld-parts/part6a.md](../../../archive/notes/hld-parts/part6a.md) (ETL vs ELT, batch vs stream, pipeline architectures) · [hld-parts/part6b.md](../../../archive/notes/hld-parts/part6b.md) (windowing)
- DDIA chapters 10 and 11; Tyler Akidau, "Streaming 101" and "Streaming 102"; the Google Dataflow model paper (VLDB 2015)
