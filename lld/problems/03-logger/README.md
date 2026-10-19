# 03 · Logger framework

> Asked at: Atlassian, Flipkart, Swiggy, Juspay, Amazon. Often a short round, or the first half of a bigger one.
> Time box: **60 min** (10 min design, 40 min code, 10 min tests and extensions)
> Patterns you should reach for: **Chain of Responsibility** (handlers), **Strategy** (formatters and sinks), **Singleton** (the logger registry)

## Problem statement (as the interviewer says it)

"Design a logging library like log4j or winston. It supports levels DEBUG, INFO, WARN, ERROR and FATAL.
A log line can go to many destinations: console, file, a remote service. Each destination can have its own minimum level and its own format.
The app should get a logger by name from anywhere in the code."

## Step 1: clarify (ask these out loud)

Ask these before writing any code. The assumed answers below are what the tests expect.

| Question | Assumed answer |
|---|---|
| Level order? | `DEBUG < INFO < WARN < ERROR < FATAL` |
| Default logger level? | `INFO` |
| Two filters? | Yes. The logger has a level, and each handler has its own `minLevel`. A record must pass both |
| Does one handler stop the others? | No. Every handler sees every record |
| Formats? | Text: `<ISO time> [LEVEL] name: message` plus ` <context JSON>` if there is context. JSON: one object per line, context under a `context` key |
| A sink throws (disk full, network down)? | The caller never sees the error. The other handlers still run. The error goes to an `onError` hook |
| Same name asked twice? | `LogManager.getLogger(name)` returns the same instance |
| Can the level change at runtime? | Yes, `setLevel` |
| Async/buffered writes, file rotation, log shipping? | Out of scope. Mention them as extensions |

## Step 2: public API (what the tests call)

```ts
const errors = new MemorySink();
const head = new LogHandler({ minLevel: 'INFO', sink: new ConsoleSink() });
head.setNext(new LogHandler({ minLevel: 'ERROR', sink: errors, formatter: new JsonFormatter() }));

const log = new Logger({ name: 'payments', handler: head, level: 'DEBUG', clock: () => Date.now() });
log.info('capture ok', { orderId: 'o1' });
log.error('capture failed');            // goes to both handlers
log.setLevel('WARN');
log.isEnabled('INFO');                  // → false

LogManager.configure({ handler: head, level: 'INFO' });
LogManager.getLogger('orders');         // same instance every time for 'orders'
LogManager.reset();                     // for tests

interface Formatter { format(record: LogRecord): string }
interface Sink { write(line: string, record: LogRecord): void }
```

## Step 3: entities (try them yourself first)

<details>
<summary>Reveal a good entity list</summary>

- `LogRecord`: an immutable value. Level, logger name, message, timestamp, optional context
- `Logger`: the API the app calls. Checks its own level first, builds the record, hands it to the first handler
- `LogHandler`: one link in the chain. Has `minLevel`, a `Formatter` and a `Sink`. Writes if allowed, then calls `next`
- `Formatter` (Strategy): `TextFormatter`, `JsonFormatter`. Later: a masking formatter that hides card numbers
- `Sink` (Strategy): `ConsoleSink`, `MemorySink`. Later: `FileSink`, `HttpSink`
- `LogManager`: a Singleton registry, `Map<name, Logger>`, plus the default config

Why split Formatter and Sink? "How it looks" and "where it goes" change for different reasons (Single Responsibility). You can mix any format with any destination.

Is Chain of Responsibility really needed? A plain `handlers: LogHandler[]` loop does the same job here. Say that out loud. The chain becomes useful when a link may stop the record, change it, or enrich it (for example, add a request id).

</details>

## Step 4: implement

- Write your code in `starter.ts`. Keep the exported names.
- Run `npx vitest run lld/problems/03-logger` until it's green.
- Don't open `reference.ts` until your tests pass, or until you've spent 60 minutes.

## Step 5: extensions interviewers ask after you finish

1. **Logging is slow and blocks requests.** Put a buffer in front of the sink. Flush every N records or every T ms. Decide what happens when the buffer is full: drop DEBUG first, or block. Flush on process exit.
2. **Request id on every line.** In Node, use `AsyncLocalStorage` to hold the request context, and add it to every record in the logger. Do not pass the id through every function.
3. **Mask secrets.** Card numbers, OTPs, tokens. Wrap a formatter (Decorator) or add a chain link that cleans the record before any sink sees it. In fintech this is a compliance rule (PCI DSS), not a nice-to-have.
4. **File rotation.** Rotate by size or by date. The file sink owns this, nothing else changes.
5. **Why is the Singleton a problem in tests?** Global state leaks between tests. That is why `LogManager.reset()` exists. Prefer injecting a `Logger` into classes, and use the registry only at the edges.
6. **Child loggers.** `log.child({ orderId })` returns a logger that adds this context to every record.

## Self-check before you call it done

- [ ] A failing sink cannot crash the app or stop other sinks.
- [ ] Disabled levels return early, before building the record.
- [ ] No `switch (level)` spread across classes. The level order lives in one array.
- [ ] Time is injected (`clock`), so formats are testable.
- [ ] Adding a new destination means writing one `Sink` class, nothing else.

## Concepts used

- [Chain of Responsibility](../../4-behavioral/L25-chain-of-responsibility/README.md) · [Strategy](../../4-behavioral/L20-strategy/README.md) · [Singleton](../../2-creational/L08-singleton/README.md) · [Decorator](../../3-structural/L14-decorator/README.md) · [SOLID](../../1-foundations/L04-solid-srp-ocp/README.md)
- HLD link: [Observability: logs, metrics, traces, SLOs](../../../hld/5-reliability/H30-observability/README.md)
- Visual: [Decorator and Chain of Responsibility](../../3-structural/L14-decorator/visual.html)
