# **🚀 Day 4: Partitioning - Handling Large Datasets**  

## **📌 What is Partitioning?**  
Partitioning **divides a large table into smaller pieces** for better **performance, scalability, and maintainability**. Instead of scanning the entire table, queries can target **specific partitions**, reducing execution time! 🚀  

---

## **🔍 Why Use Partitioning?**  
✅ **Faster Queries** → Queries only scan relevant partitions.  
✅ **Efficient Storage** → Older data can be stored on cheaper storage.  
✅ **Improved Indexing** → Indexes stay small & efficient.  
✅ **Better Load Management** → Inserts & deletes run faster.  

---

## **🛠️ Types of Partitioning**  

### **1️⃣ Range Partitioning (Most Common)**
- Divides data into **ranges** based on values (e.g., **date, price, age**).  
- Best for **time-series data** like logs, transactions, and sales records.  

📌 **Example: Partitioning Sales Data by Year (PostgreSQL)**  
```sql
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    sale_date DATE NOT NULL,
    amount NUMERIC
) PARTITION BY RANGE (sale_date);
```
🔹 Now, we create **yearly partitions**:  
```sql
CREATE TABLE sales_2023 PARTITION OF sales FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');
CREATE TABLE sales_2024 PARTITION OF sales FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```
✅ When querying 2023 sales, **PostgreSQL only scans `sales_2023`** → Faster performance!  

---

### **2️⃣ Hash Partitioning**
- Spreads data **evenly** across partitions using a **hash function**.  
- Ideal for **distributing large datasets across multiple servers**.  

📌 **Example: Partitioning User Data by `id` (PostgreSQL)**  
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT
) PARTITION BY HASH (id);
```
🔹 Now, we create **4 partitions for even distribution**:  
```sql
CREATE TABLE users_p0 PARTITION OF users FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE users_p1 PARTITION OF users FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE users_p2 PARTITION OF users FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE users_p3 PARTITION OF users FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```
✅ This ensures **even data distribution**, preventing bottlenecks! 🚀  

---

### **3️⃣ List Partitioning**
- Divides data into **predefined categories**.  
- Best for **categorical data** (e.g., countries, regions, product types).  

📌 **Example: Partitioning Employees by Department**  
```sql
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    name TEXT,
    department TEXT
) PARTITION BY LIST (department);
```
🔹 Now, we create **separate partitions**:  
```sql
CREATE TABLE employees_hr PARTITION OF employees FOR VALUES IN ('HR');
CREATE TABLE employees_sales PARTITION OF employees FOR VALUES IN ('Sales');
CREATE TABLE employees_it PARTITION OF employees FOR VALUES IN ('IT');
```
✅ Queries like `WHERE department = 'HR'` will only scan the `employees_hr` table → Faster! ⚡  

---

### **4️⃣ Composite Partitioning (Hybrid Approach)**
- Combines **two or more partitioning types**.  
- Example: **Range + Hash** for **date-based partitioning and even distribution**.  

📌 **Example: Partitioning Orders by Year & Distributing by User ID**  
```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INT,
    total_price NUMERIC,
    created_at DATE
) PARTITION BY RANGE (created_at);
```
🔹 Create **yearly partitions**, then **sub-partition by user ID**:  
```sql
CREATE TABLE orders_2023 PARTITION OF orders FOR VALUES FROM ('2023-01-01') TO ('2024-01-01')
PARTITION BY HASH (user_id);

