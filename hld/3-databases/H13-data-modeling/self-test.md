# H13 Data modelling: self-test answers (Day 17, Wed 4 Nov 2026)

Written answers to the README self-test, checked against its `<details>` blocks. Q2 to Q4 and Q6 to Q8 are also checked in code in `practice.ts`.

1. **Name the three anomalies, with one example each.** Update: Asha's email is in 40 rows and the job misses one. Insert: you cannot add a product until someone orders it. Delete: deleting the last order of Bag also deletes Bag's price.
2. **Key is (order_id, product_id). product_name depends on product_id. Which normal form is broken?** 2NF. A non-key column depends on only part of the composite key, so move it to `products`. In `practice.ts`, `seat_id -> seat_row` breaks 2NF in the same way.
3. **What is a transitive dependency? Give one.** A non-key column that depends on another non-key column: `order_id -> cust_id -> email`. Fix it by moving email to `customers`. In `practice.ts`: `booking_id -> show_id -> movie`.
4. **Where does the foreign key go in 1:N, and how do you store M:N?** 1:N: on the many side, with an index (`orders.customer_id`). M:N: a junction table with a composite PK, like `order_items(order_id, product_id)`, or `booking_seats` in `practice.ts`.
5. **Is unit_price on order_items denormalization? Should it update when the product price changes?** No and no. It is the price at purchase, a separate historical fact. Changing it would rewrite past invoices.
6. **When would you embed vs reference in MongoDB?** Embed when the child is always read with the parent, bounded and owned by it (order lines, shipping address). Reference when it is shared, unbounded or updated on its own. In `practice.ts`, 100k comments at 300 B each is 30 MB, over the 16 MB limit.
7. **Why not use email as the primary key of users?** Emails change, and every FK would need updating. They are also longer than 8 bytes and leak PII into URLs and logs. Use a surrogate id with `UNIQUE` on email.
8. **You copied customer_name into orders. How do you keep it correct?** `customers` stays the source of truth. A change event (outbox or CDC) feeds an idempotent consumer that updates the copies, plus a periodic repair job. Accept a few seconds of lag and say so. `practice.ts` tests duplicate, out-of-order and lost events.

## Easy-to-miss points

- Sample rows can disprove a dependency but cannot prove one. In the first 4 rows of `practice.ts`, `movie -> screen` looks true, and row 6 breaks it. Dependencies come from business rules, and `holds()` only checks that the data doesn't contradict them.
- Normalization is not mainly about saving space. On the 6 sample rows, the split went from 54 cells to 55, because keys repeat. The gain is that each fact has one home, so a rename touches 1 row instead of 3. I first wrote a check that claimed fewer cells, and it failed.
- A split must be lossless. Joining the tables must give back exactly the original rows. Splitting on a column that isn't a key invents rows that never existed, and `practice.ts` shows both cases.
- A consumer that keeps copies in sync needs a version check. Without one, a delayed old event overwrites a newer name.
- A ledger is corrected by posting new entries, never by editing old ones. The reversal needs its own unique ref, so repeating it changes nothing.
- The README says a Postgres row's practical limit is "~8 KB per page before TOAST". The page is 8 KB, but as far as I know TOAST normally starts at about 2 KB per row. Check this in the Postgres docs before quoting the number.

## Interview line to practise out loud

"For movie booking my entities are users, shows, seats and bookings. Booking to seat is M:N, so `booking_seats` has the composite key `(booking_id, seat_id)` and holds the price paid, because that depends on both. The movie and screen go on `shows`, and the email goes on `users`, so each fact lives in one place. If an admin list needs names without a join, I copy them through an idempotent CDC consumer with a version check, add a repair job for lost events, and accept a few seconds of lag."
