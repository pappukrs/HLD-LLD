# Part 2: Scalability & Performance Patterns - Master Guide
## Complete HLD Interview Preparation (Week 3 - 15 hours)

---

## 🎯 **Learning Objectives**
By the end of this module, you will:
- Design systems that scale from 1K to 100M+ users
- Make informed decisions between horizontal vs vertical scaling
- Implement advanced database partitioning strategies
- Architect event-driven systems with message queues
- Optimize global content delivery with CDNs

---

# **Module 2.1: Horizontal vs Vertical Scaling**

## **🔍 Foundational Concepts**

### **What is Scaling?**
Scaling is the ability of a system to handle increased load by adding resources.

**Two fundamental approaches:**
1. **Vertical Scaling (Scale Up)** - Add more power to existing machine
2. **Horizontal Scaling (Scale Out)** - Add more machines

---

## **1️⃣ Vertical Scaling (Scale Up)**

### **Definition**
Adding more resources (CPU, RAM, Storage, Network) to a single server.

### **How It Works**
```
Before: Server with 4 CPU cores, 16GB RAM
After:  Server with 16 CPU cores, 64GB RAM
```

### **Advantages ✅**
- **Simple to implement** - No code changes needed
- **No distributed system complexity** - Single machine simplicity
- **Consistent data** - No data synchronization issues
- **Lower network latency** - All components on same machine
- **Easier debugging** - Single point to monitor

### **Disadvantages ❌**
- **Hardware limits** - Can't scale infinitely (max CPU/RAM available)
- **Single point of failure** - If server dies, entire system down
- **Expensive at scale** - Cost grows exponentially (2x RAM ≠ 2x cost)
- **Downtime during upgrade** - Must stop server to upgrade
- **Vendor lock-in** - Limited by hardware vendor capabilities

### **When to Use Vertical Scaling**
```
✅ Good for:
- Legacy applications (monoliths)
- Databases requiring ACID transactions
- Small to medium traffic (< 10K concurrent users)
- Applications with tight coupling
- Startup phase (simpler to manage)

❌ Avoid for:
- Systems requiring 99.99%+ uptime
- Rapidly growing user base
- Global distributed systems
- Cost-sensitive applications at scale
```

### **Real-World Example**
```
Traditional E-commerce Monolith:
- Start: 4 cores, 16GB RAM → handles 1K users
- Growth: 16 cores, 64GB RAM → handles 5K users
- Limit: 128 cores, 1TB RAM → handles 20K users
- Problem: What if you need to handle 100K users?
```

---

## **2️⃣ Horizontal Scaling (Scale Out)**

### **Definition**
Adding more machines (servers/nodes) to distribute load.

### **How It Works**
```
Before: 1 server handling 10K requests/sec
After:  10 servers each handling 1K requests/sec
```

### **Advantages ✅**
- **No theoretical limit** - Add as many servers as needed
- **High availability** - If one server fails, others continue
- **Cost-effective** - Use commodity hardware
- **Gradual scaling** - Add servers incrementally
- **Better fault tolerance** - Distributed failure impact
- **Geographic distribution** - Servers near users (low latency)

### **Disadvantages ❌**
- **Complex architecture** - Load balancing, service discovery needed
- **Data consistency challenges** - CAP theorem applies
- **Network overhead** - Inter-server communication latency
- **Harder debugging** - Distributed tracing required
- **Development complexity** - Stateless design required

### **When to Use Horizontal Scaling**
```
✅ Good for:
- Web/application servers (stateless)
- Microservices architectures
- High traffic systems (> 50K concurrent users)
- Systems requiring high availability
- Cloud-native applications

❌ Challenging for:
- Monolithic applications
- Systems with heavy state management
- Tightly coupled components
- Real-time consistency requirements
```

---

## **📊 Detailed Comparison Table**

| Aspect | Vertical Scaling | Horizontal Scaling |
|--------|------------------|-------------------|
| **Cost at Small Scale** | Lower ($500/month) | Higher ($300/month × 3 servers) |
| **Cost at Large Scale** | Very High ($50K+/month) | Moderate ($500/month × 100 servers) |
| **Scalability Limit** | Hardware max (~1TB RAM) | Virtually unlimited |
| **Downtime** | Required for upgrades | Zero-downtime deployments |
| **Complexity** | Low (single server) | High (distributed system) |
| **Latency** | Lower (no network hops) | Higher (inter-server communication) |
| **Fault Tolerance** | Single point of failure | Multiple redundancy |
| **Implementation Time** | Hours | Weeks (architecture changes) |
| **Consistency** | Strong | Eventual (often) |
| **Geographic Distribution** | Not possible | Easy to implement |

---

## **🔧 Auto-Scaling Strategies**

### **What is Auto-Scaling?**
Automatically adjusting the number of servers based on demand.

### **Auto-Scaling Components**

```
┌─────────────────────────────────────────┐
│         Monitoring & Metrics            │
│  (CPU, Memory, Request Rate, Latency)   │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│         Auto-Scaling Policy             │
│  • Scale-out triggers (thresholds)      │
│  • Scale-in triggers (thresholds)       │
│  • Cooldown periods                     │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│      Scaling Actions Executor           │
│  • Launch new instances                 │
│  • Terminate instances                  │
│  • Update load balancer                 │
└─────────────────────────────────────────┘
```

### **Auto-Scaling Triggers (When to Scale)**

#### **1. Metric-Based Triggers**
```javascript
// Example: CPU-based scaling
{
  scaleOut: {
    metric: 'CPUUtilization',
    threshold: 70,        // Scale out when CPU > 70%
    period: 300,          // Check every 5 minutes
    evaluationPeriods: 2, // Must breach for 2 consecutive periods
    action: 'add 2 instances'
  },
  scaleIn: {
    metric: 'CPUUtilization',
    threshold: 30,        // Scale in when CPU < 30%
    period: 300,
    evaluationPeriods: 5, // Wait longer before removing (avoid flapping)
    action: 'remove 1 instance'
  }
}
```

**Common Metrics:**
- **CPU Utilization** - % of CPU used (threshold: 60-80%)
- **Memory Usage** - % of RAM used (threshold: 70-85%)
- **Network I/O** - Bandwidth saturation (threshold: 80%)
- **Request Count** - Requests per second (threshold: 1000/server)
- **Response Time** - Average latency (threshold: 500ms)
- **Queue Depth** - Messages waiting (threshold: 100 messages)

#### **2. Schedule-Based Scaling**
```javascript
// Example: Predictable traffic patterns
{
  schedules: [
    {
      time: '08:00',
      timezone: 'UTC',
      minInstances: 10,
      maxInstances: 50,
      description: 'Morning rush (8 AM - 12 PM)'
    },
    {
      time: '00:00',
      minInstances: 2,
      maxInstances: 10,
      description: 'Night time (12 AM - 6 AM)'
    }
  ]
}
```

**Use Cases:**
- E-commerce sales (Black Friday)
- News sites (breaking news)
- Streaming services (prime time evening)
- Business apps (working hours vs weekends)

#### **3. Predictive Scaling (ML-Based)**
```
Uses machine learning to predict future load:
- Analyze historical patterns
- Forecast traffic spikes
- Scale proactively (before load hits)
- AWS Predictive Scaling, Google Cloud AI

Example: Netflix scales up servers before 7 PM (streaming peak)
```

---

## **⚙️ Auto-Scaling Policies**

### **1. Target Tracking Scaling**
```javascript
// Maintain metric at target value
{
  policy: 'TargetTracking',
  targetMetric: 'CPUUtilization',
  targetValue: 60,  // Keep CPU at ~60%
  cooldown: 300     // Wait 5 min between scaling actions
}
```

**How it works:**
- If CPU > 60% → Add servers
- If CPU < 60% → Remove servers
- Simple and automatic

### **2. Step Scaling**
```javascript
// Different actions based on severity
{
  policy: 'StepScaling',
  steps: [
    { metricRange: [70, 80], action: 'add 1 instance' },
    { metricRange: [80, 90], action: 'add 2 instances' },
    { metricRange: [90, 100], action: 'add 5 instances' }
  ]
}
```

**Advantages:**
- Aggressive scaling during emergencies
- Fine-grained control
- Faster response to sudden spikes

### **3. Simple Scaling**
```javascript
// Single threshold
{
  policy: 'SimpleScaling',
  threshold: 80,
  action: 'add 2 instances',
  cooldown: 300
}
```

---

## **🛡️ Stateless vs Stateful Services**

### **Stateless Services**

#### **Definition**
Each request is independent; no session/user data stored on server.

#### **Characteristics**
```
Request 1 → Server A → Response ✅
Request 2 → Server B → Response ✅
Request 3 → Server A → Response ✅

No dependency on which server handles request
```

#### **How to Design Stateless Services**

**1. Store Session Data Externally**
```javascript
// ❌ BAD: Stateful (session in memory)
app.use(session({
  store: new MemoryStore() // Lost if server restarts
}));

// ✅ GOOD: Stateless (session in Redis)
app.use(session({
  store: new RedisStore({
    client: redisClient,
    ttl: 3600
  })
}));
```

**2. Use Tokens for Authentication**
```javascript
// ✅ Stateless authentication with JWT
const token = jwt.sign(
  { userId: 123, email: 'user@example.com' },
  'secret_key',
  { expiresIn: '1h' }
);

// Each request includes token → no server-side session
```

**3. Store Files in Object Storage**
```javascript
// ❌ BAD: File on server disk
fs.writeFileSync('/tmp/upload.jpg', buffer);

// ✅ GOOD: File in S3/Cloud Storage
await s3.putObject({
  Bucket: 'my-bucket',
  Key: 'uploads/file.jpg',
  Body: buffer
});
```

#### **Benefits of Stateless**
- ✅ Easy horizontal scaling (any server can handle any request)
- ✅ Load balancer can distribute randomly
- ✅ Server failures don't lose user sessions
- ✅ Simplified deployment and rollback

---

### **Stateful Services**

#### **Definition**
Server maintains session/user state across requests.

#### **Characteristics**
```
Request 1 → Server A (stores user session) → Response
Request 2 → Server A (must go to same server) → Response

Server B cannot handle Request 2 (no session data)
```

#### **Challenges**
1. **Sticky Sessions Required**
```
Load Balancer must route same user to same server
- Cookie-based routing
- IP hash-based routing
- Problem: Uneven load distribution
```

2. **Scaling Difficulties**
```
- Can't just add servers (session loss)
- Draining servers during scale-down takes time
- Server failure = lost sessions
```

3. **Deployment Complexity**
```
- Rolling updates difficult
- Blue-green deployment requires session migration
```

