# High-Level Design Master Guide
## Part 1: Foundation & Building Blocks (Complete Guide)

---

## 📚 Module 1.1: Core Networking Concepts

### **HTTP/HTTPS Protocols**

#### **What is HTTP?**
HTTP (HyperText Transfer Protocol) is the foundation of data communication on the web. It's a stateless, application-layer protocol that follows a request-response model.

#### **HTTP Methods (CRUD Operations)**
```
POST   → Create (C)
GET    → Read (R)
PUT    → Update (U) - Full replacement
PATCH  → Update (U) - Partial modification
DELETE → Delete (D)

Additional Methods:
- HEAD: Like GET but only returns headers
- OPTIONS: Returns allowed methods
- CONNECT: Establishes tunnel (for proxies)
- TRACE: Diagnostic loop-back test
```

**Idempotency Rule:**
- **Idempotent**: GET, PUT, DELETE (same request multiple times = same result)
- **Non-idempotent**: POST, PATCH (each request may create new state)

#### **HTTP Status Codes (Master List)**

**1xx - Informational**
- 100 Continue: Server received headers, client can send body
- 101 Switching Protocols: WebSocket upgrade

**2xx - Success**
- 200 OK: Standard success
- 201 Created: Resource created successfully (POST)
- 204 No Content: Success but no body to return (DELETE)
- 206 Partial Content: Range request successful

**3xx - Redirection**
- 301 Moved Permanently: SEO-friendly redirect
- 302 Found: Temporary redirect
- 304 Not Modified: Use cached version
- 307 Temporary Redirect: Same method must be used
- 308 Permanent Redirect: Same method must be used

**4xx - Client Errors**
- 400 Bad Request: Malformed syntax
- 401 Unauthorized: Authentication required
- 403 Forbidden: Authenticated but not authorized
- 404 Not Found: Resource doesn't exist
- 405 Method Not Allowed: GET on POST-only endpoint
- 409 Conflict: Request conflicts with current state
- 429 Too Many Requests: Rate limit exceeded

**5xx - Server Errors**
- 500 Internal Server Error: Generic server failure
- 502 Bad Gateway: Invalid response from upstream
- 503 Service Unavailable: Temporary overload
- 504 Gateway Timeout: Upstream timeout

**Interview Trap:** 401 vs 403?
- 401: "Who are you?" (not logged in)
- 403: "I know who you are, but you can't do this" (insufficient permissions)

#### **HTTP Headers (Critical Ones)**

**Request Headers:**
```
Authorization: Bearer <token>          // Authentication
Content-Type: application/json         // Body format
Accept: application/json               // Expected response format
User-Agent: Mozilla/5.0...             // Client info
Cache-Control: no-cache                // Caching directives
If-None-Match: "etag-value"            // Conditional request
Cookie: session_id=abc123              // State management
```

**Response Headers:**
```
Content-Type: application/json         // Response format
Cache-Control: max-age=3600            // Cache for 1 hour
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
Set-Cookie: session_id=xyz; HttpOnly; Secure
Access-Control-Allow-Origin: *         // CORS
Content-Encoding: gzip                 // Compression
```

#### **HTTPS = HTTP + SSL/TLS**

**SSL/TLS Handshake Flow (Detailed):**
```
1. Client Hello
   → Supported cipher suites
   → Random number
   → TLS version

2. Server Hello
   → Selected cipher suite
   → Random number
   → Server certificate (public key)

3. Client Verification
   → Validates certificate with CA
   → Generates pre-master secret
   → Encrypts with server's public key
   → Sends to server

4. Server Decryption
   → Decrypts with private key
   → Both derive session keys

5. Encrypted Communication Begins
   → Symmetric encryption using session keys
```

**Why Both Asymmetric + Symmetric Encryption?**
- Asymmetric (RSA): Secure but slow → Used only for handshake
- Symmetric (AES): Fast but key distribution problem → Used for data transfer

---

### **REST API Design Principles**

#### **Core Principles**

**1. Resource-Based URLs**
```
✅ GOOD:
GET    /users              → List users
GET    /users/123          → Get user 123
POST   /users              → Create user
PUT    /users/123          → Update user 123
DELETE /users/123          → Delete user 123

❌ BAD:
GET    /getAllUsers
POST   /createUser
POST   /user/delete/123
```

**2. Use HTTP Methods Correctly**
```
✅ GET /users?role=admin&sort=name    → Query parameters for filtering
✅ POST /users with body              → Data in request body
✅ PUT /users/123 with full object    → Complete replacement
✅ PATCH /users/123 {email: "new"}    → Partial update
```

**3. Proper Status Codes**
```
POST /users     → 201 Created (with Location header)
GET /users/999  → 404 Not Found
PUT /users/123  → 200 OK or 204 No Content
DELETE /users/123 → 204 No Content
```

**4. Versioning**
```
Option 1 - URL Path:     /api/v1/users
Option 2 - Header:       Accept: application/vnd.api.v1+json
Option 3 - Query Param:  /api/users?version=1

Best Practice: URL Path (most visible and cache-friendly)
```

**5. Pagination**
```
GET /users?page=2&limit=20
Response:
{
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  },
  "links": {
    "next": "/users?page=3&limit=20",
    "prev": "/users?page=1&limit=20"
  }
}
```

**6. Error Response Format**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [
      {
        "field": "email",
        "issue": "Must be valid email address"
      }
    ],
    "timestamp": "2024-01-14T10:30:00Z",
    "requestId": "req-abc-123"
  }
}
```

#### **Advanced REST Patterns**

**HATEOAS (Hypermedia As The Engine Of Application State)**
```json
{
  "id": 123,
  "name": "John Doe",
  "links": {
    "self": "/users/123",
    "posts": "/users/123/posts",
    "followers": "/users/123/followers",
    "delete": "/users/123"
  }
}
```

---

### **WebSockets vs HTTP**

#### **HTTP: Request-Response Model**
```
Client → Request  → Server
Client ← Response ← Server
[Connection closes or kept alive]
```

**Limitations:**
- Client must initiate (no server push)
- Overhead: New headers for each request
- Not suitable for real-time bidirectional communication

#### **WebSocket: Full-Duplex Communication**
```
Initial HTTP Upgrade:
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==

Server Response:
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade

Then: Persistent bidirectional connection
Client ←→ Server (both can send anytime)
```

#### **When to Use What?**

| Use Case | Technology | Reason |
|----------|-----------|--------|
| Chat application | WebSocket | Real-time bidirectional |
| Live sports scores | WebSocket/SSE | Server push updates |
| Stock ticker | WebSocket | High-frequency updates |
| Form submission | HTTP | One-time request-response |
| REST API | HTTP | Standard CRUD operations |
| File upload | HTTP | Request-driven |
| Multiplayer game | WebSocket | Low latency, bidirectional |
| Notifications | SSE or WebSocket | Server-initiated updates |

#### **WebSocket Implementation Example**
```javascript
// Client
const ws = new WebSocket('ws://example.com/chat');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'join', room: 'general' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

ws.onerror = (error) => console.error('WebSocket error:', error);
ws.onclose = () => console.log('Connection closed');

// Server (Node.js with ws library)
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    // Broadcast to all clients
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });
});
```

---

### **TCP vs UDP**

#### **TCP (Transmission Control Protocol)**

**Characteristics:**
- **Connection-oriented**: 3-way handshake before data transfer
- **Reliable**: Guarantees delivery with acknowledgments
- **Ordered**: Packets arrive in order sent
- **Error-checked**: Checksum validation
- **Flow control**: Prevents overwhelming receiver
- **Slower**: Due to overhead

**3-Way Handshake:**
```
Client → SYN → Server
Client ← SYN-ACK ← Server
Client → ACK → Server
[Connection established]
```

**Use Cases:**
- HTTP/HTTPS
- Email (SMTP, IMAP, POP3)
- File transfer (FTP)
- SSH
- Database connections

#### **UDP (User Datagram Protocol)**

**Characteristics:**
- **Connectionless**: No handshake
- **Unreliable**: No delivery guarantee
- **Unordered**: Packets may arrive out of order
- **No error recovery**: Lost packets are gone
- **Faster**: Minimal overhead
- **Lower latency**

**Use Cases:**
- Video streaming (Netflix, YouTube)
- Video conferencing (Zoom)
- Online gaming
- DNS queries
- VoIP calls
- Live broadcasts

#### **Interview Question: Why does video streaming use UDP?**

**Answer:** 
Video streaming prioritizes **speed over reliability**. If a video frame is lost, it's better to skip it and continue rather than waiting for retransmission (which would cause buffering). The human eye can tolerate minor frame loss, but not delays. Also, modern video codecs can handle packet loss gracefully.

---

### **DNS Resolution Flow**

#### **Complete DNS Lookup Process**

```
User types: www.example.com

