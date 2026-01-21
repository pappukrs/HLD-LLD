

# 📘 UML & LLD REVISION DOCUMENT

### *(From Basics → Advanced, One Read)*

---

## 1️⃣ What is UML (in interviews)?

> **UML is a language to explain your code design without writing code.**

Interviewers check:

* Can you **model relationships**
* Can you **control access (`+ - # ~`)**
* Can you **justify lifecycle & ownership**

They are NOT checking artistic diagrams.

---

## 2️⃣ UML VISIBILITY SYMBOLS (VERY IMPORTANT)

### 🔐 Access Modifiers

| Symbol | Meaning   | Who can access      |
| ------ | --------- | ------------------- |
| `+`    | Public    | Anyone              |
| `-`    | Private   | Same class only     |
| `#`    | Protected | Class + subclasses  |
| `~`    | Package   | Same package/module |

### 🧠 Memory Trick

> **Public Shows, Private Hides, Protected Shares, Package Neighbors**

---

### Example

```
Account
----------------
# balance: number
+ deposit(amount)
- validate()
```

---

## 3️⃣ THE 5 UML RELATIONSHIPS (CORE OF LLD)

You must know **name + meaning + arrow/diamond placement**.

---

## 3.1️⃣ Inheritance (IS-A)

### Meaning

> One class **is a type of** another class

### Example

* SavingsAccount **is a** Account
* Dog **is an** Animal

### UML Rule

```
Child ───▷ Parent
```

🔺 Hollow triangle
🔺 Arrow is **ALWAYS near parent**

### Memory Trick

> **Arrow points to what it wants to become**

---

## 3.2️⃣ Association (USES / KNOWS-A)

### Meaning

> One class **interacts with** another

### Example

* Order uses Product
* Teacher teaches Student

### UML

```
A ───── B
```

✔ No ownership
✔ No lifecycle dependency

---

## 3.3️⃣ Aggregation (HAS-A – weak)

### Meaning

> A **has** B, but B can live without A

### Example

* Team has Players
* Library has Books

### UML Rule

```
Whole ◇──── Part
```

🔹 **Hollow diamond**
🔹 Diamond ALWAYS near **Whole**

### Memory Trick

> **If whole dies, part survives → Aggregation**

---

## 3.4️⃣ Composition (OWNS-A – strong)

### Meaning

> A **owns** B completely

### Example

* Order owns OrderItem
* House owns Room

### UML Rule

```
Owner ◆──── Part
```

🔹 **Filled diamond**
🔹 Diamond ALWAYS near **Owner**

### Memory Trick

> **If owner dies, part dies → Composition**

---

## 3.5️⃣ Dependency (USES temporarily)

### Meaning

> One class **uses another only inside a method**

### Example

* PaymentService uses PaymentGateway

### UML

```
A - - - - > B
```

✔ No field
✔ No ownership
✔ External system usually

---

## 4️⃣ MOST IMPORTANT RULE (NEVER FORGET THIS)

> **UML is about SYSTEM LIFECYCLE, not real-world existence**

❌ Wrong thinking:

> “In real life it can exist somewhere else”

✅ Correct thinking:

> **“Does it have meaning in THIS system without the other?”**

---

## 5️⃣ DIAMOND PLACEMENT (THE BIG CONFUSION SOLVER)

### ONE RULE ONLY 👇

> **Diamond is ALWAYS placed near the OWNER / WHOLE**

| Question                  | Answer      |
| ------------------------- | ----------- |
| If A deleted, B dies?     | Composition |
| If A deleted, B survives? | Aggregation |
| Diamond near              | A           |

---

## 6️⃣ QUICK DECISION FLOW (INTERVIEW GOLD)

Ask these **in order**:

1. IS-A? → Inheritance
2. OWNS & controls lifecycle? → Composition
3. HAS but no lifecycle control? → Aggregation
4. Just interaction? → Association
5. Temporary usage? → Dependency

---

## 7️⃣ UML → CODE VISIBILITY MAPPING (JS / Java)

| UML | Java      | JavaScript            |
| --- | --------- | --------------------- |
| `+` | public    | public method         |
| `-` | private   | `#field`              |
| `#` | protected | `_field` (convention) |
| `~` | package   | module-private        |

---

## 8️⃣ SAMPLE PROBLEMS (WITH FINAL ANSWERS)

---

### 🧩 Example 1: Order System (CLASSIC)

**Entities**

* Order
* OrderItem
* Product

**Reasoning**

* Order owns OrderItem → Composition
* Product exists independently → Association

**UML**

```
Order ◆──── OrderItem
Order ───── Product
```

---

### 🧩 Example 2: Wallet System (FINTECH)

**Entities**

* User
* Wallet
* Transaction

**Reasoning**

* Wallet cannot exist without User
* Transaction meaningless without Wallet

**UML**

```
User ◆──── Wallet
Wallet ◆──── Transaction
```

---

### 🧩 Example 3: Team Management

**Entities**

* Team
* Player

**Reasoning**

* Player can change teams
* Team doesn’t own lifecycle

**UML**

```
Team ◇──── Player
```

---

### 🧩 Example 4: Inheritance + Protected

**Entities**

* Account
* SavingsAccount

**UML**

```
SavingsAccount ───▷ Account

Account
----------------
# balance
+ deposit()
```

---

## 9️⃣ UML → DATABASE PROOF (SENIOR MOVE)

### Composition

```
child_table
- parent_id (FK, NOT NULL, ON DELETE CASCADE)
```

### Aggregation

```
child_table
- parent_id (FK, nullable or no cascade)
```

### Association

```
join_table / FK without ownership
```

Interviewers LOVE when you mention this.

---

## 🔟 ONE-PAGE MEMORY SNAPSHOT

```
Inheritance  → IS-A      → Arrow near Parent
Composition  → OWNS-A    → ◆ near Owner
Aggregation  → HAS-A     → ◇ near Whole
Association  → USES-A    → simple line
Dependency   → TEMP USE  → dashed arrow
```

---

## 🎯 FINAL INTERVIEW SENTENCE (USE THIS)

> “I decide UML relationships based on object lifecycle within the system boundary, enforce ownership using composition, and control access using visibility modifiers.”

If you say this confidently → **interviewer is satisfied**.

---




