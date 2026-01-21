
 **UML-ONLY PRACTICE ASSIGNMENT** designed **exactly for interview preparation**.

👉 No code
👉 Only **entities + relationships + visibility**
👉 Same type of questions asked in **LLD rounds (SDE-1 / SDE-2)**

You can practice by **drawing boxes + arrows on paper/whiteboard**.

---

# 📘 UML PRACTICE ASSIGNMENT (INTERVIEW-FOCUSED)

## 📌 Instructions (Important)

For **every question**:

1. Identify **entities**
2. Decide **relationship type** (IS-A / OWNS / HAS / USES / TEMP)
3. Place **arrow / diamond correctly**
4. Add **+ - # ~** for key fields/methods
5. Be ready to explain **WHY**

---

## 🟢 LEVEL 1 — BASICS (WARM-UP)

### Q1. Person & Employee

* Employee is a type of Person
* Salary should not be accessible directly

👉 Draw UML

---

### Q2. House & Room

* Room cannot exist without House
* Room details should not be modified directly

👉 Draw UML

---

### Q3. Teacher & Student

* Teacher teaches many students
* Students can have many teachers

👉 Draw UML (think association)

---

### Q4. Car & Engine

* Engine is created with Car
* Engine should not be accessed directly

👉 Draw UML

---

## 🟡 LEVEL 2 — COMMON INTERVIEW MODELS

### Q5. Library System

**Entities**

* Library
* Book
* Member

**Rules**

* Library has books
* Member borrows books
* Book exists independently

👉 Draw UML

---

### Q6. Order System

**Entities**

* Order
* OrderItem
* Product

**Rules**

* OrderItem cannot exist without Order
* Product exists independently
* Order controls item creation

👉 Draw UML + visibility

---

### Q7. Bank Account System

**Entities**

* Account
* SavingsAccount
* Transaction

**Rules**

* SavingsAccount is a type of Account
* Transaction belongs to Account
* Balance should be reusable in child class

👉 Draw UML

---

## 🟠 LEVEL 3 — REAL SYSTEMS (VERY IMPORTANT)

### Q8. Wallet System (Fintech)

**Entities**

* User
* Wallet
* Transaction
* PaymentGateway

**Rules**

* Wallet cannot exist without User
* Transaction meaningless without Wallet
* PaymentGateway is external
* Balance should not be public

👉 Draw UML

---

### Q9. Parking Lot System

**Entities**

* ParkingLot
* ParkingFloor
* ParkingSpot
* Vehicle
* Ticket

**Rules**

* Lot owns floors
* Floor owns spots
* Vehicle parks in spot
* Ticket exists only during parking

👉 Draw UML

---

### Q10. ATM System

**Entities**

* ATM
* BankAccount
* Card
* Transaction
* CashDispenser

**Rules**

* ATM uses CashDispenser internally
* Transaction tied to BankAccount
* Card exists independently
* Balance must not be public

👉 Draw UML

---

## 🔴 LEVEL 4 — GRAY / AMBIGUOUS (INTERVIEW TRAPS)

### Q11. User & Address

**Rules**

* User can have multiple addresses
* Address has no usage outside User
* Address should be deleted with User

👉 Decide: Aggregation or Composition
👉 Draw UML

---

### Q12. Playlist & Song

**Rules**

* Song exists globally
* Playlist just groups songs
* Same song in many playlists

👉 Draw UML

---

### Q13. Team & Coach

**Rules**

* Coach can change teams
* Team does not own coach lifecycle

👉 Draw UML

---

### Q14. Chat System

**Entities**

* User
* Chat
* Message
* Attachment
* NotificationService

**Rules**

* Chat owns messages
* Message owns attachment
* NotificationService is external

👉 Draw UML

---

## 🔥 LEVEL 5 — FULL LLD STYLE (TOP COMPANIES)

### Q15. E-Commerce Checkout

**Entities**

* User
* Cart
* CartItem
* Order
* Payment
* Product

**Rules**

* Cart belongs to User
* CartItem meaningless without Cart
* Order created from Cart
* Payment tied to Order
* Product independent

👉 Draw UML

---

### Q16. Ride Booking (Uber-like)

**Entities**

* User
* Driver
* Ride
* Vehicle
* Payment

**Rules**

* Driver is a type of User
* Driver has vehicle
* Ride uses User & Driver
* Payment belongs to Ride

👉 Draw UML

---

### Q17. Expense Sharing App (Splitwise)

**Entities**

* User
* Group
* Expense
* ExpenseSplit
* Settlement

**Rules**

* Group has users
* Expense belongs to Group
* ExpenseSplit meaningless without Expense
* Settlement created temporarily

👉 Draw UML

---

## 🧠 HOW TO SELF-CHECK (VERY IMPORTANT)

After drawing, ask:

```
1. Did I put triangle near parent?
2. Did I put diamond near owner?
3. Did I use ◆ only when lifecycle depends?
4. Did I avoid inheritance unless needed?
5. Did I hide fields using - ?
```

If YES → you’re interview-ready.

---

## 🎯 BONUS CHALLENGE (DO THIS BEFORE INTERVIEW)

Pick **ANY ONE** above and answer:

* Why not inheritance?
* Why not aggregation?
* What DB table enforces this?
* What happens if parent is deleted?