1. Browser Cache Check
   → Checks if IP is cached (60s - 24h TTL)

2. OS Cache Check
   → Checks hosts file and OS DNS cache

3. Router Cache Check
   → Home router may cache DNS

4. ISP DNS Resolver (Recursive Resolver)
   → If not cached, starts recursive lookup

5. Root Name Server
   Query: "Where is .com?"
   Response: "Ask TLD server at X.X.X.X"

6. TLD (Top-Level Domain) Server (.com)
   Query: "Where is example.com?"
   Response: "Ask authoritative server at Y.Y.Y.Y"

7. Authoritative Name Server
   Query: "IP for www.example.com?"
   Response: "192.0.2.1"

8. Response Chain Back to Browser
   → Each level caches the result

Total Time: 20-120ms (first time)
Cached Time: <1ms
```

#### **DNS Record Types**

```
A Record:      example.com → 192.0.2.1 (IPv4)
AAAA Record:   example.com → 2001:0db8::1 (IPv6)
CNAME Record:  www.example.com → example.com (alias)
MX Record:     example.com → mail.example.com (email server)
TXT Record:    Arbitrary text (SPF, DKIM, verification)
NS Record:     Specifies authoritative name servers
SOA Record:    Start of Authority (admin info)
```

#### **CDN Basics**

**What is a CDN?**
Content Delivery Network: Distributed servers that cache and serve content from locations closer to users.

**How CDN Works:**
```
1. User in India requests image from example.com
2. DNS returns IP of nearest CDN edge server (Mumbai)
3. Edge server checks cache
   - If cached: Serve immediately (cache hit)
   - If not: Fetch from origin, cache, then serve (cache miss)
4. Subsequent requests served from cache (fast!)
```

**CDN Benefits:**
- **Reduced latency**: Geographic proximity
- **Load reduction**: Origin server handles fewer requests
- **DDoS protection**: Distributed traffic absorption
- **Better availability**: Redundancy across locations

**Popular CDNs:**
- Cloudflare
- AWS CloudFront
- Akamai
- Fastly
- Google Cloud CDN

---

## 📊 Module 1.2: Database Fundamentals

### **SQL vs NoSQL: The Complete Decision Tree**

#### **SQL (Relational Databases)**

**When to Use SQL:**
✅ ACID compliance required (banking, e-commerce orders)
✅ Complex queries with multiple joins
✅ Structured data with clear relationships
✅ Strong consistency needed
✅ Data integrity is critical
✅ Reporting and analytics

**Popular SQL Databases:**
- PostgreSQL (feature-rich, ACID-compliant)
- MySQL (widely used, good performance)
- Oracle (enterprise, high performance)
- MS SQL Server (enterprise, Windows integration)
- SQLite (embedded, serverless)

#### **NoSQL (Non-Relational Databases)**

**When to Use NoSQL:**
✅ Massive scale (billions of records)
✅ Flexible schema (frequently changing structure)
✅ High write throughput
✅ Horizontal scaling needed
✅ Eventual consistency acceptable
✅ Simple queries (key-value lookups)
✅ Unstructured or semi-structured data

**NoSQL Types:**

**1. Document Databases (MongoDB, CouchDB)**
```json
// Flexible schema, nested data
{
  "_id": "user123",
  "name": "Alice",
  "address": {
    "street": "123 Main St",
    "city": "NYC"
  },
  "orders": [
    { "id": "order1", "total": 99.99 },
    { "id": "order2", "total": 149.99 }
  ]
}
```
**Use Cases:** Content management, catalogs, user profiles

**2. Key-Value Stores (Redis, DynamoDB)**
```
user:123 → { "name": "Alice", "email": "alice@example.com" }
session:abc → { "userId": 123, "expires": 1640000000 }
```
**Use Cases:** Caching, session storage, shopping carts

**3. Column-Family (Cassandra, HBase)**
```
Row Key: user123
Column Family: profile
  - name: Alice
  - email: alice@example.com
Column Family: orders
  - order1: {...}
  - order2: {...}
```
**Use Cases:** Time-series data, analytics, event logging

**4. Graph Databases (Neo4j, Amazon Neptune)**
```
(Alice)-[:FRIENDS_WITH]->(Bob)
(Alice)-[:LIKES]->(Product1)
(Bob)-[:PURCHASED]->(Product1)
```
**Use Cases:** Social networks, recommendation engines, fraud detection

#### **Decision Matrix**

| Requirement | Choose |
|------------|--------|
| Financial transactions | SQL (ACID) |
| Social media posts | NoSQL (Document) |
| Real-time analytics | NoSQL (Column) |
| Caching layer | NoSQL (Key-Value) |
| Friend recommendations | NoSQL (Graph) |
| Inventory management | SQL |
| IoT sensor data | NoSQL (Time-series/Column) |
| User profiles | NoSQL (Document) or SQL |

---

### **ACID Properties (Deep Dive)**

#### **A = Atomicity**
**All or nothing:** Transaction either completes fully or not at all.

```sql
-- Bank transfer example
BEGIN TRANSACTION;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1; -- Alice
  UPDATE accounts SET balance = balance + 100 WHERE id = 2; -- Bob
COMMIT;

-- If second UPDATE fails, first UPDATE is rolled back
-- Money never disappears or duplicates
```

**Real-world Example:**
Order placement: Creating order, reducing inventory, charging payment must all succeed or all fail.

#### **C = Consistency**
**Data integrity rules are never violated.**

```sql
-- Constraint example
ALTER TABLE accounts 
ADD CONSTRAINT positive_balance CHECK (balance >= 0);

-- This transaction will fail:
UPDATE accounts SET balance = -50 WHERE id = 1;
-- Error: Check constraint violated
```

**Real-world Example:**
A foreign key constraint ensures every order references a valid customer.

#### **I = Isolation**
**Concurrent transactions don't interfere with each other.**

**Isolation Levels (Strictest to Loosest):**

**1. Read Uncommitted (Lowest)**
- Can read uncommitted changes (dirty reads)
- **Problem:** Transaction A reads data being modified by Transaction B, then B rolls back

**2. Read Committed**
- Only read committed data
- **Problem:** Non-repeatable reads (read same row twice, get different values)

**3. Repeatable Read**
- Same row always returns same value within transaction
- **Problem:** Phantom reads (range queries may return different results)

**4. Serializable (Highest)**
- Complete isolation, like transactions run sequentially
- **Trade-off:** Slowest performance

```sql
-- Example: Two users booking last seat
-- Without proper isolation:
Transaction A: SELECT seats WHERE available = true; -- Returns seat 1
Transaction B: SELECT seats WHERE available = true; -- Returns seat 1 (problem!)
Transaction A: UPDATE seats SET available = false WHERE id = 1;
Transaction B: UPDATE seats SET available = false WHERE id = 1; -- Double booking!

-- With Serializable isolation:
Transaction A locks seat 1
Transaction B waits until A completes
```

#### **D = Durability**
**Committed transactions persist even after crashes.**

**Implementation:**
- Write-Ahead Logging (WAL): Log changes before applying
- After crash, replay log to recover state

```
Transaction commits → Written to disk → Power outage occurs → 
System restarts → Reads WAL → Recovers committed transactions
```

---

### **Database Indexing (Complete Guide)**

#### **Why Indexing?**
Without index: Full table scan O(n)
With index: Logarithmic lookup O(log n)

```sql
-- Without index
SELECT * FROM users WHERE email = 'alice@example.com';
-- Scans 10 million rows → 5 seconds

-- With index on email
CREATE INDEX idx_email ON users(email);
-- B-tree lookup → 0.01 seconds
```

#### **Index Types**

**1. B-Tree Index (Most Common)**

**Structure:**
```
                [50]
               /    \
          [25,40]   [75,90]
         /  |  \    /  |   \
      [10] [30] [45] [60] [80] [95]