#### **When Stateful is Acceptable**
- WebSocket connections (chat apps)
- Streaming services
- Gaming servers
- Desktop virtualization (VDI)

#### **Making Stateful Services Scalable**

**1. Session Replication**
```
Server A ←→ Server B (session sync)
↑
Session replicated to all servers
Problem: Network overhead, complexity
```

**2. Sticky Sessions with Session Store**
```
User → Load Balancer (sticky) → Server A
                                    ↓
                              Redis (session backup)

If Server A fails → Route to Server B → Load from Redis
```

---

## **🗄️ Scaling Databases**

### **Why Databases are Hardest to Scale**
```
Stateless services: Easy to add servers
Databases: Data consistency, ACID transactions, single source of truth
```

### **1. Read Replicas (Horizontal Read Scaling)**

#### **Architecture**
```
          ┌─────────────────┐
          │  Write Requests │
          └────────┬────────┘
                   ▼
          ┌────────────────┐
          │ PRIMARY/MASTER │ ←──┐
          │   (Read/Write) │    │
          └────────┬───────┘    │
                   │             │
     ┌─────────────┼─────────────┤ Replication
     │             │             │
     ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│REPLICA 1│  │REPLICA 2│  │REPLICA 3│
│(Read-Only) │(Read-Only) │(Read-Only)│
└─────────┘  └─────────┘  └─────────┘
     ▲             ▲             ▲
     └─────────────┴─────────────┘
          Read Requests
```

#### **How It Works**
```javascript
// Application code
async function getUser(userId) {
  // Read from replica (faster, load distributed)
  return await readReplica.query(
    'SELECT * FROM users WHERE id = ?', 
    [userId]
  );
}

async function updateUser(userId, data) {
  // Write to primary (single source of truth)
  return await primaryDB.query(
    'UPDATE users SET name = ? WHERE id = ?',
    [data.name, userId]
  );
}
```

#### **Benefits**
- ✅ Scale reads to millions of requests
- ✅ Offload analytics queries to replicas
- ✅ Disaster recovery (replicas can be promoted)

#### **Challenges**
- ⚠️ **Replication Lag** - Replica may be seconds behind primary
```javascript
// Problem: Read-your-writes inconsistency
await primaryDB.query('UPDATE users SET status = "active"');
const user = await readReplica.query('SELECT status FROM users WHERE id = 1');
console.log(user.status); // Might still show "inactive"! (lag)
```

**Solution: Read from Primary for Critical Reads**
```javascript
// After write, read from primary
await primaryDB.query('UPDATE users SET status = "active"');
const user = await primaryDB.query('SELECT status FROM users WHERE id = 1');
console.log(user.status); // Guaranteed "active"
```

---

### **2. Database Sharding (Horizontal Write Scaling)**

#### **What is Sharding?**
Splitting database into smaller pieces (shards), each on different server.

```
Before Sharding (Single DB):
┌─────────────────────┐
│  All 100M user rows │
│  (1 server)         │
└─────────────────────┘

After Sharding (4 shards):
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Users 0-24M│ │Users 25-49M│ │Users 50-74M│ │Users 75-99M│
│ Shard 1  │ │  Shard 2  │ │  Shard 3  │ │  Shard 4  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

**Key Concept: Shard Key**
- Column used to determine which shard stores data
- Example: user_id, region, tenant_id

*Detailed coverage in Module 2.2*

---

### **3. Vertical Partitioning (Column-Based Split)**

```
Before:
┌───────────────────────────────────┐
│ users Table                       │
│ id | name | email | profile_pic   │
└───────────────────────────────────┘

After:
┌──────────────────┐   ┌─────────────────┐
│ users_basic      │   │ users_media     │
│ id | name | email│   │ id | profile_pic│
└──────────────────┘   └─────────────────┘
   (Frequently accessed)  (Rarely accessed)
```

**Benefits:**
- Faster queries (fewer columns to scan)
- Store large BLOBs separately
- Different storage engines per table

*Detailed coverage in Module 2.2*

---

## **🚧 Scaling Limitations & Bottlenecks**

### **1. Database Bottleneck (Most Common)**

#### **Symptoms:**
- Slow query response times (> 1s)
- High CPU on database server
- Connection pool exhaustion

#### **Solutions Progression:**

```
Stage 1: Single Database (0-10K users)
└── Optimize queries, add indexes

Stage 2: Read Replicas (10K-100K users)
└── Offload reads to replicas

Stage 3: Caching Layer (100K-1M users)
└── Add Redis/Memcached

Stage 4: Sharding (1M-10M users)
└── Partition data across databases

Stage 5: NoSQL/NewSQL (10M+ users)
└── Consider Cassandra, DynamoDB
```

### **2. Network Bandwidth Bottleneck**

#### **Symptoms:**
- High network I/O saturation
- Slow file downloads
- Packet loss

#### **Solutions:**
```
1. CDN for static content
2. Compress responses (gzip)
3. Upgrade network infrastructure
4. Optimize data transfer (GraphQL instead of REST)
5. WebP images instead of PNG
```

### **3. Memory Bottleneck**

#### **Symptoms:**
- Frequent swapping to disk
- OOM (Out of Memory) errors
- High GC (Garbage Collection) pauses

#### **Solutions:**
```javascript
// 1. Connection pooling
const pool = mysql.createPool({
  connectionLimit: 10, // Don't create unlimited connections
  queueLimit: 0
});

// 2. Streaming large data
app.get('/export', (req, res) => {
  const stream = db.query('SELECT * FROM large_table').stream();
  stream.pipe(res); // Don't load everything in memory
});

// 3. Pagination
app.get('/users', async (req, res) => {
  const page = req.query.page || 1;
  const limit = 100;
  const users = await User.find()
    .limit(limit)
    .skip((page - 1) * limit);
});
```

### **4. Disk I/O Bottleneck**

#### **Symptoms:**
- High disk queue length
- Slow read/write operations

#### **Solutions:**
```
1. SSD instead of HDD
2. Database indexes
3. Asynchronous writes
4. Write batching
5. Use in-memory databases (Redis)
```

### **5. CPU Bottleneck**

#### **Symptoms:**
- High CPU utilization (> 80%)
- Slow request processing

#### **Solutions:**
```javascript
// 1. Offload to workers
const { Worker } = require('worker_threads');

app.post('/process', (req, res) => {
  const worker = new Worker('./cpu-intensive.js');
  worker.postMessage(req.body);
  worker.on('message', result => res.json(result));
});

// 2. Caching computed results
const cache = new Map();

function expensiveOperation(input) {
  if (cache.has(input)) return cache.get(input);
  
  const result = /* expensive computation */;
  cache.set(input, result);
  return result;
}

// 3. Algorithm optimization
// O(n²) → O(n log n) → O(n)
```

---

## **💰 Scaling Costs Calculation**

### **Vertical Scaling Cost Example**

```
Server Tier 1: 4 cores, 16GB RAM = $100/month
Server Tier 2: 8 cores, 32GB RAM = $250/month (2.5x cost)
Server Tier 3: 16 cores, 64GB RAM = $600/month (6x cost)
Server Tier 4: 32 cores, 128GB RAM = $1500/month (15x cost)

Observation: Cost grows exponentially, capacity grows linearly
```

### **Horizontal Scaling Cost Example**

```
1 server: 4 cores, 16GB RAM = $100/month → handles 1K req/s
10 servers: Same specs = $1000/month → handles 10K req/s
100 servers: Same specs = $10,000/month → handles 100K req/s

Observation: Cost grows linearly with capacity
```

### **Break-Even Analysis**

```
Vertical Scaling Cost for 50K req/s:
- Server with 128 cores, 512GB RAM = $8000/month
- Still single point of failure

Horizontal Scaling Cost for 50K req/s:
- 50 servers × $100 = $5000/month
- High availability
- Better value at scale

Conclusion: Horizontal scaling is cheaper at scale
```

---

## **🎯 Practice Problems**

### **Problem 1: Design Auto-Scaling for E-Commerce**

**Scenario:**
- Normal traffic: 10K requests/minute
- Black Friday: 500K requests/minute
- Budget: $10,000/month
- Server: $100/month, handles 5K req/min

**Your Task:**
Design an auto-scaling policy.

**Solution:**
```javascript
{
  normalLoad: {
    minInstances: 2,  // Redundancy
    maxInstances: 5,
    targetCPU: 60
  },
  blackFriday: {
    schedule: '2024-11-24 00:00',
    minInstances: 50,  // Pre-scale before event
    maxInstances: 100,
    targetCPU: 70,
    duration: 48hours
  },
  costOptimization: {
    scaleDownDelay: 600, // Wait 10 min before removing (avoid flapping)
    spotInstances: true  // Use cheaper spot instances (30-90% cheaper)
  }
}
```

### **Problem 2: Migrate Stateful to Stateless**

**Before (Stateful):**
```javascript
const sessions = {}; // In-memory session store

app.post('/login', (req, res) => {
  const sessionId = generateId();
  sessions[sessionId] = { userId: req.body.userId };
  res.cookie('sessionId', sessionId);
});

app.get('/profile', (req, res) => {
  const session = sessions[req.cookies.sessionId];
  res.json({ user: session.userId });
});
```

**Problem:** Can't scale horizontally (session lost if different server)

**After (Stateless):**
```javascript
const redis = require('redis').createClient();

app.post('/login', async (req, res) => {
  const token = jwt.sign({ userId: req.body.userId }, 'secret');
  await redis.setex(`session:${token}`, 3600, req.body.userId);
  res.json({ token });
});

