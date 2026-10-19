# H09 hands-on: cache-aside with Express and Redis

One small app backs up **How it works §2 (cache-aside)** and **§4 (eviction and TTL)** in the [concept README](../README.md).

| Path | What it is |
|---|---|
| [redis-cache/redis-server.js](redis-cache/redis-server.js) | Express on port 4000. `GET /user/:id` checks Redis (`user:<id>`), on a miss calls a fake DB function and stores the result with `SETEX ... 3600` (1 hour TTL). Reconnects to Redis with backoff (`retryStrategy`). |
| [redis-cache/docker-compose.yml](redis-cache/docker-compose.yml) | Redis on `localhost:6379` with a named volume, so data survives a container restart. |

## Run

```bash
cd redis-cache
docker compose up -d          # Redis
npm install                   # express, ioredis, dotenv
node redis-server.js          # http://localhost:4000

curl localhost:4000/user/1    # logs "Cache miss ... fetching from DB"
curl localhost:4000/user/1    # logs "Cache hit"
```

## What to observe

1. **Miss, then hit.** The first call logs `Cache miss`, the second `Cache hit`. Look inside Redis: `docker exec -it redis_container redis-cli GET user:1` and `TTL user:1` (counts down from 3600).
2. **Latency difference.** Add a fake 50 ms delay in `getUserFromDB` (`await new Promise(r => setTimeout(r, 50))`), then compare `curl -w '%{time_total}\n' -o /dev/null -s localhost:4000/user/2` on the first and second call.
3. **Cache down is not app down.** `docker compose stop redis` and call again: ioredis keeps retrying (watch the reconnect logs) and the request errors after the retry budget. Exercise: catch the Redis error and fall back to the DB, which is what cache-aside promises (§2).
4. **Stampede.** With the 50 ms delay, delete the key (`redis-cli DEL user:3`) and fire 50 parallel requests: `seq 50 | xargs -P50 -I{} curl -s localhost:4000/user/3 > /dev/null`. Count the `Fetching data for user 3 from DB` lines: one per request. Exercise: add a single-flight `Map<string, Promise>` (see [demo.ts](../demo.ts)) and run it again: one DB call.
5. **Invalidation.** Add `PUT /user/:id` that updates the fake DB and then runs `redis.del('user:' + id)`, and check the next GET is a miss that loads the new value.