```

**Characteristics:**
- Sorted order
- O(log n) search
- Efficient for range queries
- Default in most databases

```sql
CREATE INDEX idx_age ON users(age);
-- Good for:
SELECT * FROM users WHERE age = 25;
SELECT * FROM users WHERE age BETWEEN 20 AND 30;
SELECT * FROM users WHERE age > 18 ORDER BY age;
```

**2. Hash Index**

**Structure:**
```
Hash('alice@example.com') → 742 → Row location
```

**Characteristics:**
- O(1) lookup for exact matches
- Cannot do range queries
- Used for equality comparisons only

```sql
CREATE INDEX idx_email_hash ON users USING HASH (email);
-- Good for:
SELECT * FROM users WHERE email = 'alice@example.com';
-- Bad for:
SELECT * FROM users WHERE email LIKE 'alice%'; -- Won't use index
```

**3. Composite Index (Multi-Column)**

```sql
CREATE INDEX idx_name_age ON users(last_name, first_name, age);

-- Index is used for (left-to-right):
✅ WHERE last_name = 'Smith'
✅ WHERE last_name = 'Smith' AND first_name = 'John'
✅ WHERE last_name = 'Smith' AND first_name = 'John' AND age = 30

-- Index NOT used for:
❌ WHERE first_name = 'John' (skips left-most column)
❌ WHERE age = 30
```

**Column Order Matters!** Put most selective column first.

**4. Full-Text Index**
```sql
CREATE FULLTEXT INDEX idx_content ON articles(title, body);
SELECT * FROM articles WHERE MATCH(title, body) AGAINST ('database indexing');
```

**5. Spatial Index**
For geographic data (PostGIS)

#### **Index Trade-offs**

**Pros:**
✅ Faster reads (SELECT, WHERE, ORDER BY, JOIN)
✅ Speeds up sorting

**Cons:**
❌ Slower writes (INSERT, UPDATE, DELETE must update index)
❌ Storage overhead (indexes consume disk space)
❌ Maintenance overhead

**Rule of Thumb:**
- Index columns used in WHERE, JOIN, ORDER BY
- Don't index every column (diminishing returns)
- Index high-cardinality columns (many unique values)
- Don't index low-cardinality columns (gender: M/F)

---

### **Normalization vs Denormalization**

#### **Database Normalization**

**Goal:** Eliminate redundancy, ensure data integrity

**1NF (First Normal Form):**
- Atomic values (no arrays/lists in cells)
- Each column has single value

```sql
❌ BAD (Not 1NF):
users
| id | name  | phones              |
|----|-------|---------------------|
| 1  | Alice | 555-1234,555-5678   |

✅ GOOD (1NF):
users                     phones
| id | name  |           | user_id | phone    |
|----|-------|           |---------|----------|
| 1  | Alice |           | 1       | 555-1234 |
                         | 1       | 555-5678 |
```

**2NF (Second Normal Form):**
- Must be in 1NF
- No partial dependencies (all non-key columns depend on entire primary key)

```sql
❌ BAD (Not 2NF):
order_items (order_id, product_id, quantity, customer_name)
-- customer_name depends only on order_id, not on (order_id, product_id)

✅ GOOD (2NF):
orders (order_id, customer_name)
order_items (order_id, product_id, quantity)
```

**3NF (Third Normal Form):**
- Must be in 2NF
- No transitive dependencies (non-key columns don't depend on other non-key columns)

```sql
❌ BAD (Not 3NF):
employees (id, name, department, department_head)
-- department_head depends on department, not directly on id

✅ GOOD (3NF):
employees (id, name, department)
departments (department, department_head)
```

**BCNF (Boyce-Codd Normal Form):**
Stricter version of 3NF

**4NF, 5NF:** Rarely used in practice

#### **Denormalization**

**When to Denormalize:**
- Read-heavy workloads (analytics, reporting)
- Complex joins are too slow
- Acceptable to have redundant data
- Eventual consistency is okay

**Example:**
```sql
-- Normalized (requires join):
SELECT u.name, COUNT(p.id) as post_count
FROM users u
LEFT JOIN posts p ON u.id = p.user_id
GROUP BY u.id;

-- Denormalized (no join needed):
users
| id | name  | post_count |
|----|-------|------------|
| 1  | Alice | 42         |

-- Update post_count whenever post is created/deleted
```

**Denormalization Patterns:**
1. **Materialized views**: Precomputed query results
2. **Duplicate data**: Store redundant data to avoid joins
3. **Caching**: Store computed values

---

### **SQL Joins (Mastery)**

#### **Join Types Visualized**

**Sample Tables:**
```
users                      orders
| id | name  |            | id | user_id | total |
|----|-------|            |----|---------|-------|
| 1  | Alice |            | 1  | 1       | 100   |
| 2  | Bob   |            | 2  | 1       | 200   |
| 3  | Carol |            | 3  | 4       | 150   |
```

**INNER JOIN (Intersection)**
```sql
SELECT u.name, o.total
FROM users u
INNER JOIN orders o ON u.id = o.user_id;

Result:
| name  | total |
|-------|-------|
| Alice | 100   |
| Alice | 200   |
-- Only users with orders
```

**LEFT JOIN (All from left table)**
```sql
SELECT u.name, o.total
FROM users u
LEFT JOIN orders o ON u.id = o.user_id;

Result:
| name  | total |
|-------|-------|
| Alice | 100   |
| Alice | 200   |
| Bob   | NULL  | ← Bob has no orders
| Carol | NULL  |
```

**RIGHT JOIN (All from right table)**
```sql
SELECT u.name, o.total
FROM users u
RIGHT JOIN orders o ON u.id = o.user_id;