app.get('/profile', async (req, res) => {
  const token = req.headers.authorization;
  const userId = await redis.get(`session:${token}`);
  res.json({ user: userId });
});
```

**Benefits:** Any server can handle any request

---

## **🧠 Mnemonics & Memory Aids**

### **Horizontal vs Vertical Scaling**
```
"HORizontal = MORE machines (Better for growth)"
"VERTical = VERT (upward) = Bigger machine (Limits)"
```

### **When to Scale Horizontally**
```
"S.H.A.R.E. = Scale Horizontally"
S - Stateless services
H - High availability needed
A - Auto-scaling required
R - Rapid growth expected
E - Economics (cost-effective at scale)
```

### **Auto-Scaling Metrics**
```
"C.M.N.R.Q. = Common Metrics"
C - CPU utilization
M - Memory usage
N - Network I/O
R - Request count
Q - Queue depth
```

### **Stateless Design**
```
"T.E.S.T. = Stateless"
T - Tokens (JWT) for auth
E - External storage (Redis, S3)
S - Session in database
T - Twelve-factor app principles
```

---

## **📝 Interview Questions & Answers**

### **Q1: When would you choose vertical scaling over horizontal scaling?**

**Answer:**
```
Choose Vertical Scaling when:
1. Legacy monolithic application (can't easily modify)
2. Database with strong ACID requirements (PostgreSQL OLTP)
3. Small to medium scale (< 10K concurrent users)
4. Tight coupling between components
5. Startup phase (team lacks distributed systems expertise)

Example: A traditional CRM system with complex transactions 
might vertically scale from 8GB → 64GB RAM before considering 
horizontal scaling due to application architecture constraints.
```

### **Q2: How do you handle session management in horizontally scaled systems?**

**Answer:**
```
Three approaches:

1. Sticky Sessions (not recommended)
   - Load balancer routes user to same server
   - Problem: Uneven load, server failure = lost session

2. Centralized Session Store (recommended)
   - Store sessions in Redis/Memcached
   - All servers share same session data
   - Fast, scalable, fault-tolerant

3. Stateless Tokens (best)
   - Use JWT (JSON Web Tokens)
   - No server-side session storage
   - Client includes token in every request

Implementation:
```javascript
// JWT-based stateless auth
const token = jwt.sign(
  { userId: 123, role: 'admin' },
  'secret',
  { expiresIn: '1h' }
);

// Every request validates token (no database lookup)
const decoded = jwt.verify(token, 'secret');
```
```

### **Q3: What is replication lag and how do you handle it?**

**Answer:**
```
Replication Lag = Time delay between write on primary and 
availability on replica

Causes:
- Network latency between primary and replica
- High write volume on primary
- Slow replica hardware

Solutions:
1. Read from Primary for critical reads (read-your-writes)
2. Use synchronous replication (slower but consistent)
3. Application-level retry logic
4. Show stale data with timestamp/warning

Example:
```javascript
async function getProfile(userId) {
  const recentWrite = cache.get(`recent_write:${userId}`);
  
  if (recentWrite) {
    // Written in last 5 sec → read from primary
    return primaryDB.query('SELECT * FROM users WHERE id = ?', [userId]);
  }
  
  // Old data → safe to read from replica
  return replicaDB.query('SELECT * FROM users WHERE id = ?', [userId]);
}
```
```

### **Q4: Calculate scaling costs for 1M concurrent users**

**Problem:**
- Each server handles 10K concurrent users
- Server cost: $200/month
- Load balancer: $50/month
- How many servers needed? Total cost?

**Answer:**
```
Servers needed = 1,000,000 / 10,000 = 100 servers

Total cost:
- Servers: 100 × $200 = $20,000/month
- Load balancer: $50/month
- Total: $20,050/month

With auto-scaling (average 60% utilization):
- Average servers: 100 × 0.6 = 60 servers
- Cost: 60 × $200 + $50 = $12,050/month
- Savings: $8,000/month (40%)
```

---

# **Module 2.2: Database Sharding & Partitioning**

## **🔍 Foundational Concepts**

### **Why Sharding?**

**The Problem:**
```
Single Database Limitations:
- Storage: Max 16TB (practical limit)
- Throughput: ~10K writes/sec
- Latency: Increases with data size
- Cost: Expensive to scale vertically

Example:
Instagram (2B users) × 500 posts/user = 1 Trillion rows
Cannot fit in single database!
```

**The Solution: Sharding**
```
Split data across multiple databases (shards)
Each shard: Independent database server
Combined: Near-infinite scalability
```

---

## **1️⃣ Horizontal Partitioning (Sharding)**

### **Definition**
Splitting table rows across multiple databases based on a **shard key**.

### **Visual Example**
```
Original Table (Single DB):
┌────┬───────┬─────────┐
│ ID │ Name  │ Country │
├────┼───────┼─────────┤
│ 1  │ Alice │ US      │
│ 2  │ Bob   │ UK      │
│ 3  │ Carol │ US      │
│ 4  │ Dave  │ IN      │
└────┴───────┴─────────┘

After Sharding by user_id (2 shards):
Shard 1 (ID % 2 == 0):
┌────┬──────┬─────────┐
│ 2  │ Bob  │ UK      │
│ 4  │ Dave │ IN      │
└────┴──────┴─────────┘

Shard 2 (ID % 2 == 1):
┌────┬───────┬─────────┐
│ 1  │ Alice │ US      │
│ 3  │ Carol │ US      │
└────┴───────┴─────────┘
```

---

## **2️⃣ Vertical Partitioning (Columnar Split)**

### **Definition**
Splitting table columns across databases.

### **Visual Example**
```
Original Table:
┌────┬───────┬───────┬─────────────┬────────────┐
│ ID │ Name  │ Email │ Profile_Pic │ Last_Login │
└────┴───────┴───────┴─────────────┴────────────┘

After Vertical Partitioning:

DB1 (Hot Data - Frequently Accessed):
┌────┬───────┬───────┬────────────┐
│ ID │ Name  │ Email │ Last_Login │
└────┴───────┴───────┴────────────┘

DB2 (Cold Data - Rarely Accessed):
┌────┬─────────────┐
│ ID │ Profile_Pic │ (Large BLOB)
└────┴─────────────┘
```

### **When to Use Vertical Partitioning**
```
✅ Use when:
- Some columns accessed much more than others
- Large BLOBs (images, videos) slow down queries
- Different access patterns for different column groups
- Want to separate hot data from cold data

❌ Avoid when:
- Queries need all columns frequently (lots of joins)
- Columns are equally accessed
```

**Benefits:**
- Improved query performance (scan fewer columns)
- Better index efficiency
- Separate storage engines (InnoDB for structured, MyISAM for BLOBs)
- Easier to scale specific data types

**Example:**
```javascript
// Before: Single query with large BLOB
const user = await db.query(
  'SELECT id, name, email, profile_pic, settings FROM users WHERE id = ?',
  [userId]
);
// Returns 5MB profile_pic even if not needed!

// After: Split queries
const basicInfo = await db.query(
  'SELECT id, name, email FROM users_basic WHERE id = ?',
  [userId]
);
// Only fetch media when needed
if (needProfilePic) {
  const media = await db.query(
    'SELECT profile_pic FROM users_media WHERE id = ?',
    [userId]
  );
}
```

---

## **🔑 Sharding Strategies**

### **1. Range-Based Sharding**

#### **How It Works**
```
Shard Key: user_id (numeric)

Shard 1: user_id 1 - 1,000,000
Shard 2: user_id 1,000,001 - 2,000,000
Shard 3: user_id 2,000,001 - 3,000,000
```

#### **Implementation**
```javascript
function getShard(userId) {
  const SHARD_SIZE = 1_000_000;
  const shardNum = Math.floor(userId / SHARD_SIZE);
  return shardConnections[shardNum];
}

// Usage
const shard = getShard(1_500_000); // Returns Shard 2
const user = await shard.query('SELECT * FROM users WHERE id = ?', [1_500_000]);
```

#### **Advantages ✅**
- **Simple to implement** - Easy range calculations
- **Range queries efficient** - "Get users 100-200" stays on one shard
- **Easy to add shards** - Just extend range
- **Ordered data** - Chronological queries fast

#### **Disadvantages ❌**
- **Uneven distribution** - Newer users (higher IDs) may be more active
- **Hotspots** - Latest shard gets most writes
- **Difficult rebalancing** - Can't easily move ranges

#### **When to Use**
```
✅ Good for:
- Time-series data (logs, events)
- Sequential IDs
- Range queries common
- Predictable growth patterns

Example: Log aggregation system
- Shard 1: Jan 2024 logs
- Shard 2: Feb 2024 logs
- Shard 3: Mar 2024 logs
```

---

### **2. Hash-Based Sharding**

#### **How It Works**
```
Shard Key: user_id
Hash Function: hash(user_id) % num_shards

Example with 4 shards:
hash(123) % 4 = 3 → Shard 3
hash(456) % 4 = 0 → Shard 0
hash(789) % 4 = 1 → Shard 1
```

#### **Implementation**
```javascript
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function getShard(userId) {
  const NUM_SHARDS = 4;
  const shardNum = simpleHash(userId.toString()) % NUM_SHARDS;
  return shardConnections[shardNum];
}

// Usage
const shard = getShard(12345); // Deterministically routes to same shard
const user = await shard.query('SELECT * FROM users WHERE id = ?', [12345]);
```

#### **Advantages ✅**
- **Even distribution** - Data spread uniformly across shards
- **No hotspots** - Random distribution prevents hot shards
- **Simple logic** - Just hash and modulo

#### **Disadvantages ❌**
- **Range queries impossible** - "user_id 100-200" scattered across all shards
- **Resharding is expensive** - Changing num_shards requires moving all data
- **Related data scattered** - User's posts might be on different shards

#### **When to Use**
```
✅ Good for:
- Point queries (lookup by ID)
- Uniform access patterns
- No range query requirements
- Stable number of shards

Example: User authentication system
- Only need "get user by ID"
- No range queries needed
- Even load across all shards
```

**Problem: Resharding with Simple Hashing**
```javascript
// With 4 shards:
hash(user_123) % 4 = 3 → Shard 3

// Add 5th shard (now 5 total):
hash(user_123) % 5 = 2 → Shard 2 ❌

// Problem: user_123 moved from Shard 3 to Shard 2
// Must migrate data for almost ALL users!
```

**Solution: Consistent Hashing** (next section)

---

### **3. Geographic Sharding**

#### **How It Works**
```
Shard Key: user_region

Shard 1 (US-East): Users in New York, Boston, Miami
Shard 2 (US-West): Users in San Francisco, LA, Seattle
Shard 3 (Europe): Users in London, Paris, Berlin
Shard 4 (Asia): Users in Tokyo, Singapore, Mumbai
```

#### **Implementation**
```javascript
const REGION_SHARDS = {
  'us-east': 'shard-us-east.db.example.com',
  'us-west': 'shard-us-west.db.example.com',
  'europe': 'shard-eu.db.example.com',
  'asia': 'shard-asia.db.example.com'
};

function getShard(userRegion) {
  return connectToDatabase(REGION_SHARDS[userRegion]);
}

// Usage
const user = { id: 123, region: 'europe' };
const shard = getShard(user.region);
const userData = await shard.query('SELECT * FROM users WHERE id = ?', [user.id]);
```

#### **Advantages ✅**
- **Low latency** - Data stored near users (reduced network hops)
- **Data locality** - Compliance with regional regulations (GDPR)
- **Disaster recovery** - Regional isolation
- **Customization** - Different features per region

#### **Disadvantages ❌**
- **Uneven distribution** - Some regions have more users
- **User migration** - If user moves, data must migrate
- **Cross-region queries** - Expensive multi-shard queries

#### **When to Use**
```
✅ Good for:
- Global applications (social media, streaming)
- Data residency requirements
- High latency sensitivity
- Regional features

Example: Netflix
- US users → US shards (faster streaming)
- EU users → EU shards (GDPR compliance)
- Asia users → Asia shards (low latency)
```

---

### **4. Directory-Based Sharding**

#### **How It Works**
```
Maintain a lookup table (directory) that maps keys to shards

Directory Table:
┌─────────┬────────┐
│ user_id │ shard  │
├─────────┼────────┤
│ 123     │ shard1 │
│ 456     │ shard2 │
│ 789     │ shard1 │
└─────────┴────────┘
```

#### **Implementation**
```javascript
// Directory stored in fast lookup service (Redis)
async function getShard(userId) {
  // 1. Check cache
  let shardId = await redis.get(`user:${userId}:shard`);
  
  if (!shardId) {
    // 2. Query directory database
    const result = await directoryDB.query(
      'SELECT shard_id FROM user_shard_mapping WHERE user_id = ?',
      [userId]
    );
    shardId = result.shard_id;
    
    // 3. Cache for future lookups
    await redis.setex(`user:${userId}:shard`, 3600, shardId);
  }
  
  return shardConnections[shardId];
}

// Usage
const shard = await getShard(123);
const user = await shard.query('SELECT * FROM users WHERE id = ?', [123]);
```

#### **Advantages ✅**
- **Flexible routing** - Can use any logic to assign shards
- **Easy rebalancing** - Just update directory entries
- **Hotspot handling** - Move hot users to dedicated shard
- **Custom strategies** - VIP users on high-performance shards

#### **Disadvantages ❌**
- **Extra lookup** - Directory query adds latency
- **Directory as bottleneck** - Directory must be highly available
- **Consistency** - Directory must stay in sync with shards
- **Complexity** - Additional component to maintain

#### **When to Use**
```
✅ Good for:
- Dynamic sharding requirements
- Frequent rebalancing needed
- **VIP/tenant isolation** (multi-tenant SaaS)
- Complex routing logic

Example: Multi-tenant SaaS
- tenant_A (small) → shared_shard_1
- tenant_B (large) → dedicated_shard_2
- tenant_C (small) → shared_shard_1
```

---

## **⚖️ Consistent Hashing (Deep Dive)**

### **The Problem with Simple Hashing**

```
Simple Hash: hash(key) % N

With 4 servers:
key_A: hash(A) % 4 = 2 → Server 2 ✅

Add 5th server (now 5 total):
key_A: hash(A) % 5 = 3 → Server 3 ❌

Problem: Adding/removing servers requires remapping ~80% of keys!
```

### **Consistent Hashing Solution**

#### **Concept: Hash Ring**

```
        0°
        |
   270° | 90°
        |
       180°

Servers placed on ring:
- Server A: hash("server_A") → 45°
- Server B: hash("server_B") → 120°
- Server C: hash("server_C") → 270°

Keys placed on ring, assigned to next server clockwise:
- key_1: hash("key_1") → 30° → Server A (next at 45°)
- key_2: hash("key_2") → 100° → Server B (next at 120°)
- key_3: hash("key_3") → 200° → Server C (next at 270°)
```

#### **Complete Implementation**

```javascript
class ConsistentHash {
  constructor(replicaCount = 150) {
    this.replicaCount = replicaCount; // Virtual nodes per server
    this.ring = new Map(); // Sorted map of hash → server
    this.sortedHashes = []; // Sorted array of hash values
    this.servers = new Set();
  }
  
  hash(key) {
    // Simple hash function (use better hash in production)
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash) + key.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  addServer(server) {
    if (this.servers.has(server)) return;
    
    this.servers.add(server);
    
    // Create virtual nodes (replicas) for even distribution
    for (let i = 0; i < this.replicaCount; i++) {
      const virtualKey = `${server}:${i}`;
      const hashValue = this.hash(virtualKey);
      this.ring.set(hashValue, server);
      this.sortedHashes.push(hashValue);
    }
    
    // Keep hashes sorted for binary search
    this.sortedHashes.sort((a, b) => a - b);
  }
  
  removeServer(server) {
    if (!this.servers.has(server)) return;
    
    this.servers.delete(server);
    
    // Remove all virtual nodes
    for (let i = 0; i < this.replicaCount; i++) {
      const virtualKey = `${server}:${i}`;
      const hashValue = this.hash(virtualKey);
      this.ring.delete(hashValue);
      
      const index = this.sortedHashes.indexOf(hashValue);
      if (index > -1) {
        this.sortedHashes.splice(index, 1);
      }
    }
  }
  
  getServer(key) {
    if (this.ring.size === 0) return null;
    
    const hashValue = this.hash(key);
    
    // Binary search for next server clockwise
    let left = 0;
    let right = this.sortedHashes.length - 1;
    
    if (hashValue > this.sortedHashes[right]) {
      // Wrap around to first server
      return this.ring.get(this.sortedHashes[0]);
    }
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.sortedHashes[mid] < hashValue) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    return this.ring.get(this.sortedHashes[left]);
  }
}

