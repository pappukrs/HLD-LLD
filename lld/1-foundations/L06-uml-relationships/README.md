# L06 · UML class diagrams and relationships

> **Time:** ~35 min · **Visual:** [visual.html](visual.html) · **Code:** [demo.ts](demo.ts) (`npx tsx lld/1-foundations/L06-uml-relationships/demo.ts`)
> **Builds on:** [L01 Classes, interfaces and types](../L01-classes-and-interfaces/README.md) · [L02 The four OOP pillars](../L02-oop-pillars/README.md) · [L03 Composition over inheritance](../L03-composition-over-inheritance/README.md) · **Used in:** the design step of every LLD problem; best practice: [01 Parking Lot](../../problems/01-parking-lot/README.md), [12 Library Management](../../problems/12-library-management/README.md), [13 BookMyShow](../../problems/13-bookmyshow/README.md), [24 File System](../../problems/24-file-system/README.md)

## The idea in one line

A class diagram shows the core classes, their important members, and six kinds of links between them; the end of each line (arrow, triangle, diamond) tells the reader how strong the link is and who controls whose lifetime.

## Why it matters (the problem it solves)

Without a diagram you start coding and find out halfway that nobody owns the `Ticket`, or that both `Floor` and `ParkingLot` create `Spot`s. Five minutes of diagram fixes ownership and direction before any code.

A **bad** interview diagram:

```
 ParkingLot <-----> Floor <-----> Spot <-----> Vehicle <-----> Ticket
   (every line a plain two-way arrow; 20 classes; every getter and setter listed)
```

- Every line looks the same, so ownership and lifetime are unclear.
- Two-way arrows everywhere mean two-way coupling (and circular imports in TS).
- So much detail that the interviewer cannot see the design.

A **good** one is 6 to 10 classes, the key members, and the right line for each link:

```
                 ParkingLot ─────────────> «interface» PricingStrategy
                  ◆ 1                                    △
                  │ 1..*                                 ┊ (realizes)
                 Floor                             HourlyPricing
                  ◆ 1
                  │ 1..*
 Ticket ──────> Spot
   │              ◇ 1
   │              │ 0..1
   └──────────> Vehicle
                  △
            ┌─────┴─────┐
           Car         Bike
```

## How it works

### The class box and visibility

```
 ┌──────────────────────────┐
 │        «abstract»        │   <- stereotype (optional): «interface», «abstract», «enum»
 │         Vehicle          │   <- name (italic or «abstract» if abstract)
 ├──────────────────────────┤
 │ - plate: string          │   <- fields: visibility name: type
 │ # size: SpotSize         │
 ├──────────────────────────┤
 │ + fits(s: Spot): boolean │   <- methods: visibility name(params): return
 └──────────────────────────┘
```

| UML | TypeScript | Meaning |
|---|---|---|
| `+` | `public` (default) | anyone |
| `-` | `private` or `#field` | this class only |
| `#` | `protected` | this class and subclasses |
| `~` | not exported from the module | package / module only |

Static members are underlined. Skip getters, setters and constructors in interview diagrams.

### The six relationships

| Link | Read as | Drawn as | Mermaid | Code shape | Lifetime |
|---|---|---|---|---|---|
| Inheritance | IS-A | solid line, hollow triangle at the parent | `Parent <\|-- Child` | `extends` | same object |
| Realization | CAN-DO | dashed line, hollow triangle at the interface | `Iface <\|.. Impl` | `implements` | same object |
| Composition | OWNS-A | filled diamond at the whole | `Whole *-- Part` | whole does `new Part()` inside, never shares it | part dies with whole |
| Aggregation | HAS-A | hollow diamond at the whole | `Whole o-- Part` | part passed in, may be shared | part lives on |
| Association | KNOWS-A | solid line, open arrow | `A --> B` | `A` keeps a `B` in a field | independent |
| Dependency | USES-A (briefly) | dashed line, open arrow | `A ..> B` | `B` is a parameter, local or return type | no stored link |

