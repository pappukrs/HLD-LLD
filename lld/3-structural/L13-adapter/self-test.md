# L13 Adapter: self-test answers (Day 17, Wed 4 Nov 2026)

Written answers to the README self-test, checked against its `<details>` blocks. Q1, Q2, Q3, Q5, Q6 and Q7 are also checked in code in `practice.ts`, and Q4 only for the Decorator part.

1. **Gateway A uses rupees as strings, B uses integer paise. Where do you convert?** Inside each adapter. The domain keeps one unit everywhere. In `practice.ts` the domain uses integer metres and seconds, and the adapters convert from km and minutes, and from miles and hours.
2. **Which Node utility is a ready-made adapter for callback APIs?** `util.promisify` (and `util.callbackify` for the other direction). It only handles the async style, though. `practice.ts` shows that it still rejects with the bare number `7`, and needs `.bind(sdk)` or `this` is lost.
3. **The SDK throws `{ code: 'CARD_DECLINED' }`. What should your adapter throw?** My own error type, for example `PaymentDeclinedError('CARD_DECLINED')`, so the service never checks provider codes. In `practice.ts`, an HTTP 404, code `7` and `ZERO_RESULTS` all become `NoRouteError`.
4. **Adapter vs Facade vs Decorator vs Proxy?** Adapter changes the interface to the one the client expects. Facade gives a simpler interface over many classes. Decorator keeps the interface and adds behaviour (`CountingEta` in `practice.ts`). Proxy keeps the interface and controls access (lazy, cache, auth).
5. **Object adapter vs class adapter? Which in TS?** An object adapter holds the adaptee, and a class adapter extends it. Use the object adapter. `practice.ts` shows why: `route()` is callable on the class adapter, so callers can depend on the SDK again.
6. **How do you test three adapters without three copies of the tests?** One shared contract suite run against each adapter with its SDK stubbed (`describe.each` in vitest, a plain loop in `practice.ts`), plus a few integration tests against each provider's sandbox.
7. **A fallback router tries A, then B. Should it fall through on a card decline?** No. A decline is a final business answer, and retrying elsewhere can double-charge. Fall through only on outages or timeouts, and always send an idempotency key. `practice.ts` checks that the second provider is not called on a final answer.

## Easy-to-miss points

- An unknown provider code should map to "unavailable", not to the business error. In `demo.ts`, `GatewayBAdapter` turns every non-zero code into `PaymentDeclinedError`, so a Gateway B outage would look like a decline and the fallback would never run. `PathFinderAdapter` in `practice.ts` treats only code `7` as final.
- Coordinate order is a unit too. GeoJSON style is `[lng, lat]`, and a swap gives a wrong answer with no error. Only a test with a known expected value catches it.
- Mapping can drop useful detail. `GatewayCAdapter` in `demo.ts` throws `CARD_DECLINED` and loses `DO_NOT_HONOR`. Keep the raw reason in logs or in a field on the error.
- In a callback API, a lost `this` can throw inside a timer, where no `try/catch` or promise can catch it, and the whole process crashes.
- During a dual write, a failed write to the new store must not fail the user, but it must be recorded for the backfill.

## Interview line to practise out loud

"The ride service depends on my `EtaProvider` interface, and each maps vendor gets one adapter. It converts coordinates, units, callbacks and error codes into my types, so an HTTP 404, code 7 and a 200 with `ZERO_RESULTS` all become `NoRouteError`. One contract suite runs against every adapter, and a fallback router moves to the next provider only on outages, because 'no route' is a final answer. I used the same idea in my Mongo to MySQL migration: one repository interface, two adapters, and a dual write during the move."
