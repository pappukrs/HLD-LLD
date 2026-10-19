# H20 hands-on: RabbitMQ and Kafka with Node.js

Back to the concept: [../README.md](../README.md)

| Folder | What it shows | Backs up README section |
|---|---|---|
| [kafka-rabbitmq/](kafka-rabbitmq/doc.md) | One "order created" event sent through RabbitMQ (a queue, deleted after consume) and through Kafka (a log, kept after consume) | "The broker landscape", "Acknowledgements" |

Files: `docker-compose.yml` (Kafka + ZooKeeper + RabbitMQ with the management UI), `rabbitProducer.js` / `rabbitConsumer.js`, `kafkaProducer.js` / `kafkaConsumer.js`, and `doc.md` (the original walkthrough).

## Run it

```bash
cd hld/4-async/H20-message-queues/hands-on/kafka-rabbitmq
npm install
docker compose up -d                     # RabbitMQ UI: http://localhost:15672 (guest / guest)

# RabbitMQ: queue semantics
node rabbitConsumer.js                   # terminal 1: waits on orderQueue
node rabbitProducer.js                   # terminal 2: sends { orderId: 456 }

# Kafka: log semantics
node kafkaConsumer.js                    # terminal 1: reads topic order-events, partition 0
node kafkaProducer.js                    # terminal 2: sends { orderId: 123 }

docker compose down
```

Notes: the compose file uses old `bitnami/*` images and ZooKeeper. If they fail to pull or Kafka refuses connections, swap in `apache/kafka:3.8.0` (KRaft mode, no ZooKeeper) and set `KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092`. `kafka-node` is an old client; `kafkajs` is the usual choice today.

## What to observe

1. **Queue deletes, log keeps.** Stop the RabbitMQ consumer, send 3 messages, look at `orderQueue` in the UI (3 ready). Start the consumer: they drain and the queue is empty. Now restart the Kafka consumer with a new group and `fromOffset: 'earliest'`: old events are read again. That is replay.
2. **Auto-ack loses work.** `rabbitConsumer.js` uses `noAck: true` (at-most-once). Change it to manual ack (`channel.ack(msg)` after the work, `noAck: false`), kill the consumer mid-way, restart: the unacked message is redelivered. That is at-least-once.
3. **Competing consumers.** Run two `rabbitConsumer.js` processes and send 10 messages: they are split between the two (round-robin). Set `channel.prefetch(1)` to make a slow worker get fewer.
4. **Durability.** The queue is declared `durable: false`. Restart the RabbitMQ container: the queue and its messages are gone. Use `durable: true` plus `persistent: true` on publish for real workloads.
5. **Fan-out.** Replace `sendToQueue` with a `fanout` exchange bound to two queues: both get every message (pub-sub), unlike step 3.