```ts
class Order {
  private items: OrderItem[] = [];               // composition: Order creates and owns items
  constructor(readonly customer: Customer) {}    // association: Order knows its Customer
  addItem(product: Product, qty: number) {
    this.items.push(new OrderItem(product, qty)); // items die with the order
  }
  pay(gateway: PaymentGateway) {                 // dependency: used only in this call
    return gateway.charge(this.total());
  }
  total() { return this.items.reduce((s, i) => s + i.subtotal(), 0); }
}
class Team {
  constructor(private players: Player[]) {}      // aggregation: players exist without the team
}
class CardPayment implements PaymentGateway {}   // realization
class Car extends Vehicle {}                     // inheritance
```

**Where the marker goes** (the most common slip):

- Triangle: at the **parent / interface**.
- Diamond: at the **whole** (the container). `Floor ◆── Spot`: the diamond touches `Floor`.
- Open arrow: at the class being **known or used**.

### Coupling: weak to strong

```
 dependency  <  association  <  aggregation  <  composition        (has-a / uses-a links)
 inheritance and realization are a different axis: what a class IS
```

Pick the **weakest** link that still models the domain.

### How to decide (ask in this order)

1. Is it a subtype? **Inheritance**, or **realization** for an interface.
2. Does A create B, and does B have no meaning in this system without A? **Composition**.
3. Does A hold B, but B is created elsewhere and can outlive A or be shared? **Aggregation**.
4. Does A keep a reference to B to talk to it? **Association**.
5. Does A only use B inside one method? **Dependency**.

The test is the lifetime **in this system**, not in real life. A wallet "could" exist without a user in the real world, but in a payments app it has no meaning without its user, so `User ◆── Wallet`.

### Multiplicity

Write the count next to the class it counts: `1`, `0..1`, `*` (zero or more), `1..*` (at least one). Read across: "1 `Floor` has 1..* `Spot`s"; "a `Spot` holds 0..1 `Vehicle`".

### How to spot each one in a problem statement

| Words in the statement | Link |
|---|---|
| "is a type of", "kinds of vehicles" | inheritance (or an interface + realization) |
| "consists of", "made of", "has floors which have spots" | composition |
| "members", "players", "can belong to", "is assigned to" | aggregation |
| "each order is placed by a customer", "a ticket is for a spot" | association |
| "uses a payment gateway at checkout", "sends via" | dependency (or association if injected and stored) |
| "supports different pricing / payment / notification types" | realization of a strategy interface |

### Other diagrams (only if asked)

- **Sequence diagram**: the order of calls for one use case (`User → Gate → Lot → Spot`). Useful for a booking or payment flow.
- **State diagram**: states and transitions. Worth drawing for vending machine, elevator, payment status ([L22 State](../../4-behavioral/L22-state/README.md)).
- Use case and activity diagrams: almost never in LLD rounds.

## In TypeScript

The same parking-lot links, as code you would actually write:

```ts
interface PricingStrategy { price(minutes: number): number; }   // realized by HourlyPricing
class HourlyPricing implements PricingStrategy { price(m: number) { return Math.ceil(m / 60) * 40; } }

abstract class Vehicle { constructor(readonly plate: string) {} } // Car, Bike extend it
class Car extends Vehicle {}

class Spot {
  private vehicle?: Vehicle;                       // aggregation: vehicle comes from outside
  park(v: Vehicle) { this.vehicle = v; }
  free() { this.vehicle = undefined; }
}
class Floor { readonly spots = [new Spot(), new Spot()]; }        // composition
class ParkingLot {
  private floors = [new Floor()];                  // composition
  constructor(private pricing: PricingStrategy) {} // association (injected)
  exit(t: Ticket, gateway: PaymentGateway) {}      // dependency (parameter only)
}
class Ticket { constructor(readonly spot: Spot, readonly vehicle: Vehicle) {} } // associations
```

[demo.ts](demo.ts) classifies each pair from code facts, prints the mermaid diagram, and shows composition vs aggregation lifetimes at runtime.

## Trade-offs / when NOT to use it

- **Don't spend a minute on composition vs aggregation.** Both mean "has". State your choice and the lifetime reason, then move on.
- **Don't draw every class.** 6 to 10 core classes. Value objects and DTOs can be listed in a corner.
- **Avoid two-way associations by default.** `Order → Customer` is enough. For "orders of a customer", ask a repository. Two-way links must be kept in sync and cause circular imports.
- **Don't draw sequence, activity or use-case diagrams unless asked.** A state diagram is worth it for state-heavy problems.