// Usage Example
const ch = new ConsistentHash(150); // 150 virtual nodes per server

// Add servers
ch.addServer('server_A');
ch.addServer('server_B');
ch.addServer('server_C');

// Route keys
console.log(ch.getServer('user_123')); // server_B
console.log(ch.getServer('user_456')); // server_A
console.log(ch.getServer('user_789')); // server_C

// Add new server - only ~25% of keys remapped!
ch.addServer('server_D');

console.log(ch.getServer('user_123')); // Still server_B (stable!)
console.log(ch.getServer('user_456')); // Still server_A
console.log(ch.getServer('user_789')); // Might move to server_D
```

#### **Why Virtual Nodes (Replicas)?**

```
Without Virtual Nodes:
- 3 servers on ring
- Might cluster together (uneven distribution)
- Server A: 10° , Server B: 15°, Server C: 200°
- Server C handles 195° of ring (too much!)

With 150 Virtual Nodes Each:
- Each server has 150 positions on ring
- Better distribution (450 total points)
- Each server handles ~33% of ring (even!)
```

#### **Benefits of Consistent Hashing**

```
✅ Minimal remapping when adding/removing servers
   - Add server: Only K/N keys move (K=total keys, N=servers)
   - Simple hash: ~(N-1)/N keys move (~80% with 5 servers)

✅ Even load distribution (with virtual nodes)
✅ No hotspots
✅ Scalable to thousands of servers
✅ Used by: Cassandra, DynamoDB, Memcached, Redis Cluster
```

---

## **🔄 Resharding & Rebalancing Challenges**

### **When to Reshard**

```
1. Data growth exceeds shard capacity
   - Shard 1: 900GB of 1TB limit ⚠️
   
2. Uneven load distribution
   - Shard 1: 90% CPU
   - Shard 2: 20% CPU
   - Shard 3: 15% CPU
   
3. Hotspots detected
   - Celebrity user on one shard (viral tweet)
   
4. Adding new regions
   - Expanding to new geographic market
```

### **Resharding Strategies**

#### **1. Stop-and-Copy (Downtime)**

```
1. Put application in maintenance mode
2. Copy data to new shards
3. Update routing logic
4. Bring application back online

Downtime: Hours to days (unacceptable for most apps)
```

#### **2. Dual-Write (Zero Downtime)**

```
Phase 1: Setup
- Add new shards
- Keep old shards active

Phase 2: Dual-Write
- Write to BOTH old and new shards
- Read from old shards

Phase 3: Backfill
- Copy historical data to new shards
- Progress: 0% → 100%

Phase 4: Switch Read Traffic
- Start reading from new shards
- Keep dual-writing for safety

Phase 5: Cleanup
- Stop writing to old shards
- Decommission old shards

Downtime: Zero! But complex implementation
```

**Implementation:**
```javascript
class DualWriteSharding {
  constructor() {
    this.migrationMode = 'DUAL_WRITE'; // DUAL_WRITE, READ_NEW, COMPLETE
    this.oldSharding = new SimpleSharding(4);
    this.newSharding = new ConsistentHashSharding(8);
  }
  
  async write(key, value) {
    if (this.migrationMode === 'DUAL_WRITE' || this.migrationMode === 'READ_NEW') {
      // Write to both old and new
      await Promise.all([
        this.oldSharding.write(key, value),
        this.newSharding.write(key, value)
      ]);
    } else {
      // Migration complete - only new
      await this.newSharding.write(key, value);
    }
  }
  
  async read(key) {
    if (this.migrationMode === 'DUAL_WRITE') {
      // Read from old (backfill in progress)
      return await this.oldSharding.read(key);
    } else {
      // Read from new (backfill complete)
      return await this.newSharding.read(key);
    }
  }
}
```

---

### **Handling Hotspots**

#### **Problem: Celebrity User**

```
User @elonmusk tweets
↓
100M followers request fanout
↓
Shard containing @elonmusk overwhelmed
↓
Slow writes, connection pool exhaustion
```

#### **Solutions**

**1. Dedicated Shard for Hot Keys**
```javascript
const HOT_USERS = new Set(['elonmusk', 'cristiano', 'taylorswift']);

function getShard(userId) {
  if (HOT_USERS.has(userId)) {
    return shards.dedicated_celebrity_shard; // High-performance shard
  }
  return shards[hash(userId) % NUM_SHARDS];
}
```

**2. Caching Layer**
```javascript
// Celebrity data cached aggressively
const CACHE_TTL = {
  normal_user: 300,     // 5 minutes
  celebrity: 3600,      // 1 hour
  viral_content: 7200   // 2 hours
};
```

**3. Read Replicas for Hot Shard**
```
Hot Shard:
  Primary (writes)
  ├── Replica 1 (reads)
  ├── Replica 2 (reads)
  ├── Replica 3 (reads)
  └── Replica 4 (reads)
```

---

## **🔗 Cross-Shard Queries & Joins**

### **The Problem**

```sql
-- This query spans all shards!
SELECT u.name, p.title
FROM users u
JOIN posts p ON u.id = p.user_id
WHERE p.likes > 1000;

-- Must:
-- 1. Query all shards for posts with likes > 1000
-- 2. Collect results
-- 3. For each post, find user (might be on different shard)
-- 4. Join results in application layer
```

### **Solutions**

#### **1. Denormalization (Recommended)**

```sql
-- Instead of separate tables, duplicate data
CREATE TABLE posts (
  id BIGINT,
  user_id BIGINT,
  user_name VARCHAR(255),  -- Denormalized!
  title TEXT,
  likes INT
);