CREATE TABLE orders_2023_p0 PARTITION OF orders_2023 FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE orders_2023_p1 PARTITION OF orders_2023 FOR VALUES WITH (MODULUS 4, REMAINDER 1);
```
✅ Helps with **both query optimization & load balancing**! 🚀  

---

## **🔥 Partitioning in NoSQL (MongoDB)**  

MongoDB doesn’t have **built-in table partitioning** like PostgreSQL, but we can use **Sharding** for similar benefits.  

### **1️⃣ Range-Based Partitioning in MongoDB**  
✅ **Sharding** divides data into **shards (partitions)** based on a key.  

📌 **Example: Sharding Sales Data by Year**  
```javascript
sh.enableSharding("ecommerceDB");  // Enable sharding on database
sh.shardCollection("ecommerceDB.sales", { sale_date: 1 });  // Shard by date
```
🔹 MongoDB automatically places **older data in separate shards**, optimizing queries! 🚀  

---

### **2️⃣ Hash-Based Partitioning in MongoDB**  
✅ Distributes **user data evenly** across multiple servers.  

📌 **Example: Sharding Users by ID (Even Distribution)**  
```javascript
sh.enableSharding("appDB");
sh.shardCollection("appDB.users", { user_id: "hashed" });
```
🔹 **Spreads user records evenly** across shards → Prevents single-server overload! ⚡  

---

## **📊 SQL vs NoSQL Partitioning (Side-by-Side)**
| Feature            | SQL (PostgreSQL, MySQL)  | NoSQL (MongoDB, Firebase)  |
|--------------------|------------------------|----------------------------|
| **Partitioning Type** | Range, Hash, List, Composite | Sharding (Range, Hash) |
| **Default Approach** | Manual Partitioning | Auto-Sharding |
| **Best for**       | Structured Data, Complex Queries | Large-Scale Distributed Systems |
| **Joins**          | ✅ (Good with Indexing) | ❌ (Joins are costly) |
| **Scaling**        | ✅ (Vertical Scaling)   | ✅ (Horizontal Scaling) |

---

## **🎯 Key Takeaways**
✅ **Partitioning makes queries faster** by reducing search space.  
✅ **Range Partitioning** → Best for **time-series data** like logs, sales.  
✅ **Hash Partitioning** → Evenly distributes **load across servers**.  
✅ **List Partitioning** → Great for **categorical data** (e.g., product categories).  
✅ **Composite Partitioning** → **Combines multiple strategies** for better performance.  
✅ **MongoDB Sharding** → Works like partitioning for **huge NoSQL databases**.  

---




### **🚀 Hands-on Coding Challenge: Implementing Partitioning**

#### **Challenge 1: PostgreSQL - Partition a `sales` Table by Year**
🔹 **Objective:** Create a **range partitioned table** where sales data is divided **year-wise**.  

#### **Steps:**  
1️⃣ Create a **partitioned table** using `RANGE (sale_date)`.  
2️⃣ Create **yearly partitions** for `2023` and `2024`.  
3️⃣ Insert sample data and test partitioning.  

#### **Solution:**
```sql
-- Step 1: Create a partitioned table
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    sale_date DATE NOT NULL,
    amount NUMERIC
) PARTITION BY RANGE (sale_date);

-- Step 2: Create partitions for each year
CREATE TABLE sales_2023 PARTITION OF sales FOR VALUES FROM ('2023-01-01') TO ('2024-01-01');
CREATE TABLE sales_2024 PARTITION OF sales FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Step 3: Insert sample data
INSERT INTO sales (sale_date, amount) VALUES 
('2023-05-10', 1000), 
('2024-06-15', 1500);

-- Step 4: Check where data is stored
SELECT tableoid::regclass, * FROM sales;
```
🔍 **Expected Output:**  
- `2023-05-10` entry goes to `sales_2023`.  
- `2024-06-15` entry goes to `sales_2024`.  

---

#### **Challenge 2: MongoDB - Implement Range-Based Sharding**
🔹 **Objective:** Enable **sharding** in MongoDB and partition sales data by year.  

#### **Steps:**  
1️⃣ Enable sharding for `ecommerceDB`.  
2️⃣ Shard the `sales` collection by `sale_date`.  
3️⃣ Insert sample sales records and verify partitioning.  

#### **Solution:**
```javascript
// Step 1: Enable sharding on the database
sh.enableSharding("ecommerceDB");

// Step 2: Shard sales collection by sale_date
sh.shardCollection("ecommerceDB.sales", { sale_date: 1 });

// Step 3: Insert sample data
db.sales.insertMany([
    { sale_date: new Date("2023-05-10"), amount: 1000 },
    { sale_date: new Date("2024-06-15"), amount: 1500 }
]);