Result:
| name  | total |
|-------|-------|
| Alice | 100   |
| Alice | 200   |
| NULL  | 150   | ← Order with user_id=4 (doesn't exist)
```

**FULL OUTER JOIN (Everything)**
```sql
SELECT u.name, o.total
FROM users u
FULL OUTER JOIN orders o ON u.id = o.user_id;

Result:
| name  | total |
|-------|-------|
| Alice | 100   |
| Alice | 200   |
| Bob   | NULL  |
| Carol | NULL  |
| NULL  | 150   |
```

**CROSS JOIN (Cartesian Product)**
```sql
SELECT u.name, o.total
FROM users u
CROSS JOIN orders o;

Result: 3 users × 3 orders = 9 rows
```

#### **Advanced Join Patterns**

**Self Join:**
```sql
-- Find employees and their managers
SELECT e.name as employee, m.name as manager
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.id;
```

**Multiple Joins:**
```sql
SELECT u.name, o.total, p.name as product
FROM users u
JOIN orders o ON u.id = o.user_id
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id;
```

---

## 🚀 Module 1.3: Caching Strategies

### **Why Caching?**

**Performance Impact:**
- Database query: 50-500ms
- Cache hit: 1-5ms
- **100x speedup!**

**Cost Savings:**
- Reduces database load
- Fewer expensive queries
- Lower infrastructure costs

---

### **Cache Levels (Hierarchy)**

```
Browser Cache (Client-side)
        ↓
CDN Cache (Edge servers)
        ↓
Application Cache (Redis, Memcached)
        ↓
Database Query Cache
        ↓
Database (Source of truth)
```

#### **1. Browser Cache**
```
Cache-Control: max-age=31536000, immutable
```
- HTML, CSS, JS, images cached locally
- Fastest (0ms - no network round-trip)

#### **2. CDN Cache**
- Static assets served from edge locations
- 10-50ms latency

#### **3. Application Cache (Redis/Memcached)**
- Session data, API responses, computed results
- 1-5ms latency

#### **4. Database Cache**
- Query result cache, buffer pool
- 10-50ms latency

---

### **Caching Patterns (Deep Dive)**

#### **1. Cache-Aside (Lazy Loading)**

**Flow:**
```
1. Application checks cache
2. Cache miss → Query database
3. Store result in cache
4. Return to application

On next request:
1. Application checks cache
2. Cache hit → Return immediately
```

**Code Example:**
```javascript
async function getUser(id) {
  // 1. Check cache
  let user = await cache.get(`user:${id}`);
  
  if (user) {
    return JSON.parse(user); // Cache hit
  }
  
  // 2. Cache miss - query database
  user = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  
  // 3. Store in cache
  await cache.set(`user:${id}`, JSON.stringify(user), 'EX', 3600);
  
  return user;
}
```

**Pros:**
✅ Only caches requested data
✅ Cache failures don't break system

**Cons:**
❌ Initial request is slow (cache miss penalty)
❌ Stale data if not invalidated properly

**Best For:** Read-heavy workloads

---

#### **2. Read-Through Cache**

**Flow:**
```
Application → Cache → Database (if miss)
Cache automatically loads from database
```

**Code Example:**
```javascript
// Cache library handles database loading
const user = await cache.get(`user:${id}`, {
  loader: async (key) => {
    return await db.query('SELECT * FROM users WHERE id = ?', [id]);
  }
});
```

**Pros:**
✅ Simpler application code
✅ Cache abstraction

**Cons:**
❌ Tight coupling between cache and database

---

#### **3. Write-Through Cache**

**Flow:**
```
Application → Cache → Database
Write to cache AND database synchronously
```

**Code Example:**
```javascript
async function updateUser(id, data) {
  // 1. Write to cache
  await cache.set(`user:${id}`, JSON.stringify(data));
  
  // 2. Write to database
  await db.query('UPDATE users SET ? WHERE id = ?', [data, id]);
}
```

**Pros:**
✅ Cache always consistent with database
✅ No stale data

**Cons:**
❌ Higher write latency (two operations)
❌ Wasted cache space if data never read

**Best For:** Read-heavy + require consistency

---

#### **4. Write-Back (Write-Behind) Cache**

**Flow:**
```
Application → Cache (async) → Database
Write to cache immediately, database updated later
```

**Code Example:**
```javascript
async function updateUser(id, data) {
  // 1. Write to cache immediately
  await cache.set(`user:${id}`, JSON.stringify(data));
  
  // 2. Queue database write (async)
  queue.push({ action: 'UPDATE', table: 'users', id, data });
  
  return; // Return immediately, database update happens in background
}

// Background worker processes queue
setInterval(async () => {
  while (queue.length > 0) {
    const task = queue.shift();
    await db.query(`UPDATE ${task.table} SET ? WHERE id = ?`, [task.data, task.id]);
  }
}, 1000); // Batch writes every 1 second
```

**Pros:**
✅ Fastest writes (no database wait)
✅ Can batch multiple writes
✅ Reduces database load

**Cons:**
❌ Risk of data loss if cache fails before DB write
❌ Inconsistency window
❌ Complex implementation

**Best For:** High write throughput, can tolerate some data loss (analytics, logs)

---

#### **5. Refresh-Ahead Cache**

**Flow:**
```
Cache automatically refreshes data BEFORE it expires
Predicts which data will be needed next
```

**Code Example:**
```javascript
async function getUser(id) {
  let user = await cache.get(`user:${id}`);
  
  if (user) {
    const ttl = await cache.ttl(`user:${id}`);
    
    // If TTL is less than 10% of original, refresh in background
    if (ttl < 360) { // 10% of 3600 seconds
      // Background refresh (don't wait)
      setImmediate(async () => {
        const freshUser = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        await cache.set(`user:${id}`, JSON.stringify(freshUser), 'EX', 3600);
      });
    }
    
    return JSON.parse(user);
  }
  
  // Cache miss - load from database
  user = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  await cache.set(`user:${id}`, JSON.stringify(user), 'EX', 3600);
  return user;
}
```

**Pros:**
✅ No cache miss penalty for frequently accessed data
✅ Always fresh data for hot keys

**Cons:**
❌ Complex prediction logic
❌ May refresh data that won't be requested

**Best For:** Frequently accessed data with expensive computation

---

### **Eviction Policies (Deep Dive)**

When cache is full, which item to remove?

#### **1. LRU (Least Recently Used)**

**Concept:** Remove item that hasn't been used for longest time

**Implementation:**
```javascript
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map(); // Map maintains insertion order
  }
  
  get(key) {
    if (!this.cache.has(key)) return -1;
    
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    
    return value;
  }
  
  put(key, value) {
    // If exists, delete to re-add at end
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // Add at end
    this.cache.set(key, value);
    
    // Evict oldest if over capacity
    if (this.cache.size > this.capacity) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
  }
}

// Usage
const cache = new LRUCache(3);
cache.put(1, 'a'); // Cache: {1: 'a'}
cache.put(2, 'b'); // Cache: {1: 'a', 2: 'b'}
cache.put(3, 'c'); // Cache: {1: 'a', 2: 'b', 3: 'c'}
cache.get(1);      // Cache: {2: 'b', 3: 'c', 1: 'a'} (1 moved to end)
cache.put(4, 'd'); // Cache: {3: 'c', 1: 'a', 4: 'd'} (2 evicted)
```

**Complexity:**
- Get: O(1)
- Put: O(1)

**Best For:** General-purpose caching, web pages, database query results

---

#### **2. LFU (Least Frequently Used)**

**Concept:** Remove item with lowest access count

**Implementation:**
```javascript
class LFUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map(); // key -> {value, frequency}
    this.frequencies = new Map(); // frequency -> Set of keys
    this.minFreq = 0;
  }
  
  get(key) {
    if (!this.cache.has(key)) return -1;
    
    const {value, freq} = this.cache.get(key);
    
    // Increment frequency
    this.frequencies.get(freq).delete(key);
    if (this.frequencies.get(freq).size === 0 && freq === this.minFreq) {
      this.minFreq++;
    }
    
    if (!this.frequencies.has(freq + 1)) {
      this.frequencies.set(freq + 1, new Set());
    }
    this.frequencies.get(freq + 1).add(key);
    
    this.cache.set(key, {value, freq: freq + 1});
    return value;
  }
  
  put(key, value) {
    if (this.capacity === 0) return;
    
    if (this.cache.has(key)) {
      this.cache.get(key).value = value;
      this.get(key); // Update frequency
      return;
    }
    
    // Evict if at capacity
    if (this.cache.size >= this.capacity) {
      const evictKey = this.frequencies.get(this.minFreq).values().next().value;
      this.frequencies.get(this.minFreq).delete(evictKey);
      this.cache.delete(evictKey);
    }
    
    // Add new item with frequency 1
    this.cache.set(key, {value, freq: 1});
    if (!this.frequencies.has(1)) {
      this.frequencies.set(1, new Set());
    }
    this.frequencies.get(1).add(key);
    this.minFreq = 1;
  }
}
```

**Best For:** Items with stable access patterns (popular products, trending content)

---

#### **3. FIFO (First In, First Out)**

**Concept:** Remove oldest item (simple queue)

**Implementation:**
```javascript
class FIFOCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.queue = [];
    this.cache = new Map();
  }
  
  get(key) {
    return this.cache.has(key) ? this.cache.get(key) : -1;
  }
  
  put(key, value) {
    if (!this.cache.has(key) && this.cache.size >= this.capacity) {
      const oldestKey = this.queue.shift();
      this.cache.delete(oldestKey);
    }
    
    if (!this.cache.has(key)) {
      this.queue.push(key);
    }
    
    this.cache.set(key, value);
  }
}
```

**Best For:** Simple use cases, rotating logs

---

#### **Eviction Policy Comparison**

| Policy | Pros | Cons | Use Case |
|--------|------|------|----------|
| **LRU** | Adapts to access patterns | Doesn't consider frequency | General purpose |
| **LFU** | Protects popular items | Slow to adapt to changes | Stable workloads |
| **FIFO** | Simple, predictable | Ignores usage | Simple logging |
| **Random** | Fastest eviction | No optimization | Testing, simple needs |

---

### **Cache Invalidation (The Hardest Problem!)**

> "There are only two hard things in Computer Science: cache invalidation and naming things." - Phil Karlton

#### **Strategies**

**1. TTL (Time To Live)**
```javascript
await cache.set('user:123', data, 'EX', 3600); // Expires in 1 hour

// Pros: Simple, automatic
// Cons: Stale data until expiration, waste if updated before TTL
```

**2. Write-Through Invalidation**
```javascript
async function updateUser(id, data) {
  await db.update('users', id, data);
  await cache.del(`user:${id}`); // Invalidate cache
}