-- Now single-shard query
SELECT user_name, title
FROM posts
WHERE likes > 1000;
```

**Trade-off:** Storage cost vs query performance

---

#### **2. Application-Level Join**

```javascript
async function getCrossShardData() {
  // Step 1: Query all shards for posts
  const allPosts = [];
  for (const shard of shards) {
    const posts = await shard.query(
      'SELECT user_id, title, likes FROM posts WHERE likes > 1000'
    );
    allPosts.push(...posts);
  }
  
  // Step 2: Extract unique user IDs
  const userIds = [...new Set(allPosts.map(p => p.user_id))];
  
  // Step 3: Batch fetch users (group by shard)
  const usersByShard = {};
  for (const userId of userIds) {
    const shardId = getShard(userId);
    if (!usersByShard[shardId]) usersByShard[shardId] = [];
    usersByShard[shardId].push(userId);
  }
  
  const users = {};
  for (const [shardId, ids] of Object.entries(usersByShard)) {
    const shard = shards[shardId];
    const results = await shard.query(
      `SELECT id, name FROM users WHERE id IN (${ids.join(',')})`
    );
    results.forEach(user => users[user.id] = user);
  }
  
  // Step 4: Join in application
  return allPosts.map(post => ({
    user_name: users[post.user_id].name,
    title: post.title,
    likes: post.likes
  }));
}
```

**Problems:**
- Slow (N+1 query problem)
- Memory intensive
- No database-level optimizations

---

#### **3. Shard Co-location**

```
Principle: Keep related data on same shard

Sharding Key: user_id (not post_id)

Shard 1:
  users WHERE user_id % 4 = 0
  posts WHERE user_id % 4 = 0  ← Co-located!

Shard 2:
  users WHERE user_id % 4 = 1
  posts WHERE user_id % 4 = 1
```

**Now joins are local:**
```sql
-- Single-shard query
SELECT u.name, p.title
FROM users u
JOIN posts p ON u.id = p.user_id
WHERE p.user_id = 123 AND p.likes > 1000;
```

**Limitation:** Only works if queries always filter by shard key

---

## **📋 Practice Problems**

### **Problem 1: Design Sharding for Instagram**

**Requirements:**
- 2B users
- 100B photos
- Queries:
  - Get user by ID
  - Get user's photos
  - Get photo by ID

**Your Design:**
<details>
<summary>Solution</summary>

```
Sharding Strategy: Hash-based on user_id

Tables:
1. users (sharded by user_id)
   - Shard key: hash(user_id) % 1000 shards
   
2. photos (sharded by user_id, NOT photo_id)
   - Shard key: hash(user_id) % 1000 shards
   - Why: Co-locate user's photos on same shard

3. photo_lookup (directory table, separate)
   - Maps photo_id → user_id
   - Small table (just IDs), can use Redis

Query Patterns:

1. Get user by ID:
   shard = hash(user_id) % 1000
   SELECT * FROM users WHERE id = user_id
   
2. Get user's photos:
   shard = hash(user_id) % 1000
   SELECT * FROM photos WHERE user_id = user_id
   (Single shard - fast!)
   
3. Get photo by ID:
   user_id = redis.get(f"photo:{photo_id}:user")
   shard = hash(user_id) % 1000
   SELECT * FROM photos WHERE id = photo_id

Benefits:
- User and their photos on same shard (no cross-shard joins)
- Scales to billions of photos
- Even distribution with hash-based sharding
```
</details>

---

### **Problem 2: Implement Consistent Hashing**

**Task:** Extend the ConsistentHash class to track key distribution

<details>
<summary>Solution</summary>

```javascript
class ConsistentHashWithStats extends ConsistentHash {
  constructor(replicaCount = 150) {
    super(replicaCount);
    this.keyDistribution = new Map(); // server → count
  }
  
  getServer(key) {
    const server = super.getServer(key);
    this.keyDistribution.set(
      server,
      (this.keyDistribution.get(server) || 0) + 1
    );
    return server;
  }
  
  getStats() {
    const total = Array.from(this.keyDistribution.values())
      .reduce((sum, count) => sum + count, 0);
    
    const stats = {};
    for (const [server, count] of this.keyDistribution.entries()) {
      stats[server] = {
        count,
        percentage: ((count / total) * 100).toFixed(2) + '%'
      };
    }
    return stats;
  }
}

// Test distribution
const ch = new ConsistentHashWithStats(150);
ch.addServer('A');
ch.addServer('B');
ch.addServer('C');

for (let i = 0; i < 10000; i++) {
  ch.getServer(`key_${i}`);
}

console.log(ch.getStats());
// { A: { count: 3342, percentage: '33.42%' },
//   B: { count: 3301, percentage: '33.01%' },
//   C: { count: 3357, percentage: '33.57%' } }
// Nearly perfect 33/33/33 split!
```
</details>

---

### **Problem 3: Handle Hotspot**

**Scenario:**
- User @celebrity has 100M followers
- Normal users have avg 500 followers
- Sharded by user_id
- @celebrity causes shard overload

**Design a solution:**

<details>
<summary>Solution</summary>

```javascript
// Multi-tier approach

class HotspotAwareSharding {
  constructor() {
    this.normalShards = createShards(100);  // Normal users
    this.hotShard = createShard('hot');      // Celebrities
    this.ultraHotShard = createShard('ultra'); // Ultra viral
    this.hotUsers = new Set();
    this.ultraHotUsers = new Set();
  }
  
  async write(userId, data) {
    const shard = this.getShard(userId);
    
    // Write with priority based on tier
    if (this.ultraHotUsers.has(userId)) {
      await shard.query(data, { priority: 'HIGHEST' });
    } else if (this.hotUsers.has(userId)) {
      await shard.query(data, { priority: 'HIGH' });
    } else {
      await shard.query(data, { priority: 'NORMAL' });
    }
  }
  
  getShard(userId) {
    // Route based on follower count
    if (this.ultraHotUsers.has(userId)) {
      return this.ultraHotShard;  // Dedicated high-perf shard
    }
    if (this.hotUsers.has(userId)) {
      return this.hotShard;  // Shared celebrity shard
    }
    return this.normalShards[hash(userId) % 100];
  }
  
  async detectHotspots() {
    // Run periodically to identify hot users
    const stats = await this.monitor.getMetrics();
    
    for (const [userId, metrics] of stats.entries()) {
      if (metrics.followers > 50_000_000) {
        this.ultraHotUsers.add(userId);
        await this.migrateUser(userId, this.ultraHotShard);
      } else if (metrics.followers > 1_000_000) {
        this.hotUsers.add(userId);
        await this.migrateUser(userId, this.hotShard);
      }
    }
  }
}

// Additional optimization: Caching
const cache = new LRUCache(10000);

async function getUser(userId) {
  // Hot users cached longer
  const ttl = hotUsers.has(userId) ? 3600 : 300;
  
  let user = cache.get(userId);
  if (!user) {
    const shard = getShard(userId);
    user = await shard.query('SELECT * FROM users WHERE id = ?', [userId]);
    cache.set(userId, user, ttl);
  }
  return user;
}
```
</details>

---

## **🧠 Memory Aids**

### **Sharding Strategies**
```
"R.H.G.D. = Sharding Methods"
R - Range-based (time-series, sequential)
H - Hash-based (even distribution)
G - Geographic (data locality)
D - Directory-based (flexibility)
```

### **When to Use Each**
```
"R.R.C.C. = Range or Hash"
Range if: Range queries, Rate of growth predictable
Hash if: Consistent distribution, Cardinality high
```

### **Consistent Hashing Benefits**
```
"M.E.S.S. = Why Consistent Hashing"
M - Minimal remapping (only K/N keys)
E - Even distribution (virtual nodes)
S - Scalable (add/remove servers easily)
S - Stable (same key always same server)
```

---

## **📝 Interview Q&A**

### **Q1: How would you shard Twitter's users table?**

**Answer:**
```
Requirements Analysis:
- 500M active users
- Queries: Get user by ID, Get user's tweets
- No range queries needed

Chosen Strategy: Hash-based sharding on user_id

Why:
1. Even distribution (no hotspots initially)
2. Only point queries (no range needed)
3. Simple implementation

Number of Shards:
- Each shard: ~10M users max
- 500M / 10M = 50 shards minimum
- Plan for growth: 100 shards

Shard Key: hash(user_id) % 100

Co-location:
- users table: Sharded by user_id
- tweets table: Sharded by author_id (NOT tweet_id)
- Why: Can query "get user X's tweets" on single shard

Hotspot Handling:
- Identify celebrities (> 10M followers)
- Move to dedicated high-performance shards
- Aggressive caching for celebrity data

Consistent Hashing:
- Use for future scalability
- Can add shards with minimal data movement
```### **Q2: Explain consistent hashing and when to use it**

**Answer:**
```
Consistent Hashing: Technique to distribute keys across servers such that
adding/removing servers causes minimal key remapping.

How it works:
1. Hash servers onto a ring (0-360°)
2. Hash keys onto same ring
3. Assign each key to next server clockwise
4. Use virtual nodes (150+) for even distribution

Without consistent hashing:
- Add server: 80% of keys remapped
- Expensive data migration

With consistent hashing:  
- Add server: Only ~25% of keys remapped
- Minimal data movement

When to use:
✅ Distributed caching (Memcached, Redis Cluster)
✅ Database sharding with frequent rebalancing
✅ Load balancing with dynamic server pools
✅ CDN server selection

Real-world usage:
- Cassandra: Data distribution across nodes
- DynamoDB: Partition key routing
- Redis Cluster: Key-slot mapping
- Memcached: Key-server mapping
```

### **Q3: How do you handle cross-shard transactions?**

**Answer:**
```
Cross-shard transactions are challenging. Options:

1. Avoid them (best):
   - Shard by tenant_id (all tenant data on one shard)
   - Co-locate related tables (same shard key)
   
2. Two-Phase Commit (2PC):
   Phase 1: Prepare
   - Coordinator asks all shards: "Can you commit?"
   - Each shard locks resources, responds yes/no
   
   Phase 2: Commit
   - If all yes → Coordinator tells all to commit
   - If any no → Coordinator tells all to rollback
   
   Problems:
   - Blocking protocol (locks held during network)
   - Coordinator is single point of failure
   - Slow (2 round trips)
   
3. Saga Pattern (eventual consistency):
   - Break into local transactions
   - Each step has compensating transaction
   - If step fails, run compensating transactions backwards
   
   Example: Order placement
   ```javascript
   // Forward transactions
   step1: Reserve inventory (Shard A)
   step2: Charge payment (Shard B)
   step3: Create order (Shard C)
   
   // If step3 fails:
   compensate_step2: Refund payment (Shard B)
   compensate_step1: Release inventory (Shard A)
   ```
   
   Benefits: No blocking, eventually consistent
   Trade-off: Complex, temporary inconsistency