// Step 4: Verify which shard holds the data
sh.status();
```
🔍 **Expected Output:**  
- MongoDB automatically places sales data into different shards based on `sale_date`.  

---

### **💡 Bonus Task (Advanced)**
✅ Implement **Hash Partitioning** in PostgreSQL for user data.  
✅ Partition `users` by `id` using **MODULUS 4**.  

Would you like a **detailed breakdown of hash partitioning** or any improvements to these challenges? 🚀




### **🔍 Understanding Hash Partitioning in PostgreSQL (Step-by-Step)**
Hash partitioning is used when **range-based partitioning** doesn’t work well, such as when values are **evenly distributed** across partitions. Instead of storing data based on ranges (e.g., year, date), **a hash function is applied** to a column, and records are stored based on the **hash result**.  

✅ **Best Use Cases:**  
- Large datasets with **uniformly distributed keys** (e.g., `user_id`, `order_id`).  
- When **querying specific keys** rather than range-based lookups.  
- Works best for **high concurrency** workloads.  

---

### **📌 Step-by-Step Guide to Implementing Hash Partitioning**
We will partition a **users** table using **hash partitioning** by `user_id`, distributing data across 4 partitions.

#### **Step 1: Create the Parent Table**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL
) PARTITION BY HASH (id);
```
✅ **Key Takeaway:**  
- We define **HASH(id)** to distribute rows evenly across partitions.  

---

#### **Step 2: Create Partitioned Tables**
Now, create **4 partitions** to distribute records **evenly** based on the `id` hash value.  

```sql
CREATE TABLE users_p0 PARTITION OF users FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE users_p1 PARTITION OF users FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE users_p2 PARTITION OF users FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE users_p3 PARTITION OF users FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```
✅ **How It Works:**  
- **MODULUS 4**: We divide `id` values into 4 partitions.  
- **REMAINDER 0-3**: Determines which partition a row belongs to.  

Example:  
- `id % 4 = 0` → Goes to `users_p0`  
- `id % 4 = 1` → Goes to `users_p1`  
- `id % 4 = 2` → Goes to `users_p2`  
- `id % 4 = 3` → Goes to `users_p3`  

---

#### **Step 3: Insert Sample Data**
Let’s insert some user records and see where they go.
```sql
INSERT INTO users (id, name, email) VALUES
(1, 'Alice', 'alice@example.com'),
(2, 'Bob', 'bob@example.com'),
(3, 'Charlie', 'charlie@example.com'),
(4, 'David', 'david@example.com'),
(5, 'Emma', 'emma@example.com');
```
✅ **How PostgreSQL Distributes Data:**  
- `1 % 4 = 1` → `users_p1`  
- `2 % 4 = 2` → `users_p2`  
- `3 % 4 = 3` → `users_p3`  
- `4 % 4 = 0` → `users_p0`  
- `5 % 4 = 1` → `users_p1`  

---

#### **Step 4: Verify Partitioning**
Use this query to check where each row is stored:
```sql
SELECT tableoid::regclass, * FROM users;
```
✅ **Expected Output:**  
| tableoid  | id | name    | email               |
|-----------|----|--------|---------------------|
| users_p1  | 1  | Alice  | alice@example.com   |
| users_p2  | 2  | Bob    | bob@example.com     |
| users_p3  | 3  | Charlie | charlie@example.com |
| users_p0  | 4  | David  | david@example.com   |
| users_p1  | 5  | Emma   | emma@example.com    |

---

#### **Step 5: Query Optimization with Indexing**
To make queries faster, add an **index** to the parent table:
```sql
CREATE INDEX idx_users_email ON users(email);
```
✅ **Why?**  
- PostgreSQL will **automatically scan the correct partition** based on `id`.  
- Indexing improves **query performance** across partitions.  

---

### **📌 Key Advantages of Hash Partitioning**
🔹 **Ensures even data distribution** (avoids hotspots).  
🔹 **Efficient for high-concurrency workloads** (e.g., user logins, transactions).  
🔹 **Works well for large tables with millions of rows**.  
🔹 **Partition pruning** helps PostgreSQL scan **only the relevant partition** (faster queries).  

---

### **📌 When NOT to Use Hash Partitioning**
❌ If **range queries** (e.g., dates) are frequent, use **Range Partitioning** instead.  
❌ If the dataset is **small**, partitioning may add unnecessary complexity.  
❌ If **one partition becomes too large**, performance can suffer.  

---

### **🔥 Advanced Task**
✅ Try partitioning an `orders` table based on **user_id** using `MODULUS 10`.  
✅ Test query performance **before and after indexing**.  

Would you like a **MongoDB equivalent** of hash-based sharding? 🚀