// Pros: Always fresh data
// Cons: Next read will be slow (cache miss)
```

**3. Event-Based Invalidation**
```javascript
// When user updates profile
eventBus.emit('user.updated', {userId: 123});

// Cache listener
eventBus.on('user.updated', async ({userId}) => {
  await cache.del(`user:${userId}`);
  await cache.del(`user:${userId}:posts`);
  await cache.del(`feed:followers:${userId}`);
});

// Pros: Granular control
// Cons: Complex dependency tracking
```

**4. Cache Tagging**
```javascript
// Tag related cache entries
await cache.set('user:123', data, {tags: ['user', 'profile']});
await cache.set('user:123:posts', posts, {tags: ['user', 'posts']});

// Invalidate all by tag
await cache.invalidateTag('user'); // Clears all user-related caches

// Pros: Flexible, batch invalidation
// Cons: Requires tag support
```

---

### **Distributed Caching (Redis Cluster)**

#### **Why Distributed Cache?**

**Single Redis limitations:**
- Memory limit (single machine)
- Single point of failure
- Limited throughput

**Redis Cluster solves:**
- Horizontal scaling (more memory)
- High availability (replicas)
- Better performance (distributed load)

#### **Redis Cluster Architecture**

```
Master 1 (Slots 0-5460)     Master 2 (Slots 5461-10922)   Master 3 (Slots 10923-16383)
    ↓                            ↓                              ↓
Replica 1A                   Replica 2A                     Replica 3A
```

**Consistent Hashing:**
```
Key → Hash → Slot (0-16383) → Master Node

Example:
"user:123" → CRC16 hash → Slot 7532 → Master 2
```

**Automatic Failover:**
```
Master 2 fails → Replica 2A promoted to Master → System remains available
```

#### **Redis Implementation**

```javascript
const Redis = require('ioredis');

// Single node
const cache = new Redis({
  host: 'localhost',
  port: 6379
});

// Cluster
const cluster = new Redis.Cluster([
  { host: '127.0.0.1', port: 7000 },
  { host: '127.0.0.1', port: 7001 },
  { host: '127.0.0.1', port: 7002 }
]);

// Usage (same API)
await cluster.set('user:123', JSON.stringify(user));
const data = await cluster.get('user:123');
```

---

### **Cache Stampede Prevention**

#### **Problem: Cache Stampede (Thundering Herd)**

```
Cache expires for popular item (e.g., homepage)
↓
100,000 requests arrive simultaneously
↓
All check cache → Miss
↓
All query database simultaneously
↓
Database overload!
```

#### **Solutions**

**1. Locking (Mutex)**
```javascript
async function getHomepage() {
  let html = await cache.get('homepage');
  if (html) return html;
  
  // Try to acquire lock
  const lockAcquired = await cache.set('lock:homepage', '1', 'NX', 'EX', 10);
  
  if (lockAcquired) {
    // This request rebuilds cache
    html = await expensiveRenderHomepage();
    await cache.set('homepage', html, 'EX', 3600);
    await cache.del('lock:homepage');
  } else {
    // Other requests wait and retry
    await sleep(100);
    html = await cache.get('homepage');
    if (!html) {
      // Lock holder failed, try again
      return getHomepage();
    }
  }
  
  return html;
}
```

**Pros:** Only one database query
**Cons:** Other requests wait

---

**2. Probabilistic Early Expiration**
```javascript
async function getUser(id) {
  const BETA = 1; // Tuning parameter
  const TTL = 3600;
  
  const cachedData = await cache.get(`user:${id}`);
  
  if (cachedData) {
    const {value, createdAt} = JSON.parse(cachedData);
    const age = Date.now() - createdAt;
    const ttl = await cache.ttl(`user:${id}`);
    
    // Probabilistically refresh before expiration
    const delta = ttl * BETA * Math.log(Math.random());
    
    if (delta < 0) {
      // Refresh in background
      setImmediate(async () => {
        const fresh = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        await cache.set(`user:${id}`, JSON.stringify({
          value: fresh,
          createdAt: Date.now()
        }), 'EX', TTL);
      });
    }
    
    return value;
  }
  
  // Cache miss - load from database
  const user = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  await cache.set(`user:${id}`, JSON.stringify({
    value: user,
    createdAt: Date.now()
  }), 'EX', TTL);
  
  return user;
}
```

**Pros:** No waiting, smooth load distribution
**Cons:** Occasional redundant refreshes

---

**3. Stale-While-Revalidate**
```javascript
async function get(key, fetcher, ttl) {
  const cached = await cache.get(key);
  
  if (cached) {
    const {value, expiresAt, staleAt} = JSON.parse(cached);
    
    if (Date.now() < expiresAt) {
      return value; // Fresh data
    }
    
    if (Date.now() < staleAt) {
      // Serve stale data while refreshing in background
      setImmediate(async () => {
        const fresh = await fetcher();
        await cache.set(key, JSON.stringify({
          value: fresh,
          expiresAt: Date.now() + ttl,
          staleAt: Date.now() + ttl + 300000 // 5 min grace period
        }));
      });
      
      return value; // Return stale data immediately
    }
  }
  
  // Cache miss or completely stale
  const fresh = await fetcher();
  await cache.set(key, JSON.stringify({
    value: fresh,
    expiresAt: Date.now() + ttl,
    staleAt: Date.now() + ttl + 300000
  }));
  
  return fresh;
}
```

**Pros:** Always fast response, no stampede
**Cons:** Serves stale data briefly

---

### **📋 Module 1.3 Practice Exercises**

#### **Exercise 1: Implement LRU Cache**
**Problem:** Implement an LRU cache with get and put operations in O(1) time.

**Exercise 2: Design Caching Layer for E-commerce**
```
Requirements:
- Product catalog (millions of products)
- User sessions
- Shopping carts
- Product recommendations

Design:
1. What to cache at each level?
2. Which eviction policy for each?
3. How to handle cart updates?
4. How to invalidate product cache when price changes?
```

**Exercise 3: Calculate Cache Hit Ratio**
```
Scenario: API with 1000 req/second
- 70% requests for top 100 items
- 20% requests for top 1000 items
- 10% requests for long tail (1M items)

Cache size: 1000 items (LRU policy)

Calculate:
1. Expected cache hit ratio
2. Database queries per second
3. Impact of doubling cache size
```

**Solutions** (Think through before looking):

<details>
<summary>Exercise 2 Solution</summary>

```
1. Cache Layer Design:
   - Browser: Static assets (images, CSS)
   - CDN: Product images, thumbnails
   - Application Cache (Redis):
     - Product details: TTL 1 hour, LRU eviction
     - User sessions: TTL 30 min, no eviction (critical)
     - Shopping carts: TTL 24 hours, LRU eviction
     - Recommendations: TTL 15 min, LRU eviction
   - Database: Source of truth

2. Eviction Policies:
   - Products: LRU (access patterns change)
   - Sessions: None (critical, buy more memory)
   - Carts: LRU (abandoned carts can be evicted)
   - Recommendations: LRU (personalized, changes often)

3. Cart Updates:
   - Write-through: Update cache AND database
   - Ensures consistency for checkout

4. Price Change Invalidation:
   - Publish event: "product.price.updated"
   - Invalidate: cache.del(`product:${id}`)
   - Invalidate related: recommendations, search results
```
</details>

<details>
<summary>Exercise 3 Solution</summary>

```
1. Cache Hit Ratio:
   - Top 100 items: 70% × 100% = 70% (all fit in cache)
   - Top 1000 items: 20% × 100% = 20% (all fit in cache)
   - Long tail: 10% × 0% = 0% (rarely repeat)
   - Total hit ratio: ~90%

2. Database Queries:
   - 1000 req/s × 10% miss rate = 100 queries/second

3. Double Cache Size (2000 items):
   - Hit ratio improves only slightly (~91%)
   - Law of diminishing returns
   - Better to optimize for top 1000 items
