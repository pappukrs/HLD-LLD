# H14 hands-on · Postgres vs MongoDB

Back to the concept: [../README.md](../README.md)

## What is here

| Folder | What it shows | Backs up README section |
|---|---|---|
| [postgres-vs-mongo/](postgres-vs-mongo/) | The same `users` data written to Postgres (fixed table schema) and to MongoDB (documents through a Mongoose model), from two small Node scripts. | "What relational gives you", "NoSQL is not one thing" |

Files: `docker-compose.yml` (both databases), `postgres.js`, `mongo.js`, and `doc.md` (the original long-form notes on CAP/PACELC with this setup).

## Run it

```bash
cd hld/3-databases/H14-sql-vs-nosql/hands-on/postgres-vs-mongo
npm install
docker compose up -d          # mongo on 27017, postgres on 5432
node mongo.js                 # inserts Alice, reads all users after 2 s (Ctrl+C to exit: the connection is left open)
node postgres.js              # creates the users table, inserts Bob, prints all rows
docker compose down -v        # clean up
```

**Credentials mismatch to know about:** `docker-compose.yml` creates Postgres with user `user`, password `password`, database `testdb`, but `postgres.js` connects as `postgres` / `pappukrs` / `test`. Either change the `Client` config in `postgres.js` to match the compose file, or start a Postgres that matches the script:

```bash
docker run --rm -d --name pg-h14 -e POSTGRES_PASSWORD=pappukrs -e POSTGRES_DB=test -p 5432:5432 postgres:16
```

## What to observe

1. **Schema lives in different places.** Postgres rejects a row that does not fit `users(id, name, age)`. Try `INSERT INTO users (name, age) VALUES ('x', 'not a number')` in `psql`: it fails. In Mongo, `db.users.insertOne({ name: 'x', age: 'not a number', extra: true })` from `mongosh` succeeds. The Mongoose schema only guards writes that go through the app. "Schemaless" means the schema moved into your code.
2. **Run each script twice.** Both append a second row/document. Add `email UNIQUE` to the Postgres table and insert the same email twice: the DB stops you. In Mongo you need to create a unique index yourself.
3. **Joins vs embedding.** Add an `orders` table with `user_id REFERENCES users(id)` and query with a `JOIN`. In Mongo, embed `orders: [...]` inside the user document and read it with one `findOne`. Then rename a product and count how many places you must update in each.
4. **Transactions.** In `psql`: `BEGIN; UPDATE ...; ` then close the session without `COMMIT`. Nothing is applied. This is the crash case from step 6 of the [visual](../visual.html).

## A correction to doc.md

`doc.md` labels MongoDB as "AP" and Postgres as "CP". Treat that as a rough slogan, not a fact. A single Postgres container is not a distributed system, so CAP does not apply to it. MongoDB with a replica set and `writeConcern: majority` / `readConcern: majority` refuses writes on the minority side of a partition, which is CP-like behaviour. Talk about the replication and quorum settings, not the brand. The proper treatment is in [H18 CAP and PACELC](../../H18-cap-pacelc-consistency/README.md).
