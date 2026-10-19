# H24 hands-on: CQRS with Kafka and Postgres

One small lab. It backs up the **"CQRS"** section of [../README.md](../README.md): a write API that only emits events, and a read service that builds its own table from them.

| Folder | What it shows |
|---|---|
| [cqrs/](cqrs/) | `commandService.js` (port 4000) takes `POST /order` and publishes an `order-events` message to Kafka. `queryService.js` (port 5000) consumes that topic, inserts into a Postgres `orders` read table, and serves `GET /orders`. The long walkthrough is in [cqrs/doc.md](cqrs/doc.md). |

## Run it

```bash
cd cqrs
docker compose up -d                      # Postgres, Kafka, ZooKeeper
npm install express pg kafka-node         # package.json does not list them
psql -h localhost -U user -d cqrs_db -f initDB.sql   # password: password
node queryService.js                      # terminal 1
node commandService.js                    # terminal 2

curl -X POST http://localhost:4000/order -H "Content-Type: application/json" -d '{"product":"Laptop","quantity":1}'
curl http://localhost:5000/orders
```

If the Kafka container will not start: recent `bitnami/kafka` images run in KRaft mode only, and Bitnami has moved its old images. Pin an older tag that still supports ZooKeeper (for example a 3.x tag), or switch to the `apache/kafka` image in KRaft mode. Then fix the broker address in the compose file.

## What to observe

1. **Two models.** The command service has no database at all. The read table exists only because the consumer built it. Drop the table, recreate it, reset the consumer offset, and the view comes back: a read model is disposable.
2. **Eventual consistency.** Stop `queryService.js`, POST two orders, then `GET /orders`: they are missing. Start it again and they appear. That gap is the read-model lag.
3. **Weak spots to talk about in an interview** (fixes are in the README):
   - The consumer uses `autoCommit: true`, so a crash after the commit and before the insert loses an event (at-most-once). Commit after the insert.
   - `order_id` is `UNIQUE`, so a replayed event throws instead of being skipped. Use `INSERT … ON CONFLICT (order_id) DO NOTHING`, or store the last applied version.
   - `orderId = Date.now()` can collide under load. Use a UUID or a Snowflake id.
   - It reads only `partition: 0`. With more partitions you need a consumer group.