```
</details>

---

## ⚖️ Module 1.4: Load Balancing

### **What is Load Balancing?**

**Definition:** Distributing network traffic across multiple servers to ensure no single server is overwhelmed.

**Benefits:**
✅ High availability (failover)
✅ Better performance (distributed load)
✅ Scalability (add more servers)
✅ Maintenance without downtime

---

### **Layer 4 vs Layer 7 Load Balancing**

#### **Layer 4 (Transport Layer) - Network Load Balancer**

**What it sees:**
- IP addresses
- TCP/UDP ports
- No application data

**How it works:**
```
Client → Load Balancer (checks IP:Port) → Routes to Server
```

**Example:**
```
Request to 203.0.113.1:80
↓
LB forwards to 10.0.1.5:80 unchanged
```

**Pros:**
✅ Fast (no SSL termination, no content inspection)
✅ Lower latency
✅ Can handle more connections

**Cons:**
❌ Cannot route based on URL path or headers
❌ Cannot do SSL termination (client must handle SSL)
❌ Less flexible

**Best For:** High-performance, simple TCP/UDP load balancing

---

#### **Layer 7 (Application Layer) - Application Load Balancer**

**What it sees:**
- HTTP headers
- URL paths
- Cookies
- Query parameters
- Full application data

**How it works:**
```
Client → Load Balancer (reads HTTP request) → Routes based on content
```

**Example:**
```
GET /api/users → Routes to API servers
GET /images/logo.png → Routes to static asset servers
GET /admin/dashboard → Routes to admin servers
```

**Pros:**
✅ Content-based routing
✅ SSL termination at load balancer
✅ URL rewriting, header modification
✅ Better for microservices

**Cons:**
❌ Slower (SSL termination, content inspection)
❌ Higher CPU usage
❌ More expensive

**Best For:** Microservices, content-based routing, SSL offloading

---

### **Load Balancing Algorithms**

#### **1. Round Robin**

**How it works:** Distribute requests sequentially to each server

```
Request 1 → Server A
Request 2 → Server B
Request 3 → Server C
Request 4 → Server A (cycle repeats)
```

**Code Simulation:**
```javascript
class RoundRobinLoadBalancer {
  constructor(servers) {
    this.servers = servers; // ['serverA', 'serverB', 'serverC']
    this.currentIndex = 0;
  }
  
  getNextServer() {
    const server = this.servers[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.servers.length;
    return server;
  }
}

const lb = new RoundRobinLoadBalancer(['A', 'B', 'C']);
console.log(lb.getNextServer()); // A
console.log(lb.getNextServer()); // B
console.log(lb.getNextServer()); // C
console.log(lb.getNextServer()); // A
```

**Pros:**
✅ Simple
✅ Fair distribution

**Cons:**
❌ Doesn't consider server load
❌ All servers must have same capacity

**Best For:** Uniform servers, stateless apps

---

#### **2. Weighted Round Robin**

**How it works:** Servers with higher capacity get more requests

```
Server A (weight: 3) → Gets 60% of traffic
Server B (weight: 2) → Gets 40% of traffic

Request flow: A, A, A, B, B, (repeat)
```

**Code:**
```javascript
class WeightedRoundRobin {
  constructor(servers) {
    // servers: [{name: 'A', weight: 3}, {name: 'B', weight: 2}]
    this.servers = [];
    
    servers.forEach(server => {
      for (let i = 0; i < server.weight; i++) {
        this.servers.push(server.name);
      }
    });
    
    this.currentIndex = 0;
  }
  
  getNextServer() {
    const server = this.servers[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.servers.length;
    return server;
  }
}

const lb = new WeightedRoundRobin([
  {name: 'A', weight: 3},
  {name: 'B', weight: 2}
]);
// Output: A, A, A, B, B, A, A, A, B, B...
```

**Best For:** Servers with different capacities

---

#### **3. Least Connections**

**How it works:** Send request to server with fewest active connections

```
Server A: 10 connections
Server B: 15 connections
Server C: 8 connections  ← Choose this one
```

**Code:**
```javascript
class LeastConnectionsLoadBalancer {
  constructor(servers) {
    this.servers = servers.map(name => ({name, connections: 0}));
  }
  
  getNextServer() {
    // Find server with minimum connections
    const server = this.servers.reduce((min, curr) => 
      curr.connections < min.connections ? curr : min
    );
    
    server.connections++;
    return server.name;
  }
  
  releaseConnection(serverName) {
    const server = this.servers.find(s => s.name === serverName);
    if (server) {
      server.connections = Math.max(0, server.connections - 1);
    }
  }
}

const lb = new LeastConnectionsLoadBalancer(['A', 'B', 'C']);
lb.getNextServer(); // A (0 → 1 connections)
lb.getNextServer(); // B (0 → 1 connections)
lb.getNextServer(); // C (0 → 1 connections)
lb.releaseConnection('A'); // A now has 0 connections
lb.getNextServer(); // A (fewest connections)
```

**Best For:** Long-lived connections (WebSockets, database connections)

---

#### **4. IP Hash**

**How it works:** Hash client IP to determine server

```
Hash(ClientIP) % NumServers = ServerIndex

Hash(192.168.1.100) % 3 = 1 → Always Server B
```

**Code:**
```javascript
class IPHashLoadBalancer {
  constructor(servers) {
    this.servers = servers;
  }
  
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  getServer(clientIP) {
    const hash = this.simpleHash(clientIP);
    const index = hash % this.servers.length;
    return this.servers[index];
  }
}

const lb = new IPHashLoadBalancer(['A', 'B', 'C']);
console.log(lb.getServer('192.168.1.100')); // Always same server
console.log(lb.getServer('192.168.1.101')); // Different server
console.log(lb.getServer('192.168.1.100')); // Same as first call
```

**Pros:**
✅ Session persistence (same client → same server)
✅ Good for caching (user-specific data cached on one server)

**Cons:**
❌ Uneven distribution if IPs not uniformly distributed
❌ Cannot handle server failure gracefully

**Best For:** Session affinity, distributed caches

---

### **Health Checks & Failover**

#### **Health Check Types**

**1. Passive Health Checks**
```
Monitor actual traffic
If requests to Server A keep failing → Mark unhealthy
```

**2. Active Health Checks**
```
Load balancer periodically pings servers
Every 5 seconds: GET /health → Expect 200 OK
If 3 consecutive failures → Remove from pool
```

**Implementation:**
```javascript
class HealthCheckLoadBalancer {
  constructor(servers, healthCheckInterval = 5000) {
    this.servers = servers.map(url => ({
      url,
      healthy: true,
      consecutiveFailures: 0
    }));
    
    setInterval(() => this.runHealthChecks(), healthCheckInterval);
  }
  
  async runHealthChecks() {
    for (const server of this.servers) {
      try {
        const response = await fetch(`${server.url}/health`, {timeout: 2000});
        
        if (response.ok) {
          server.healthy = true;
          server.consecutiveFailures = 0;
        } else {
          server.consecutiveFailures++;
          if (server.consecutiveFailures >= 3) {
            server.healthy = false;
            console.log(`Server ${server.url} marked unhealthy`);
          }
        }
      } catch (error) {
        server.consecutiveFailures++;
        if (server.consecutiveFailures >= 3) {
          server.healthy = false;
        }
      }
    }
  }
  
  getHealthyServers() {
    return this.servers.filter(s => s.healthy);
  }
  
  getNextServer() {
    const healthy = this.getHealthyServers();
    if (healthy.length === 0) {
      throw new Error('No healthy servers available');
    }
    return healthy[Math.floor(Math.random() * healthy.length)].url;
  }
}
```

---

### **Session Persistence (Sticky Sessions)**

**Problem:** User logs in → Session on Server A → Next request goes to Server B → Not logged in!

**Solutions:**

**1. Sticky Sessions (Not Recommended)**
```
Load balancer remembers: User 123 → Server A
All subsequent requests from User 123 go to Server A
```

**Cons:**
❌ Uneven load distribution
❌ Server failure loses sessions
❌ Harder to scale

**2. Shared Session Store (Recommended)**
```
All servers connect to Redis for session storage
User logs in → Session stored in Redis
Any server can handle request → Fetches session from Redis
```

**Implementation:**
```javascript
// Server code
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const Redis = require('ioredis');

const redisClient = new Redis({
  host: 'redis-cluster',
  port: 6379
});

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1800000 } // 30 minutes
}));