```

---

# **Module 2.3: Database Replication**

## **🔄 Replication Fundamentals**

### **Why Replication?**

```
Problems with Single Database:
1. Single point of failure (downtime = data loss)
2. Limited read capacity
3. No disaster recovery
4. Backup downtime required
5. Geographical latency

Solution: Replication
- Multiple copies of same data
- On different servers
- Synchronized continuously
```

---

## **1️⃣ Master-Slave Replication**

### **Architecture**

```
          ┌──────────────────┐
          │   APPLICATION    │
          └──────────┬───────┘
                     │
          ┌──────────┼───────────┐
          │          │           │
    Writes│     Reads│           │ Reads
          │          │           │
          ▼          ▼           ▼
    ┌─────────┐  ┌──────┐   ┌──────┐
    │ MASTER  │  │SLAVE1│   │SLAVE2│
    │(Primary)│  │      │   │      │
    └────┬────┘  └──────┘   └──────┘
         │           ▲          ▲
         │  Replication         │
         └──────────┴──────────┘
```

### **How It Works**

```
1. Write to Master
   Client → Master: INSERT INTO users ...
   Master writes to own database
   
2. Master logs change
   Master appends to binary log (binlog)
   
3. Slaves pull changes
   Slaves request binlog from Master
   Master streams binlog to Slaves
   
4. Slaves apply changes
   Slaves execute same SQL queries
```

---

### **Replication Modes**

#### **1. Asynchronous Replication (Default)**

```
Timeline:
T0: Client sends write to Master
T1: Master writes to disk → Returns success to client ✅
T2: Master appends to binlog
T3: Slave pulls binlog
T4: Slave applies changes

Client gets success BEFORE slaves replicate!
```

**Advantages:**
- ✅ Fast writes (no waiting for slaves)
- ✅ High throughput

**Disadvantages:**
- ❌ **Data loss risk** - If master crashes between T1-T4, slaves don't have latest data
- ❌ Replication lag (seconds to minutes)

**When to use:**
- Read-heavy workloads
- Can tolerate some data loss
- Performance > consistency

---

#### **2. Synchronous Replication**

```
Timeline:
T0: Client sends write to Master
T1: Master writes to disk
T2: Master waits for ALL slaves to acknowledge ⏳
T3: Slaves write to disk
T4: Slaves send ACK to Master
T5: Master returns success to client ✅

Client waits for ALL slaves!
```

**Advantages:**
- ✅ **No data loss** - Slaves guaranteed to have data
- ✅ Strong consistency

**Disadvantages:**
- ❌ Slow writes (wait for slowest slave)
- ❌ Availability issue - If any slave down, writes fail

**When to use:**
- Financial transactions
- Critical data (cannot lose)
- Strong consistency required

---

#### **3. Semi-Synchronous Replication (Best of Both)**

```
Timeline:
T0: Client sends write to Master
T1: Master writes to disk
T2: Master waits for AT LEAST ONE slave to acknowledge
T3: One slave writes to disk, sends ACK
T4: Master returns success to client ✅
T5: Other slaves replicate asynchronously

Client waits for ONE slave (not all)
```

**Advantages:**
- ✅ Data safety (at least one replica)
- ✅ Acceptable performance (only wait for one)
- ✅ Good balance

**Disadvantages:**
- ⚠️ Still some replication lag on other slaves

**When to use:**
- Production systems (recommended default)
- Need both performance and safety

---

### **Configuration Example (MySQL)**

```sql
-- Master configuration (my.cnf)
[mysqld]
server-id = 1
log-bin = /var/log/mysql/mysql-bin.log
binlog-format = ROW
sync_binlog = 1  -- Flush binlog to disk immediately

-- Semi-synchronous plugin
rpl_semi_sync_master_enabled = 1
rpl_semi_sync_master_timeout = 1000  -- Wait max 1 second

-- Slave configuration
[mysqld]
server-id = 2
relay-log = /var/log/mysql/relay-bin
read_only = 1  -- Prevent writes to slave

rpl_semi_sync_slave_enabled = 1

-- On Master: Create replication user
CREATE USER 'replicator'@'%' IDENTIFIED BY 'password';
GRANT REPLICATION SLAVE ON *.* TO 'replicator'@'%';

-- On Slave: Start replication
CHANGE MASTER TO
  MASTER_HOST='master.example.com',
  MASTER_USER='replicator',
  MASTER_PASSWORD='password',
  MASTER_LOG_FILE='mysql-bin.000001',
  MASTER_LOG_POS=107;
  
START SLAVE;
SHOW SLAVE STATUS\G  -- Check replication status
```

---

## **2️⃣ Master-Master Replication**

### **Architecture**

```
        ┌───────────┐
        │Application│
        └─────┬─────┘
              │
      ┌───────┴────────┐
      │                │
Writes│           Writes│
      ▼                ▼
┌──────────┐  ↔  ┌──────────┐
│ Master A │  ↔  │ Master B │
│(Read/Write)│  ↔  │(Read/Write)│
└──────────┘     └──────────┘
   Bidirectional Replication
```

### **How It Works**

```
1. Write to Master A
   Client → Master A: UPDATE users SET name = 'Alice'
   Master A writes to binlog
   
2. Replicate to Master B
   Master B pulls binlog from A
   Master B applies UPDATE
   
3. Write to Master B (simultaneously)
   Client → Master B: UPDATE users SET age = 30
   Master B writes to binlog
   
4. Replicate to Master A
   Master A pulls binlog from B
   Master A applies UPDATE
```

---

### **Conflict Resolution**

#### **Problem: Write Conflicts**

```
Scenario:
T0: User updates same record on both masters

Master A: UPDATE users SET age = 25 WHERE id = 1
Master B: UPDATE users SET age = 30 WHERE id = 1

T1: Changes replicate

Master A sees: age = 30 (from B)  
Master B sees: age = 25 (from A)

Which is correct? CONFLICT!
```

#### **Resolution Strategies**

**1. Last-Write-Wins (LWW) - Timestamp-based**

```sql
-- Add timestamp column
ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Application always includes timestamp
UPDATE users 
SET age = 25, updated_at = '2024-01-14 10:00:00'
WHERE id = 1;

-- Conflict resolution
IF incoming.updated_at > local.updated_at THEN
  apply_change();
ELSE
  ignore_change();
END IF;
```

**Problem:** Requires synchronized clocks!

---

**2. Auto-Increment Offset (Prevent conflicts)**

```sql
-- Master A: Only even IDs
auto_increment_increment = 2
auto_increment_offset = 1
-- Generates: 1, 3, 5, 7, 9...

-- Master B: Only odd IDs
auto_increment_increment = 2
auto_increment_offset = 2
-- Generates: 2, 4, 6, 8, 10...

-- No ID conflicts!
```

---

**3. Application-Level Routing (Best)**

```javascript
// Route writes by user ID
function getWriteMaster(userId) {
  if (userId % 2 === 0) {
    return masterA;  // Even users on A
  } else {
    return masterB;  // Odd users on B
  }
}

// Each user only writes to one master
const master = getWriteMaster(user.id);
await master.query('UPDATE users SET age = ? WHERE id = ?', [25, user.id]);

// No conflicts because same user always same master
```

---

### **When to Use Master-Master**

```
✅ Good for:
- Geographic distribution (users write to nearest master)
- Load balancing writes
- High availability (if one master fails, other continues)

❌ Avoid for:
- Frequent updates to same records
- Transactions spanning both masters
- Complex conflict scenarios

Example: Multi-region SaaS
- US users → US master
- EU users → EU master
- Each master replicates to other (eventual consistency)
```

---

## **3️⃣ Read Replicas for Scaling Reads**

### **Scaling Pattern**

```
          ┌───────────┐
          │Application│
          └─────┬─────┘
                │
       ┌────────┼────────────────────┐
       │        │                    │
  Writes│  Reads│               Reads│
       │        │                    │
       ▼        ▼                    ▼
  ┌────────┐ ┌───────┐  ┌───────┐ ┌───────┐
  │ Master │ │Replica1│  │Replica2│ │Replica3│
  └────┬───┘ └───────┘  └───────┘ └───────┘
       │         ▲          ▲         ▲
       │ Replication         │         │
       └─────────┴──────────┴─────────┘
```

### **Load Distribution**

```javascript
// Connection pool manager
class DatabasePool {
  constructor() {
    this.master = createConnection('master.db.example.com');
    this.replicas = [
      createConnection('replica1.db.example.com'),
      createConnection('replica2.db.example.com'),
      createConnection('replica3.db.example.com')
    ];
    this.replicaIndex = 0;
  }
  
  getMaster() {
    return this.master;
  }
  
  getReplica() {
    // Round-robin across replicas
    const replica = this.replicas[this.replicaIndex];
    this.replicaIndex = (this.replicaIndex + 1) % this.replicas.length;
    return replica;
  }
}

// Application code
const pool = new DatabasePool();

async function getUser(userId) {
  // Read from replica
  const db = pool.getReplica();
  return await db.query('SELECT * FROM users WHERE id = ?', [userId]);
}

async function updateUser(userId, data) {
  // Write to master
  const db = pool.getMaster();
  return await db.query('UPDATE users SET ? WHERE id = ?', [data, userId]);
}
```

### **Scaling Math**

```
Single Database:
- Reads: 10K QPS
- Writes: 2K QPS
- Bottleneck: Read capacity

With 5 Read Replicas:
- Master handles: 2K writes
- Each replica handles: ~2K reads (10K / 5)
- Total capacity: 10K reads + 2K writes = 12K QPS

Cost:
- Master: $500/month
- 5 Replicas: $300/month each = $1500/month  
- Total: $2000/month
- Cheaper than vertical scaling!
```

---

## **⚠️ Replication Lag**

### **What is Replication Lag?**

```
Replication Lag = Time between write on master and availability on replica

Causes:
1. Network latency (geographic distance)
2. High write volume on master
3. Slow replica hardware
4. Large transactions
```

###  **Measuring Lag**

```sql
-- On replica
SHOW SLAVE STATUS\G

-- Important fields:
Seconds_Behind_Master: 5  -- Replica is 5 seconds behind!
Slave_IO_Running: Yes      -- Receiving binlog from master
Slave_SQL_Running: Yes     -- Applying binlog

-- Ideal: Seconds_Behind_Master = 0
```

### **Read-Your-Writes Problem**

```javascript
// Problem scenario
async function updateAndGetProfile(userId, newEmail) {
  // 1. Write to master
  await masterDB.query(
    'UPDATE users SET email = ? WHERE id = ?',
    [newEmail, userId]
  );
  
  // 2. Immediately read from replica
  const user = await replicaDB.query(
    'SELECT email FROM users WHERE id = ?',
    [userId]
  );
  
  console.log(user.email); 
  // Might show OLD email due to lag!
}
```

### **Solutions**

#### **1. Read from Master After Write**

```javascript
class SmartDatabasePool {
  constructor() {
    this.master = createConnection('master');
    this.replicas = createReplicas();
    this.recentWrites = new Map(); // userId → timestamp
  }
  