## Common mistakes

- Diamond on the wrong end (on the part instead of the whole).
- Using a filled diamond for anything stored in a field. Ask: did this class create it, and is it never shared?
- Drawing an injected service as composition. It was created outside (by the composition root), so it is association (or aggregation).
- Arrows from parent to child for inheritance. The triangle points **at** the parent.
- Listing getters/setters for every field instead of the behaviour that matters.
- Forgetting multiplicities where they matter (floors and spots, seats and shows).

## Say this in the interview

> "The core classes are `ParkingLot`, `Floor`, `Spot`, `Vehicle`, `Ticket` and a `PricingStrategy` interface. The lot owns its floors and each floor owns its spots: composition, because a spot has no meaning outside its floor. A spot holds a vehicle that comes and goes: aggregation. A ticket references a spot and a vehicle: association."

> "Pricing is an interface the lot holds, injected from outside, so a new pricing rule is a new class. The payment gateway is only a parameter of `exit()`, so that is a dependency, the weakest link."

## Your experience hook

- Payment orchestration: `PaymentOrchestrator --> «interface» PaymentProvider`, with Razorpay/Stripe adapters realizing it, and `Payment ◆── PaymentAttempt` (attempts have no meaning without their payment).
- Video SFU: a `Room` owns its `Router` and transports (composition: closing the room closes them), but `Peer`s join and leave (aggregation). Drawing this makes cleanup bugs obvious.
- Prisma / TypeORM: a relation with `onDelete: Cascade` is composition at the database level; a nullable foreign key is closer to aggregation.

## Self-test

<details><summary>1. Library: <code>Library</code>, <code>Book</code>, <code>BookCopy</code>, <code>Member</code>, <code>Loan</code>. Pick the links.</summary><code>Library ◆── BookCopy</code> (copies belong to this library), <code>BookCopy ──> Book</code> (association to the title metadata), <code>Library ◇── Member</code> or association (members exist on their own), <code>Loan ──> Member</code> and <code>Loan ──> BookCopy</code> with dates.</details>

<details><summary>2. <code>NotificationService.send(msg, channel: Channel)</code>. What is the link to <code>Channel</code>?</summary>Dependency (<code>..&gt;</code>), because it is only a parameter. If the service kept a <code>Map&lt;ChannelType, Channel&gt;</code> field, it would be an association (or aggregation).</details>

<details><summary>3. Where does the diamond go in <code>Folder</code> / <code>File</code>?</summary>On <code>Folder</code>, the whole. The diamond always touches the owner.</details>

<details><summary>4. Composition vs aggregation: how can an interviewer see the difference in code?</summary>Composition: the whole creates the part (<code>new Spot()</code> inside <code>Floor</code>) and never hands it out; removing the whole removes the parts. Aggregation: the part is passed in (<code>new Team(players)</code>) and may belong elsewhere or outlive the whole.</details>

<details><summary>5. A service gets a repository through its constructor. Which link?</summary>Association (to the repository interface). It is stored in a field, but created outside, so not composition.</details>

<details><summary>6. What does <code>0..1</code> next to <code>Vehicle</code> on the <code>Spot</code> link mean?</summary>A spot holds zero or one vehicle at a time.</details>

<details><summary>7. Why avoid two-way associations?</summary>Both sides must be kept in sync, coupling doubles, and in TypeScript it often causes circular imports. Use one direction and a repository query for the other.</details>

## Go deeper

- Next: [L07 · DRY, KISS, YAGNI, coupling, cohesion, Law of Demeter](../L07-design-principles/README.md)
- Tree-shaped composition: [L17 · Composite](../../3-structural/L17-composite/README.md)
- State diagrams: [L22 · State](../../4-behavioral/L22-state/README.md)
- Long notes: [archive/notes/UML/uml.md](../../../archive/notes/UML/uml.md) and practice questions in [archive/notes/UML/practice](../../../archive/notes/UML/practice)
- Book: UML Distilled (Martin Fowler), chapters 3 and 5