// Now all servers share session state!
```

---

### **Load Balancer Tools**

#### **Nginx Configuration**

```nginx
# nginx.conf
http {
  upstream backend {
    # Load balancing method
    least_conn; # or ip_hash, or default round-robin
    
    # Backend servers
    server backend1.example.com:8080 weight=3;
    server backend2.example.com:8080 weight=2;
    server backend3.example.com:8080 backup; # Only used if others fail
    
    # Health checks
    server backend4.example.com:8080 max_fails=3 fail_timeout=30s;
  }
  
  server {
    listen 80;
    
    location / {
      proxy_pass http://backend;
      
      # Preserve client IP
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header Host $host;
      
      # Timeouts
      proxy_connect_timeout 3s;
      proxy_send_timeout 10s;
      proxy_read_timeout 10s;
    }
    
    # Static files directly
    location /static/ {
      alias /var/www/static/;
    }
  }
}
```

#### **HAProxy Configuration**

```
# haproxy.cfg
global
  maxconn 4096

defaults
  mode http
  timeout connect 5000ms
  timeout client 50000ms
  timeout server 50000ms

frontend http-in
  bind *:80
  default_backend servers

backend servers
  balance roundrobin
  
  # Health check
  option httpchk GET /health
  
  # Servers
  server server1 192.168.1.10:8080 check weight 3
  server server2 192.168.1.11:8080 check weight 2
  server server3 192.168.1.12:8080 check backup
```

---

### **📋 Module 1.4 Practice Exercises**

#### **Exercise 1: Choose Algorithm**

For each scenario, pick the best load balancing algorithm:

1. **Scenario:** Serving static web pages, all servers identical
   - **Answer:** Round Robin (simple, fair)

2. **Scenario:** Database connection pooling, connections last 5+ minutes
   - **Answer:** Least Connections (long-lived connections)

3. **Scenario:** User-specific caching on each server
   - **Answer:** IP Hash (same user → same server)

4. **Scenario:** 3 servers: 1 powerful (8 cores), 2 weak (2 cores)
   - **Answer:** Weighted Round Robin (distribute by capacity)

5. **Scenario:** Real-time chat with WebSocket connections
   - **Answer:** Least Connections + IP Hash (maintain connection, balance load)

#### **Exercise 2: Design Multi-Tier Load Balancing**

```
Design load balancing for:
- 1M daily active users
- Services: Web servers, API servers, Database
- Requirements: High availability, SSL termination