  async write(userId, query) {
    const result = await this.master.query(query);  
    this.recentWrites.set(userId, Date.now());
    
    // Clean old entries (older than 5 seconds)
    setTimeout(() => this.recentWrites.delete(userId), 5000);
    
    return result;
  }
  
  async read(userId, query) {
    const writeTime = this.recentWrites.get(userId);
    
    if (writeTime && (Date.now() - writeTime < 5000)) {
      // Recent write → read from master
      return await this.master.query(query);
    }
    
    // Old or no write → safe to read from replica
    return await this.getReplica().query(query);
  }
}
```

---

#### **2. Session Consistency Token**

```javascript
// After write, return session token with timestamp
async function updateUser(userId, data) {
  await masterDB.query('UPDATE users SET ? WHERE id = ?', [data, userId]);
  
  const token = jwt.sign(
    { userId, writeTime: Date.now() },
    'secret',
    { expiresIn: '10s' }
  );
  
  return { success: true, sessionToken: token };
}

// On read, check if replica is caught up
async function getUser(userId, sessionToken) {
  if (sessionToken) {
    const { writeTime } = jwt.verify(sessionToken, 'secret');
    
    const replicaLag = await checkReplicaLag();
    if (replicaLag < (Date.now() - writeTime)) {
      // Replica not caught up → read from master
      return await masterDB.query('SELECT * FROM users WHERE id = ?', [userId]);
    }
  }
  
  // Safe to read from replica
  return await replicaDB.query('SELECT * FROM users WHERE id = ?', [userId]);
}
```

---

#### **3. Monotonic Reads (Session Pinning)**

```javascript
// Pin user's session to one replica
class SessionAwarePool {
  constructor() {
    this.master = createConnection('master');
    this.replicas = createReplicas();
    this.sessionReplicas = new Map(); // sessionId → replica
  }
  
  getReplica(sessionId) {
    if (!this.sessionReplicas.has(sessionId)) {
      // Assign random replica to this session
      const replica = this.replicas[Math.floor(Math.random() * this.replicas.length)];
      this.sessionReplicas.set(sessionId, replica);
    }
    
    // Always return same replica for this session
    return this.sessionReplicas.get(sessionId);
  }
}

// User always reads from same replica
// Guarantees monotonic reads (never see older data)
```

---

## **🔄 Failover & Promotion**

### **Failure Scenarios**

#### **1. Slave Failure**

```
Before:
Master → [Slave1, Slave2, Slave3]

Slave2 Fails:
Master → [Slave1, ❌ Slave2, Slave3]

Impact:
- Read capacity reduced by 33%
- Master and other slaves continue
- No data loss

Recovery:
1. Diagnose and fix Slave2
2. Rebuild from Master's binlog
3. Catch up to Master
4. Add back to pool
```

---

#### **2. Master Failure (Critical!)**

```
Before:
Master → [Slave1, Slave2, Slave3]

Master Fails ❌:
❌ Master → [Slave1, Slave2, Slave3]

Impact:
- All writes fail!
- Reads still work (from slaves)
- System is read-only

Recovery: Promote a slave to master
```

### **Promotion Process**

**Manual Promotion:**
```bash
# Step 1: Choose most up-to-date slave
# Check each slave's position
mysql> SHOW SLAVE STATUS\G
Relay_Master_Log_File: mysql-bin.000042
Exec_Master_Log_Pos: 123456

# Slave1: position 123456
# Slave2: position 123450  ← Behind
# Slave3: position 123456
# Choose Slave1 or Slave3

# Step 2: Stop replication on chosen slave
mysql> STOP SLAVE;

# Step 3: Make it writable
mysql> SET GLOBAL read_only = 0;

# Step 4: Update application to write to new master
# Change config:  
# old_master: master.db.example.com
# new_master: slave1.db.example.com

# Step 5: Point other slaves to new master
# On Slave2 and Slave3:
mysql> STOP SLAVE;
mysql> CHANGE MASTER TO  
  MASTER_HOST='slave1.db.example.com',
  MASTER_LOG_FILE='mysql-bin.000001',
  MASTER_LOG_POS=107;
mysql> START SLAVE;
```

**Downtime:** 5-30 minutes (unacceptable for production!)

---

**Automatic Promotion (Recommended):**

```
Tools:
- MySQL: MySQL Router, Orchestrator, ProxySQL
- PostgreSQL: Patroni, repmgr
- Cloud: AWS RDS (automatic failover), GCP Cloud SQL

How it works:
1. Monitor master health (heartbeat every 1 second)
2. Detect failure (3 missed heartbeats)
3. Choose promotion candidate (most up-to-date slave)
4. Promote slave to master automatically
5. Update DNS/load balancer
6. Redirect traffic

Downtime: 30-60 seconds
```

---

## **🌍 Multi-Region Replication**

### **Architecture**

```
        US-East Region              EU-West Region
    ┌─────────────────────┐    ┌──────────────────────┐
    │   Master (Primary)  │───▶│   Replica (Hot Standby) │
    │   Application Servers│    │   Application Servers│
    └─────────────────────┘    └──────────────────────┘
            │                           │
            │◀─────Cross-Region ────────┤
            │      Replication          │
```

### **Latency Considerations**

```
Same Region (us-east-1a → us-east-1b):
- Latency: 1-5ms
- Synchronous replication: Feasible

Crosscontinental (US → Europe):
- Latency: 80-150ms  
- Synchronous replication: Too slow!
- Solution: Asynchronous replication

Trade-off:
- Fast writes (async)
- Risk of data loss during region failure
```

### **Disaster Recovery Strategy**

```
Normal Operation:
- US Master: Handles all writes
- EU Replica: Asynchronous replication from US
- EU Replica: Serves local EU reads (low latency)

US Region Fails:
1. Promote EU Replica to Master (automatic)
2. EU handles all writes temporarily
3. EU users: No impact
4. US users: Higher latency (routing to EU)

US Region Recovers:
1. Rebuild US as replica of EU
2. Catch up to EU master
3. Fail back to US as primary (planned)
4. EU becomes replica again
```

---

## **📋 Practice Exercises**

### **Problem 1: Design Replication for Global App**

**Requirements:**
- 100M users (60% US, 30% EU, 10% Asia)
- 1000 writes/sec, 10000 reads/sec
- 99.99% availability
- RPO: 0 seconds (no data loss)
- RTO: 60 seconds (max downtime)

**Design:**

<details>
<summary>Solution</summary>

```
Architecture:
1. Multi-master setup (3 regions)
   - US Master (read/write)
   - EU Master (read/write)
   - Asia Master (read/write)
   
2. Within each region:
   - 1 Master
   - 3 Read Replicas (scale reads)
   
3. Cross-region replication:
   - Asynchronous (low latency)
   - Bi-directional (US ↔ EU ↔ Asia)
   
4. Write routing:
   - Route by user region (prevent conflicts)
   - US users → US Master only
   - EU users → EU Master only
   - Failover to nearest region if primary down
   
5. Read routing:
   - Always read from nearest region
   - US user in EU → EU replica (low latency)
   
6. Failover:
   - Automatic promotion (Orchestrator)
   - DNS failover (Route53, 60s TTL)
   - Health checks every 5 seconds
   
7. Data loss prevention (RPO = 0):
   - Semi-synchronous replication within region
   - Wait for 1 replica ACK before success
   - Cross-region async (acceptable eventual consistency)
   
8. Monitoring:
   - Replication lag alerts (> 10 seconds)
   - Failover notifications
   - Cross-region lag dashboard
```
</details>

---

## **🧠 Memory Aids**

### **Replication Modes**
```
\"3S = Replication Modes\"
Synchronous: Strong consistency, Slow writes
Semi-Synchronous: Safe + Speed (best balance)  
aSynchronous: Speed first, may lose data
```

### **Failover Checklist**
```
\"P.R.O.M.O.T.E = Promotion Steps\"
P - Pick candidate (most up-to-date)
R - Read-only disable
O - Other slaves repoint
M - Monitor replication lag  
O - Output traffic redirect
T - Test writes
E - Enable monitoring
```

---

## **📝 Interview Q&A**

### **Q1: Explain replication lag and how to handle it**

**Answer:**
```
Replication Lag: Time delay between write on master and
visibility on replica.

Causes:
1. Network latency (cross-region: 100ms+)
2. High write volume (master busy)
3. Large transactions (bulk inserts)
4. Slow replica hardware

Impact:
- Read-your-writes inconsistency
- Stale data shown to users
- Analytics reports out of date

Solutions:

1. Read from Master for Critical Reads:
   - After write, read from master for 5 seconds
   - Guarantees seeing own write
   
2. Use Session Tokens:
   - Token includes write timestamp
   - Check if replica caught up before reading
   
3. Show Staleness to User:
   \"Data as of 5 seconds ago\"
   
4. Reduce Lag:
   - Faster replica hardware
   - Parallel replication (MySQL 5.7+)
   - Reduce network latency (same region)
   
5. Application-level caching:
   - Cache write in Redis for 5 seconds
   - Read from cache if recent write
```

---

### **Q2: Master-Master vs Master-Slave, when to use each?**

**Answer:**
```
Master-Slave (Single Master):
Use when:
- Strong consistency required
- Simple write path
- No write conflicts acceptable
- Most applications (recommended default)

Benefits:
✅ No conflict resolution needed
✅ Simple failover
✅ Strong consistency

Example: E-commerce (inventory, orders)

---

Master-Master (Multi-Master):
Use when:
- Geographic distribution (low latency writes)
- Load balance writes
- High write availability

Challenges:
❌ Conflict resolution complex
❌ Write conflicts possible
❌ Eventual consistency

Example: Multi-region CMS
- US writers → US master
- EU writers → EU master
- Conflicts rare (different users/content)

When NOT to use:
❌ Same data written from multiple regions
❌ Banking/financial (needs strong consistency)
❌ Inventory (race conditions)
```

---

This completes Module 2.3! Would you like me to continue with Module 2.4 (Message Queues) and 2.5 (CDN)?

# **Module 2.4: Message Queues & Async Processing**

## **🚀 The Power of Asynchrony**

### **Why Message Queues?**

In a synchronous system, a request must wait for everything to finish before getting a response.
```
User → Web Server → Database → Email Provider → Payment Gateway → Response (Slow! 5-10 seconds)
```

In an asynchronous (event-driven) system:
```
User → Web Server → Message Queue (Add "OrderPlaced" event) → Response (Fast! 100ms)
                        │
                        ├─▶ Consumer 1: Process Payment
                        ├─▶ Consumer 2: Update Inventory
                        └─▶ Consumer 3: Send Confirmation Email