Your design should include:
1. Load balancer types (L4 or L7)
2. Algorithms for each tier
3. Health check strategy
4. Session management
```

<details>
<summary>Solution</summary>

```
Tier 1: Internet → L7 Load Balancer (AWS ALB)
  - SSL termination
  - Path-based routing:
    - /api/* → API servers
    - /static/* → CDN
    - /* → Web servers
  - Algorithm: Round Robin (stateless web)
  - Health check: GET /health every 10s

Tier 2: L7 LB → Web Servers (10 instances)
  - Auto-scaling group
  - Session: Redis cluster (shared state)
  - Health check: HTTP 200 from /

Tier 3: L7 LB → API Servers (5 instances)
  - Algorithm: Least Connections (varying request duration)
  - Health check: GET /api/health

Tier 4: API → L4 Load Balancer → Database
  - Algorithm: Weighted (primary + replicas)
  - Primary: weight 0 (writes only)
  - Replicas: weight equal (reads)
  - Health check: TCP connection on port 5432

Session Management:
- Redis cluster (3 masters + 3 replicas)
- Application servers connect to Redis for session store
- No sticky sessions needed
```
</details>

---

## 🔄 Module 1.5: CAP Theorem Deep Dive

### **Understanding CAP Theorem**

**Theorem:** In a distributed system, you can only guarantee **2 out of 3**:

**C = Consistency**
Every read receives the most recent write or an error

**A = Availability**
Every request receives a (non-error) response, without guarantee it's the latest

**P = Partition Tolerance**
System continues to operate despite network partitions

---

### **The Truth: You MUST Choose Partition Tolerance**

In distributed systems, network partitions **will happen**:
- Cable cut
- Switch failure
- Data center outage
- Network congestion

**So the real choice is:**
- **CP**: Consistency + Partition Tolerance → Sacrifice Availability
- **AP**: Availability + Partition Tolerance → Sacrifice Consistency

---

### **CP Systems (Consistency + Partition Tolerance)**

**Behavior during partition:**
```
Network partition occurs
↓
Minority nodes cannot reach majority
↓
Minority nodes refuse writes/reads (return error)
↓
Consistency maintained, but availability lost for some nodes
```

**Example: MongoDB (CP mode)**
```
3-node cluster: Node A, Node B, Node C
Network partition: A & B | C

A & B form majority → Accept writes
C is minority → Rejects writes (not available)

When partition heals, C catches up
✅ Consistency maintained
❌ C was unavailable during partition
```

**Code Example:**
```javascript
// MongoDB with write concern "majority"
await db.collection('users').insertOne(
  { name: 'Alice' },
  { writeConcern: { w: 'majority', wtimeout: 5000 } }
);

// During partition, minority nodes will timeout/error
// This ensures consistency (no dirty writes)
```

**Use Cases:**
✅ Financial transactions (banking)
✅ Inventory management
✅ User authentication
✅ Anything where stale data is unacceptable

**Examples:**
- MongoDB (with appropriate settings)
- HBase
- Redis (single master)
- Zookeeper
- Consul

---

### **AP Systems (Availability + Partition Tolerance)**

**Behavior during partition:**
```
Network partition occurs
↓
Each partition continues accepting reads/writes independently
↓
Data diverges (conflicts)
↓
When partition heals, conflicts must be resolved
✅ System available throughout
❌ Temporary inconsistency
```

**Example: Cassandra (AP)**
```
3-node cluster: Node A, Node B, Node C
Network partition: A & B | C

User writes to A&B partition: user.age = 25
User writes to C partition: user.age = 26

During partition:
- All nodes available ✅
- Data inconsistent ❌

When partition heals:
- Conflict detected: age=25 (timestamp T1) vs age=26 (timestamp T2)
- Resolution: Last-write-wins → age=26 (newer timestamp)
```

**Code Example:**
```javascript
// Cassandra with tunable consistency
await client.execute(
  'INSERT INTO users (id, name, age) VALUES (?, ?, ?)',
  [123, 'Alice', 25],
  { consistency: cassandra.types.consistencies.one } // AP behavior
);

// Read with eventual consistency
const result = await client.execute(
  'SELECT * FROM users WHERE id = ?',
  [123],
  { consistency: cassandra.types.consistencies.one }
);
// Might return stale data immediately after partition
```

**Use Cases:**
✅ Social media feeds (eventual consistency okay)
✅ Product catalogs
✅ Analytics/logging
✅ DNS
✅ Caching

**Examples:**
- Cassandra
- DynamoDB
- Couchbase
- Riak

---

### **Consistency Levels (The Spectrum)**

Real systems offer **tunable consistency**:

#### **Strong Consistency**

**Definition:** Read always returns latest write

**Implementation:**
- Read from majority of nodes
- Or read from master only

```sql
-- Read with quorum (majority)
-- 3 nodes: must read from 2
SELECT * FROM users WHERE id = 123 CONSISTENCY QUORUM;
```

**Latency:** High (wait for multiple nodes)

---

#### **Eventual Consistency**

**Definition:** If no new updates, eventually all reads return latest value

**Implementation:**
- Read from any single node
- Background replication catches up

```sql
SELECT * FROM users WHERE id = 123 CONSISTENCY ONE;
```

**Latency:** Low (single node response)

**Real-world example:**
```
You post on Twitter
↓
Immediately visible to you (local cache)
↓
Takes 100-500ms to appear for followers globally
↓
Eventually consistent across all data centers
```

---

#### **Other Consistency Levels**

**1. Read Your Writes**
```
User writes data
↓
User immediately reads same data
↓
Guaranteed to see their own write (but maybe not others')
```

**Implementation:**
```javascript
// Write to cache immediately
await cache.set('user:123:post', newPost);

// Read from cache (sees own write)
```

**2. Monotonic Reads**
```
If you read value X, subsequent reads never return older value
(but might not be latest)
```

**3. Causal Consistency**
```
If write B causally depends on write A,
anyone seeing B also sees A
```

Example:
```
Alice posts: "Guess what?" (A)
Alice posts: "I got engaged!" (B)

Bob must see them in order, not reversed
```

---

### **Quorum Reads/Writes**

**Formula:** `R + W > N`
- **R** = Read replicas
- **W** = Write replicas
- **N** = Total replicas

**Examples:**

**Strong Consistency (R + W > N):**
```
N = 3 replicas
W = 2 (write to 2 nodes)
R = 2 (read from 2 nodes)

R + W = 4 > 3 ✅ Guaranteed overlap, strong consistency
```

**Eventual Consistency (R + W ≤ N):**
```
N = 3
W = 1 (write to 1 node)
R = 1 (read from 1 node)

R + W = 2 ≤ 3 ❌ No overlap guaranteed, eventual consistency
```

**Implementation:**
```javascript
// Cassandra
await client.execute(query, params, {
  consistency: {
    ALL: 3,     // R=3, W=3 → Strongest
    QUORUM: 2,  // R=2, W=2 → Strong (for N=3)
    ONE: 1      // R=1, W=1 → Eventual
  }
});
```

---

### **CAP in Practice: Real Systems**

#### **MongoDB (Configurable)**

**Default: CP**
```javascript
// Write requires majority acknowledgment
await db.collection.insertOne(doc, { writeConcern: { w: 'majority' } });

// During partition, minority nodes reject writes
```

**Can configure as AP:**
```javascript
// Write to single node
await db.collection.insertOne(doc, { writeConcern: { w: 1 } });

// Faster, but risk of data loss if node fails before replication
```

---

#### **Cassandra (AP)**

**Always available:**
```
All nodes accept writes during partitions
Conflicts resolved by:
  - Last-write-wins (timestamp)
  - Or custom conflict resolution
```

**Can achieve strong consistency:**
```javascript
// Write to all nodes
await execute(query, {consistency: ALL});

// Read from all nodes
await execute(query, {consistency: ALL});

// Now CP-like, but slower and less available
```

---

### **Interview Deep Dive: CAP Choices**

#### **Banking System (Choose CP)**

**Requirement:** Account balance must be accurate

**Why CP:**
```
Scenario: Transfer $100
Account A: $500 → $400
Account B: $300 → $400

If using AP:
- Partition occurs mid-transfer
- One side sees A=$400, B=$300 (incomplete)
- Money appears to vanish temporarily!

With CP:
- Transaction fails if minority partition
- Money never vanishes
- Better to be unavailable than incorrect
```

---

#### **Social Media Feed (Choose AP)**

**Requirement:** Users can always post and view

**Why AP:**
```
Scenario: User posts photo
- Immediately visible to user (local data center)
- Gradually propagates globally (100-500ms)
- Some followers see it slightly delayed

Trade-off:
- Stale data acceptable (feed not financial)
- Availability critical (user frustration if down)
- Eventual consistency is fine
```

---

#### **Real-World Case Studies**

**1. Amazon DynamoDB (AP)**
```
Choice: AP
Reason: Shopping cart availability > consistency
Impact: Occasionally items appear twice if partition
        Better than "site down"
Resolution: Merge carts when partition heals
```

**2. Google Spanner (CP)**
```
Choice: CP (with high availability via TrueTime)
Reason: Financial accuracy required
Impact: Slower writes, but globally consistent
Unique: Uses atomic clocks for distributed consistency
```

**3. DNS (AP)**
```
Choice: AP
Reason: Availability critical, staleness tolerable
Impact: DNS changes take time to propagate (TTL)
        Better than DNS completely failing
```

---

### **📋 Module 1.5 Practice Exercises**

####  **Exercise 1: Identify CAP Choice**

For each system, choose CP or AP and justify:

1. **E-commerce inventory**
   <details>
   <summary>Answer</summary>
   
   **CP** - Cannot oversell items. Better to show "out of stock" than sell more than available.
   </details>

2. **News article comments**
   <details>
   <summary>Answer</summary>
   
   **AP** - Comments can be eventually consistent. Better users can always comment than service unavailable.
   </details>

3. **User authentication**
   <details>
   <summary>Answer</summary>
   
   **CP** - Cannot have inconsistent user state. Security critical.
   </details>

4. **Analytics dashboard**
   <details>
   <summary>Answer</summary>
   
   **AP** - Slight data delays acceptable. Always available more important.
   </details>

5. **Flight booking seats**
   <details>
   <summary>Answer</summary>
   
   **CP** - Cannot double-book seats. Consistency critical.
   </details>

---

#### **Exercise 2: Design with Tunable Consistency**

```
Design a ride-sharing app (Uber-like):

Features:
1. Driver location updates (every 5 seconds)
2. User requests ride
3. Payment processing
4. Ride history

For each feature, choose:
- CP or AP?
- Consistency level (strong/eventual)?
- Quorum settings (if applicable)?
```

<details>
<summary>Solution</summary>

```
1. Driver Location Updates
   - Choice: AP (eventual consistency)
   - Reasoning: 5-second delay acceptable, availability critical
   - Settings: W=1, R=1 (fast writes, fast reads)
   - Impact: Slightly stale location tolerable

2. Ride Request Matching
   - Choice: CP (strong consistency)
   - Reasoning: Cannot assign driver to multiple riders
   - Settings: W=QUORUM, R=QUORUM
   - Impact: Prevents double-booking

3. Payment Processing
   - Choice: CP (strong consistency)
   - Reasoning: Financial accuracy critical
   - Settings: W=ALL, R=QUORUM (ensure payment recorded)
   - Impact: Slower, but accurate

4. Ride History
   - Choice: AP (eventual consistency)
   - Reasoning: Historical data, not real-time critical
   - Settings: W=1, R=1 (fast logging)
   - Impact: May take seconds to appear in history

Overall Architecture:
- Different features use different databases
- Polyglot persistence strategy
- Each optimized for its CAP requirements
```
</details>

---

## 🎓 Part 1 Summary & Interview Checklist

### **Module 1.1: Networking ✅**
- [ ] Explain HTTP methods and idempotency
- [ ] Describe SSL/TLS handshake
- [ ] Design RESTful APIs with proper status codes
- [ ] Compare WebSocket vs HTTP use cases
- [ ] Explain TCP 3-way handshake
- [ ] Describe DNS resolution flow

### **Module 1.2: Databases ✅**
- [ ] Choose SQL vs NoSQL for scenarios
- [ ] Explain ACID properties with examples
- [ ] Design database indexes effectively
- [ ] Understand normalization (1NF, 2NF, 3NF)
- [ ] Write complex SQL joins
- [ ] Identify NoSQL database types

### **Module 1.3: Caching ✅**
- [ ] Implement LRU cache in O(1)
- [ ] Choose caching pattern for scenarios
- [ ] Design cache invalidation strategy
- [ ] Prevent cache stamp ede
- [ ] Configure Redis cluster
- [ ] Calculate cache hit ratios

### **Module 1.4: Load Balancing ✅**
- [ ] Explain L4 vs L7 load balancing
- [ ] Choose load balancing algorithm
- [ ] Configure Nginx/HAProxy
- [ ] Design health checks
- [ ] Handle session persistence

### **Module 1.5: CAP Theorem ✅**
- [ ] Explain CAP theorem trade-offs
- [ ] Choose CP vs AP for systems
- [ ] Understand quorum reads/writes
- [ ] Design eventual consistency
- [ ] Explain real-world CAP examples

---

## 🚀 Next Steps

**You've mastered Part 1: Foundation & Building Blocks!**

Continue to **Part 2: Scalability & Performance Patterns** to learn:
- Horizontal vs Vertical Scaling
- Database Sharding strategies
- Message Queues (Kafka, RabbitMQ)
- And more...

**Keep practicing!** The exercises in each module are key to interview success.

---

**Memory Aid for Part 1:**
```
Networks: HTTP CRUD (Create Read Update Delete)
Databases: ACID (Atomicity Consistency Isolation Durability)
Caching: CART (Cache-Aside, Around, Read-through, Refresh, Thru-write)
Load Balancing: RLWI (Round-Robin, Least-Conn, Weighted, IP-Hash)
CAP: Choose Any 2 (Consistency, Availability, Partition-tolerance)
```

**Congratulations! You're now ready for system design interviews at FAANG+ level! 🎉**