```

---

## **1️⃣ Core Concepts: Queue vs Topic**

### **Point-to-Point (Queue)**
- **Model:** One producer, one consumer.
- **Behavior:** Each message is processed by exactly one worker.
- **Use Case:** Task workers (e.g., resizing images, sending specific emails).
- **Example:** RabbitMQ (standard queue), AWS SQS.

### **Publish-Subscribe (Topic)**
- **Model:** One producer, multiple consumers.
- **Behavior:** Each message is "broadcast" to all interested subscribers.
- **Use Case:** Notifications, logging, multi-service updates.
- **Example:** Kafka, SNS, Google Pub/Sub.

---

## **2️⃣ Delivery Guarantees**

| Guarantee | Meaning | Implementation |
|-----------|---------|----------------|
| **At-Most-Once** | Message may be lost, but never duplicated. | Send and forget. |
| **At-Least-Once** (Most common) | Message never lost, but may be duplicated. | Acknowledgment (ACK) systems. |
| **Exactly-Once** (Hardest) | Message is processed exactly once. | Idempotency + Transactional writes. |

### **Handling Duplicates: Idempotency**
Since "Exactly-Once" is complex and expensive, we usually aim for "At-Least-Once" and make our consumers **Idempotent**.

**Idempotency Example:**
```javascript
// ❌ NOT Idempotent (Multiple calls = multiple charges)
async function chargePayment(orderId, amount) {
  await stripe.charge(amount);
}

// ✅ Idempotent (Multiple calls = one charge)
async function chargePaymentIdempotent(orderId, amount) {
  const existing = await db.query('SELECT * FROM payments WHERE order_id = ?', [orderId]);
  if (existing) return; // Already processed
  
  await stripe.charge(amount, { idempotency_key: orderId });
  await db.query('INSERT INTO payments ...');
}
```

---

## **3️⃣ Dead Letter Queues (DLQ)**

### **What is a DLQ?**
If a message fails to be processed after several attempts (e.g., because of invalid data or external service down), it is moved to a special queue called the **Dead Letter Queue**.

**Why use it?**
1. Prevents "poison pill" messages from blocking the main queue.
2. Allows developers to inspect and debug failed messages.
3. Enables manual re-processing.

```javascript
// Consumer with Retry & DLQ Logic
async function processMessage(msg) {
  try {
    await doWork(msg);
    msg.ack();
  } catch (error) {
    if (msg.attempts < 3) {
      msg.nack(); // Retry later
    } else {
      await dlq.push(msg); // Move to DLQ
      msg.ack(); // Remove from main queue
    }
  }
}
```

---

## **4️⃣ Kafka Architecture Deep Dive**

Unlike traditional queues (like RabbitMQ) which delete messages after they are read, **Kafka** is a distributed append-only log.

### **Key Components**
1. **Producer:** Sends data to topics.
2. **Topic:** A category/folder where data is stored.
3. **Partition:** Topics are split into multiple partitions for parallelism.
4. **Consumer Group:** Multiple consumers can share the work of reading from a topic.
5. **Offset:** A marker of where a consumer left off in a partition.

### **Partitions & Parallelism**
```
Topic: user_signup
Partition 0 [ Msg 1 | Msg 4 | Msg 7 ]  <-- Read by Consumer A
Partition 1 [ Msg 2 | Msg 5 | Msg 8 ]  <-- Read by Consumer B
Partition 2 [ Msg 3 | Msg 6 | Msg 9 ]  <-- Read by Consumer C
```
**Ordering Guarantee:** Kafka guarantees order **only within a partition**, not across the entire topic.

---

## **5️⃣ RabbitMQ vs Kafka vs SQS**

| Feature | RabbitMQ | Kafka | AWS SQS |
|---------|----------|-------|---------|
| **Type** | Smart Broker / Simple Consumer | Simple Broker / Smart Consumer | Fully Managed Serverless |
| **Data Retention** | Deleted after ACK | Persistent (retention policy) | Deleted after ACK |
| **Ordering** | Guaranteed | Guaranteed within partition | Guaranteed with FIFO Queue |
| **Throughput** | Moderate (~10K-50K/sec) | Massive (millions/sec) | High (scalable) |
| **Best For** | Complex routing, low latency | Big data, event sourcing, logging | Rapid AWS development |

---

## **📋 Practice Exercises**

### **Problem 1: Design an Image Processing System**
Users upload high-res photos. You need to generate thumbnails, check for NSFW content, and save to a CDN.

**Design:**
1. User uploads to S3 → Triggers "UploadComplete" event.
2. Event added to **Task Queue** (e.g., RabbitMQ or SQS).
3. **Worker A** picks up task: Generates 3 thumbnails.
4. **Worker B** picks up task: Runs AI NSFW scan.
5. Both workers notify **Database** when done.
6. UI polls or gets WebSocket update.

### **Problem 2: Handle Message Poison Pills**
A specific message keeps crashing your consumer. What do you do?
- **Answer:** Implement a **DLQ**. After 3-5 failed retries, move the message to the DLQ and send an alert to the engineering team.

---

## **🧠 Mnemonics**
```
Kafka: P.C.O.
P - Partitions (Scale)
C - Consumer Groups (Parallelism)
O - Offsets (Reliability)
```

# **Module 2.5: CDN & Edge Computing**

## **🌍 Reducing Global Latency**

### **The Speed of Light Problem**
A request from Tokyo to a server in New York takes ~200ms just for travel (due to the speed of light in fiber optics).
- **Latency:** User feels the "lag".
- **Solution:** Move the content closer to the user.

---

## **1️⃣ What is a CDN?**

A **Content Delivery Network (CDN)** is a geographically distributed group of servers (Edges) that cache static content (images, JS, CSS, videos) closer to users.

### **Key Concepts**
- **Origin Server:** Your main server (where the data lives).
- **Edge Server (PoP):** Geographic locations where content is cached.
- **Cache Hit:** Content found at the Edge.
- **Cache Miss:** Edge must fetch content from the Origin.

---

## **2️⃣ Pull vs Push CDNs**

### **Pull CDN (Most Common)**
- **How:** You request a file from the CDN. If the CDN doesn't have it, it **pulls** it from your origin, caches it, and serves it.
- **Best For:** High-traffic sites with many static files.
- **Examples:** Amazon CloudFront, Cloudflare, Akamai.

### **Push CDN**
- **How:** You manually **upload (push)** content to the CDN before users request it.
- **Best For:** Sites with less frequent updates or extremely large files.

---

## **3️⃣ Cache Invalidation & TTL**

Since content is cached on thousands of servers, how do you update it?

1. **TTL (Time To Live):** Content expires naturally after a set time (e.g., 24 hours).
2. **Purge/Invalidation:** Explicitly tell the CDN to delete a file. (Warning: Can be expensive and take a few minutes).
3. **Versioning (Best Practice):** Change the filename (e.g., `style.v2.css`). This forces a new cache entry without needing a purge.

---

## **4️⃣ Dynamic Content Delivery**

Can CDNs cache dynamic content (like user profiles)?
**Yes, but with care.**
- **Edge Side Includes (ESI):** Cache the static parts of a page and fetch only small dynamic fragments from the origin.
- **Route Optimization:** CDNs use private, optimized network paths to communicate with your origin faster than the public internet.

---

## **5️⃣ Edge Computing**

Edge Computing takes it a step further: it doesn't just store data; it **runs code** at the edge.

**Use Cases:**
- **A/B Testing:** Decide which version to show at the edge.
- **Authentication:** Check JWT tokens before reaching your server.
- **Image Transformation:** Resize images on the fly based on the user's device.
- **Security:** Filter DDoS attacks and malicious bots.

**Popular Tools:**
- **Cloudflare Workers**
- **AWS Lambda@Edge**

---

## **📋 Practice Exercises**

### **Problem 1: Calculate Bandwidth Savings**
Your site uses 10TB of bandwidth per month. 8TB is static images. Your CDN has a 90% hit rate.
- **Origin Bandwidth Savings:** `8TB * 0.90 = 7.2TB`.
- **New Origin Bandwidth:** `10TB - 7.2TB = 2.8TB`.

### **Problem 2: Configure CloudFront for Media**
How would you optimize a video streaming platform?
- **Answer:** Use a CDN with **Byte-Range requests** (fetch parts of the file) and a high TTL for older videos, but low TTL or versioning for the homepage manifest file.

---

## **🧠 Mnemonics**
```
CDN Benefits: R.L.D.
R - Reduced Latency (Closer to user)
L - Lower Bandwidth (Saved origin costs)
D - DDoS Protection (Distributed absorbing)
```

---

## 🎓 **Part 2 Summary & Interview Readiness**

### **Module 2.1: Scaling ✅**
- [ ] Horizontal vs Vertical (HOR = More, VERT = Bigger)
- [ ] Auto-scaling metrics (CPU, RAM, Requests)
- [ ] Stateless design (Session in Redis, Auth in JWT)

### **Module 2.2: Sharding & Partitioning ✅**
- [ ] Sharding keys (Range, Hash, Geo, Directory)
- [ ] Consistent Hashing ring & virtual nodes
- [ ] Resharding (Dual Writes) & Hotspot handling

### **Module 2.3: Replication ✅**
- [ ] Master-Slave (Single leader) vs Master-Master (Multi-leader)
- [ ] Replication lag (Seconds Behind Master)
- [ ] Failover & Promotion (RPO/RTO)

### **Module 2.4: Message Queues ✅**
- [ ] Asynchronous benefits (Decoupling, Speed)
- [ ] Delivery guarantees (At-Least-Once + Idempotency)
- [ ] Kafka partitions & consumer groups

### **Module 2.5: CDN & Edge ✅**
- [ ] Global latency reduction (Closer to user)
- [ ] Cache Hit vs Cache Miss
- [ ] Edge computing & Versioning strategies

---

## 🏆 **Final Practice Challenge: Design a Scalable YouTube**

**Requirements:**
- 1B global users.
- Massive video uploads (writes) and streaming (reads).
- Minimal buffering, high availability.

**Design Logic (Partially using Part 2 concepts):**
1. **Caching:** Aggressive CDN for videos.
2. **Scaling:** Horizontal App servers (stateless).
3. **Database:** Master-Slave replication with sharding by `video_id`.
4. **Async:** Message queues to process video transcodings (MP4 → 1080p, 720p, etc.).
5. **Edge:** Use Edge computing to decide the nearest PoP for streaming.

**Congratulations! You have completed Part 2! 🎉**
Next up: **Part 3: Resilience & Fault Tolerance.**
