# Module 5.1: Interview Framework Mastery - Complete Deep Dive

## 🎯 Learning Objective
Master the systematic approach to tackle any system design interview with confidence, clarity, and completeness.

---

## 1. The RADIO Framework (Your North Star)

### **R - Requirements Gathering**

#### **Functional Requirements (What the system does)**
```
Template Questions:
├── Core Features
│   ├── "What are the primary use cases?"
│   ├── "Which features are in scope for this discussion?"
│   └── "What's the MVP vs nice-to-have?"
├── User Actions
│   ├── "What can users do in the system?"
│   ├── "Are there different user roles?"
│   └── "What's the user journey?"
└── Data Flow
    ├── "What data needs to be created/read/updated/deleted?"
    └── "Are there any data transformations needed?"
```

**Example (Design Twitter):**
```
✅ Functional Requirements:
1. Users can post tweets (280 chars)
2. Users can follow other users
3. Users can view their home timeline
4. Users can like/retweet tweets
5. Users can search tweets

❌ Out of Scope:
- Direct messaging
- Trending topics
- Notifications
```

#### **Non-Functional Requirements (How the system performs)**

**The SCALPER Checklist:**
- **S**calability: How many users? Growth rate?
- **C**onsistency: Strong vs eventual consistency?
- **A**vailability: Uptime requirements (99.9% vs 99.99%)?
- **L**atency: Response time expectations?
- **P**erformance: Throughput requirements?
- **E**xtensibility: Future feature additions?
- **R**eliability: Data durability requirements?

```
Template Questions:
├── Scale
│   ├── "How many daily active users (DAU)?"
│   ├── "How many requests per second at peak?"
│   └── "Data growth rate (TB/year)?"
├── Performance
│   ├── "What's acceptable latency (p50, p99)?"
│   ├── "Read:write ratio?"
│   └── "Are there any SLAs?"
├── Availability
│   ├── "What's the uptime requirement?"
│   ├── "Can we have downtime for maintenance?"
│   └── "Regional availability needed?"
└── Consistency
    ├── "Is eventual consistency acceptable?"
    ├── "Which operations need ACID guarantees?"
    └── "Can we show stale data?"
```

**Example Questions Matrix:**

| System | Critical Non-Functional Requirement |
|--------|-------------------------------------|
| Payment System | Consistency > Availability (ACID) |
| Twitter Feed | Availability > Consistency (eventual) |
| Uber Matching | Low Latency (< 1 second) |
| YouTube Upload | High Throughput (GB/s) |

---

### **A - Architecture Design**

#### **High-Level Components (Building Blocks)**

**The Standard Web Architecture Pattern:**
```
Client Layer
    ↓
Load Balancer (Layer 7)
    ↓
API Gateway / Application Servers
    ↓ ↓ ↓
┌─────────────┬──────────────┬─────────────┐
│   Cache     │   Database   │   Queue     │
│  (Redis)    │  (SQL/NoSQL) │  (Kafka)    │
└─────────────┴──────────────┴─────────────┘
    ↓              ↓              ↓
Worker Services / Background Jobs
    ↓
Object Storage (S3) / CDN
```

#### **Component Selection Decision Tree**

**Load Balancer:**
```
Do you need SSL termination? → Nginx/HAProxy (Layer 7)
Just TCP/UDP routing? → AWS NLB (Layer 4)
Global distribution? → AWS Route 53 + CloudFront
```

**Cache:**
```
Session data? → Redis (in-memory, persistence)
Simple key-value? → Memcached (pure memory)
Distributed cache? → Redis Cluster
Content caching? → CDN (CloudFront, Cloudflare)
```

**Database:**
```
Structured data + ACID? → SQL (PostgreSQL, MySQL)
Flexible schema? → Document DB (MongoDB)
Wide column data? → Cassandra
Key-value at scale? → DynamoDB
Time-series data? → InfluxDB, TimescaleDB
Graph relationships? → Neo4j
Search? → Elasticsearch
```

**Message Queue:**
```
Event streaming? → Kafka
Task queue? → RabbitMQ, AWS SQS
Pub/Sub? → Redis Pub/Sub, Google Pub/Sub
```

#### **Drawing Architecture Diagrams (Interview Technique)**

**Level of Detail Progression:**

**Phase 1: Initial Sketch (5 minutes)**
```
[Client] → [LB] → [API] → [DB]
                    ↓
                 [Cache]
```

**Phase 2: Core Flow (10 minutes)**
```
                    ┌──────────┐
    [Mobile/Web] → │Load Bal  │
                    └────┬─────┘
                         │
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
    [API-1]          [API-2]          [API-N]
        │                │                │
        └────────────────┼────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ↓                ↓                ↓
    [Redis]       [PostgreSQL]        [Kafka]
                         ↓
                   [Workers] → [S3]
```

**Phase 3: Deep Dive (Interviewer asks for specific component)**
```
Example: Expand database layer
┌─────────────────────────────────┐
│     Database Architecture       │
├─────────────────────────────────┤
│  [API] → [Read Replicas] ←─┐   │
│            ↓                │   │
│       [Primary DB]          │   │
│            ↓                │   │
│      [Write-Ahead Log]      │   │
│            ↓                │   │
│    [Replication Manager]────┘   │
└─────────────────────────────────┘
```

**Drawing Best Practices:**
1. **Top-to-bottom flow** (client at top, storage at bottom)
2. **Use boxes for services, cylinders for databases, queues for... queues**
3. **Label connections** with protocols/data types
4. **Show data flow direction** with arrows
5. **Number the steps** for complex flows

---

### **D - Data Modeling**

#### **Database Schema Design Approach**

**Step 1: Identify Entities (Nouns in Requirements)**
```
Twitter Example:
- User
- Tweet
- Follow
- Like
- Retweet
```

**Step 2: Define Relationships**
```
User ─(1:M)─ Tweet    (One user, many tweets)
User ─(M:M)─ User     (Followers/Following)
User ─(M:M)─ Tweet    (Likes - through junction table)
Tweet ─(1:M)─ Tweet   (Retweets reference original)
```

**Step 3: Schema Design Pattern**

**SQL Schema (Normalized):**
```sql
-- Core Entities
CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_username (username)
);

CREATE TABLE tweets (
    tweet_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(user_id),
    content TEXT NOT NULL CHECK (LENGTH(content) <= 280),
    created_at TIMESTAMP DEFAULT NOW(),
    retweet_of BIGINT REFERENCES tweets(tweet_id),
    INDEX idx_user_created (user_id, created_at DESC)
);

-- Relationships
CREATE TABLE follows (
    follower_id BIGINT REFERENCES users(user_id),
    following_id BIGINT REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    INDEX idx_following (following_id)
);

CREATE TABLE likes (
    user_id BIGINT REFERENCES users(user_id),
    tweet_id BIGINT REFERENCES tweets(tweet_id),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, tweet_id),
    INDEX idx_tweet (tweet_id)
);
```

**NoSQL Schema (Denormalized - MongoDB):**
```javascript
// User Document
{
  _id: ObjectId("..."),
  username: "john_doe",
  email: "john@example.com",
  followers_count: 1500,
  following_count: 300,
  created_at: ISODate("2024-01-01")
}

// Tweet Document (Denormalized for read performance)
{
  _id: ObjectId("..."),
  user_id: ObjectId("..."),
  username: "john_doe",  // Denormalized
  user_avatar: "url",     // Denormalized
  content: "Hello world!",
  created_at: ISODate("2024-01-15"),
  likes_count: 42,
  retweets_count: 7,
  // Embedded for performance
  latest_likes: [
    { user_id: "...", username: "jane" },
    // ... top 10 likes
  ]
}

// Timeline Cache (Pre-computed for fast reads)
{
  _id: "user:123:timeline",
  tweets: [
    { tweet_id: "...", cached_at: "..." },
    // ... latest 100 tweets
  ],
  last_updated: ISODate("2024-01-15")
}
```

#### **Data Partitioning Strategy**

**Sharding Key Selection:**
```
Good Sharding Keys:
├── User ID (hash-based) → Even distribution
├── Geography (location-based) → Data locality
├── Time (range-based) → Easy archival
└── Composite (user_id + timestamp) → Balanced queries

Bad Sharding Keys:
├── Timestamp only → Hot spots (recent data)
├── Sequential ID → Unbalanced growth
└── Boolean flags → Severe imbalance
```

**Example: Twitter Sharding**
```
Shard by user_id (hash-based):
- Tweets table: SHARD_KEY = hash(user_id) % NUM_SHARDS
- Timeline: Fan-out write to follower shards
- Lookup: SELECT * FROM tweets WHERE user_id = ? 
  → Single shard query

Alternative: Hybrid approach
- Recent tweets (30 days): Unsharded for speed
- Historical tweets: Sharded by (user_id, year)
```

---

### **I - Interface (API) Design**

#### **RESTful API Design Pattern**

**URL Structure:**
```
Resource-based naming (nouns, not verbs):
✅ POST   /api/v1/tweets
✅ GET    /api/v1/tweets/{tweet_id}
✅ GET    /api/v1/users/{user_id}/tweets
✅ DELETE /api/v1/tweets/{tweet_id}

❌ POST   /api/v1/createTweet
❌ GET    /api/v1/getTweetById
```

**Complete API Specification (Twitter Example):**

```yaml
# 1. Create Tweet
POST /api/v1/tweets
Headers:
  Authorization: Bearer {token}
  Content-Type: application/json
Request Body:
  {
    "content": "Hello world!",
    "media_ids": ["media_123", "media_456"],  # Optional
    "reply_to": "tweet_789"  # Optional
  }
Response (201 Created):
  {
    "tweet_id": "12345",
    "user_id": "user_abc",
    "content": "Hello world!",
    "created_at": "2024-01-15T10:30:00Z",
    "likes_count": 0,
    "retweets_count": 0
  }
Errors:
  400: Content exceeds 280 characters
  401: Unauthorized
  429: Rate limit exceeded (300 tweets/3 hours)

# 2. Get Timeline
GET /api/v1/users/{user_id}/timeline?limit=20&cursor=abc123
Response (200 OK):
  {
    "tweets": [
      {
        "tweet_id": "...",
        "user": { "id": "...", "username": "..." },
        "content": "...",
        "created_at": "...",
        "likes_count": 10,
        "retweets_count": 2
      }
    ],
    "next_cursor": "xyz789",
    "has_more": true
  }

# 3. Like Tweet
POST /api/v1/tweets/{tweet_id}/likes
Response (200 OK):
  {
    "tweet_id": "12345",
    "likes_count": 43,
    "user_liked": true
  }
Idempotent: Multiple calls don't duplicate like
```

#### **API Design Checklist (Interview)**

```
For each endpoint, specify:
☑ HTTP Method (GET/POST/PUT/DELETE)
☑ URL path with parameters
☑ Request headers (auth, content-type)
☑ Request body schema
☑ Response status codes (200, 201, 400, 404, 500)
☑ Response body schema
☑ Pagination strategy (cursor vs offset)
☑ Rate limiting (per user/IP)
☑ Error handling
☑ Idempotency (for POST/PUT)
```

**Pagination Strategies:**
```
Offset-based (simple, but slow for large offsets):
GET /tweets?offset=1000&limit=20
- Easy to implement
- Can skip pages
- Slow for large offsets (OFFSET 1M)

Cursor-based (preferred for feeds):
GET /tweets?cursor=tweet_12345&limit=20
- Fast at any position
- No skipped/duplicate items during pagination
- Cannot jump to arbitrary page
- Cursor = last_tweet_id or encoded timestamp
```

---

### **O - Optimization & Deep Dives**

#### **Read Optimization Techniques**

**1. Caching Strategy**
```
Cache-Aside Pattern (Lazy Loading):
┌─────────────────────────────────┐
│ 1. App checks cache             │
│ 2. Cache miss?                  │
│    → Read from DB               │
│    → Write to cache (TTL=1hr)   │
│ 3. Cache hit? Return directly   │
└─────────────────────────────────┘

What to cache:
- User profiles (high read, low write)
- Hot tweets (viral content)
- Timeline snippets (recent 100 tweets)
- API responses (with ETags)

Cache Eviction:
- LRU (Least Recently Used)
- TTL (Time to Live)
- Manual invalidation on writes
```

**2. Database Read Optimization**
```
Read Replicas:
[Primary] ──(async replication)──→ [Replica-1]
   ↓                                  ↓
[Writes]                          [Reads]
                                      ↓
                                [Replica-2]
                                      ↓
                                [More Reads]

Connection Routing:
- Writes → Primary (single source of truth)
- Reads → Replicas (round-robin)
- Replication lag: 0-2 seconds (acceptable for feeds)

Indexing Strategy:
CREATE INDEX idx_user_created ON tweets(user_id, created_at DESC);
- Covers: "Get user's latest tweets"
- Composite index = single disk seek
```

**3. CDN for Static Content**
```
[User] → [CDN Edge] → [Origin S3]
            ↓
     (Cache Hit: 95%)
     
CDN caching:
- Profile images (TTL: 24 hours)
- Uploaded media (TTL: 365 days)
- CSS/JS bundles (versioned URLs)
```

#### **Write Optimization Techniques**

**1. Async Processing**
```
Synchronous (Bad for heavy operations):
User → API → [Process] → Response (slow)

Asynchronous (Good):
User → API → [Queue] → Response (fast)
                ↓
           [Workers] → [Process]
           
Example (Tweet Analytics):
POST /tweets → 
  1. Save to DB (sync, 10ms)
  2. Queue for timeline fanout (async)
  3. Queue for analytics (async)
  4. Return tweet_id immediately
```

**2. Write-Heavy Optimization**
```
Batch Writes:
- Buffer 100 likes → Single DB transaction
- Commit every 5 seconds or on buffer full

Write-Ahead Log (WAL):
[API] → [In-Memory Buffer] → [WAL on Disk] → [DB]
        ← Response (fast)
        
- Acknowledge write after WAL (durable)
- Background process flushes to DB
```

**3. Database Write Scaling**
```
Partitioning (Sharding):
Writes distributed across shards:
- Shard 1: user_id 1-1M
- Shard 2: user_id 1M-2M
- Each shard handles 1/N traffic

Connection Pooling:
- Maintain 50 DB connections per app server
- Reuse connections (avoid connection overhead)
```

#### **Bottleneck Identification & Resolution**

**Interview Approach:**
```
1. Identify the bottleneck:
   "Which component will fail first at scale?"

2. Quantify the problem:
   "Database handles 5K QPS, but we need 50K QPS"

3. Propose solution:
   "Add read replicas + caching layer"

4. Show trade-offs:
   "Cost: +$500/month, Benefit: 10x read capacity"
```

**Common Bottlenecks:**

| Symptom | Bottleneck | Solution |
|---------|-----------|----------|
| Slow page loads | Database queries | Add indexes, caching |
| High server CPU | Heavy computation | Add workers, use queue |
| Database overload | Too many writes | Sharding, batch writes |
| Slow file uploads | Network bandwidth | Use CDN, multipart upload |
| Memory errors | Large datasets in memory | Pagination, streaming |

---

## 2. Back-of-Envelope Calculations (Mental Math Mastery)

### **Conversion Factors (Memorize These)**

```
Powers of 2:
2^10 = 1,024 ≈ 1 Thousand (1 KB)
2^20 = 1,048,576 ≈ 1 Million (1 MB)
2^30 = 1,073,741,824 ≈ 1 Billion (1 GB)
2^40 ≈ 1 Trillion (1 TB)

Time Conversions:
1 day = 86,400 seconds ≈ 100K seconds (round up)
1 month = 30 days ≈ 2.5M seconds
1 year = 365 days ≈ 31.5M seconds

Request Assumptions:
1M DAU with 20% concurrency = 200K concurrent users
Each user makes 10 requests/day
Peak traffic = 3x average (lunch hour, evening)
```

### **QPS Calculation Template**

```
Given: 100M Daily Active Users (DAU)

Step 1: Daily Requests
100M users × 10 requests/user = 1B requests/day

Step 2: Average QPS
1B requests ÷ 100K seconds/day = 10K QPS

Step 3: Peak QPS
10K QPS × 3 (peak multiplier) = 30K QPS

Step 4: Safety Margin
30K QPS × 2 (2x buffer) = 60K QPS (design target)
```

**Real Interview Example:**
```
Q: "Twitter has 500M DAU. Calculate read QPS for timelines."

A: 
- 500M DAU
- Each user checks timeline 50 times/day (heavy user)
- 500M × 50 = 25B reads/day
- 25B ÷ 100K seconds = 250K average read QPS
- Peak: 250K × 3 = 750K QPS
- Design for: 1.5M QPS (2x buffer)
```

### **Storage Calculation Template**

```
Twitter Example:
- 500M DAU
- Each user posts 2 tweets/day on average
- 500M × 2 = 1B tweets/day

Per Tweet Storage:
- tweet_id: 8 bytes (BIGINT)
- user_id: 8 bytes
- content: 280 chars × 2 bytes (UTF-8) = 560 bytes
- metadata: 200 bytes (timestamps, counts)
- Total: ~800 bytes ≈ 1 KB per tweet

Daily Storage:
1B tweets × 1 KB = 1 TB/day

Annual Storage:
1 TB/day × 365 days = 365 TB/year

With replication (3x):
365 TB × 3 = 1.1 PB/year

Media (images/videos):
- 20% of tweets have media
- Average media size: 2 MB
- 1B × 0.2 × 2 MB = 400 TB/day
- Annual: 146 PB (mostly in S3)
```

### **Bandwidth Calculation**

```
Given: 30K QPS, Average response size = 10 KB

Outgoing Bandwidth:
30K requests/sec × 10 KB = 300 MB/sec = 2.4 Gbps

With peak (3x):
2.4 Gbps × 3 = 7.2 Gbps

Network capacity needed:
10 Gbps link (with headroom)

Cost Estimation:
AWS bandwidth: $0.09/GB
300 MB/sec × 86,400 sec/day = 25 TB/day
25 TB × 30 days × $0.09 = $67,500/month
```

### **Memory Calculation (Caching)**

```
Cache 20% of hot data:

User cache:
- 500M users, cache 20% most active = 100M users
- Each user object: 1 KB
- 100M × 1 KB = 100 GB

Tweet cache (recent tweets):
- Cache last 24 hours of tweets
- 1B tweets/day × 1 KB = 1 TB
- Use LRU, keep top 10% hot tweets = 100 GB

Total cache memory:
100 GB (users) + 100 GB (tweets) = 200 GB

Redis servers needed:
- Each Redis instance: 64 GB RAM
- 200 GB ÷ 64 GB = 4 Redis servers (+ 1 for HA)
```

### **Server Count Calculation**

```
Given: 60K QPS target

Single server capacity:
- 1 server handles 500 QPS (measured benchmark)
- CPU: 8 cores, RAM: 32 GB

Servers needed:
60K QPS ÷ 500 QPS/server = 120 servers

With load balancing overhead (10%):
120 × 1.1 = 132 servers

With failure handling (N+1):
132 + 1 extra per load balancer = 135 servers

Deployment:
- 3 availability zones
- 45 servers per AZ
- Auto-scaling: min 30, max 60 per AZ
```

---

## 3. Clarifying Questions Checklist

### **Functional Scope Questions**

```
Use Cases:
□ "What are the core features we need to support?"
□ "Which features are MVP vs nice-to-have?"
□ "Are there any features explicitly out of scope?"

User Interactions:
□ "What actions can users perform?"
□ "Are there different user types/roles?"
□ "What's the typical user flow?"

Data Operations:
□ "What data needs to be created/stored?"
□ "What queries will users perform?"
□ "Are there any data transformations needed?"
```

### **Non-Functional (Scale) Questions**

```
Traffic:
□ "How many daily/monthly active users?"
□ "What's the expected QPS (reads and writes)?"
□ "What's the read/write ratio?"
□ "Any traffic patterns (peak hours, geography)?"

Data:
□ "How much data exists today?"
□ "What's the data growth rate?"
□ "How long should data be retained?"
□ "What's the average data size per entity?"

Performance:
□ "What's the acceptable latency (p50, p99)?"
□ "Are there any SLAs we need to meet?"
□ "Can we show stale data (eventual consistency)?"
□ "Any offline/batch processing acceptable?"

Availability:
□ "What's the uptime requirement (99.9% vs 99.99%)?"
□ "Can we have scheduled maintenance windows?"
□ "Multi-region deployment needed?"
□ "What's the disaster recovery plan?"
```

### **Constraints & Assumptions**

```
Technology:
□ "Any existing technology stack we must use?"
□ "Cloud provider preference (AWS/GCP/Azure)?"
□ "Budget constraints?"

Security:
□ "What's the authentication mechanism?"
□ "Any data privacy regulations (GDPR)?"
□ "Encryption requirements (at rest/in transit)?"

Integration:
□ "Any third-party services to integrate?"
□ "Existing systems to migrate from?"
```

---

## 4. Interview Execution Strategy (45-Minute Breakdown)

### **Time Allocation**

```
[0-5 min]   Requirements & Clarifications
[5-10 min]  High-Level Architecture
[10-15 min] API Design
[15-20 min] Data Model
[20-25 min] Back-of-Envelope Calculations
[25-40 min] Deep Dive (Interviewer chooses)
[40-45 min] Bottlenecks, Trade-offs, Q&A
```

### **Phase-by-Phase Script**

**Minutes 0-5: Requirements**
```
You: "Let me make sure I understand the requirements correctly."

[Write on whiteboard]
Functional:
1. [Feature 1]
2. [Feature 2]
...

Non-Functional:
- Scale: [X DAU, Y QPS]
- Latency: [< Z ms]
- Availability: [99.X%]

You: "Does this align with your expectations?"
Interviewer: [Confirms or corrects]
```

**Minutes 5-10: Architecture**
```
You: "I'll start with a high-level architecture and then drill down."

[Draw on whiteboard]
┌──────┐     ┌──────┐     ┌──────┐
│Client│────>│  LB  │────>│ API  │
└──────┘     └──────┘     └──────┘
                             │
                    ┌────────┼────────┐
                    ↓        ↓        ↓
                 [Cache]   [DB]   [Queue]

You: "The client makes requests through a load balancer, which 
routes to our API servers. We'll use caching for read performance,
a database for persistence, and queues for async processing."

Interviewer: [Asks for clarification or approves]
```

**Minutes 10-15: API Design**
```
You: "Let me define the key APIs for our core features."

POST /api/v1/tweets
{
  "content": "...",
  "media_ids": [...]
}
→ 201 Created { "tweet_id": "..." }

GET /api/v1/users/{id}/timeline?cursor=...&limit=20
→ 200 OK { "tweets": [...], "next_cursor": "..." }

You: "I'm using cursor-based pagination for the timeline since
offset-based would be slow for large result sets."
```

**Minutes 15-20: Data Model**
```
You: "For the database schema, I'll use [SQL/NoSQL] because..."

[Draw ERD or document structure]

users: user_id, username, email, created_at
tweets: tweet_id, user_id, content, created_at
follows: follower_id, following_id, created_at

You: "I'll partition tweets by user_id to distribute load evenly."
```

**Minutes 20-25: Calculations**
```
You: "Let me validate this can handle the scale."

500M DAU × 50 timeline checks/day = 25B reads/day
= 25B ÷ 100K sec/day = 250K QPS average
Peak (3x): 750K QPS

Storage:
1B tweets/day × 1 KB = 1 TB/day
Annual: 365 TB (+ 3x replication = 1 PB)

You: "Our database needs to handle 750K read QPS and store 1 PB.
We'll need sharding and aggressive caching."
```

**Minutes 25-40: Deep Dive**
```
Interviewer: "How will you handle the timeline generation at scale?"

You: "Great question. There are two approaches:"

[Write comparison]
Fan-out on write:
- Pre-compute timelines when tweet posted
- Fast reads (just query user's timeline table)
- Slow writes (fanout to all followers)
- Good for few followers

Fan-out on read:
- Compute timeline on-demand
- Fast writes
- Slow reads (query all followings' tweets)
- Good for many followers (celebrities)

Hybrid:
- Use fan-out on write for users with < 10K followers
- Use fan-out on read for celebrities (cached aggressively)

You: "I'd go with the hybrid approach to balance read/write performance."
```

**Minutes 40-45: Wrap-up**
```
Interviewer: "What are the main bottlenecks?"

You: "Three potential bottlenecks:

1. Timeline generation at write time
   → Solution: Hybrid fan-out approach

2. Database read load (750K QPS)
   → Solution: Read replicas + Redis caching

3. Celebrity tweets creating hot spots
   → Solution: Dedicated cache tier for viral content

Trade-offs I made:
- Eventual consistency for timelines (acceptable for social media)
- Higher storage cost for denormalization (worth it for read speed)
- Complex fan-out logic (necessary for scale)"

You: "Are there any specific areas you'd like me to elaborate on?"
```

---

## 5. Common Mistakes to Avoid

### **❌ Critical Errors**

```
1. Jumping to solutions without requirements
   ✅ Fix: Always spend 5 minutes on requirements

2. Over-engineering for small scale
   ❌ "We'll use Kafka and Kubernetes for 100 users"
   ✅ "Start with a monolith, scale later"

3. Ignoring numbers
   ❌ "We'll just use a database"
   ✅ "60K QPS needs 120 servers + caching"

4. Not asking questions
   ❌ Silent for 30 minutes, then presents solution
   ✅ Continuous dialogue with interviewer

5. Vague hand-waving
   ❌ "We'll use caching for performance"
   ✅ "Redis cache with LRU eviction, 200GB capacity"

6. Not considering trade-offs
   ❌ "This is the best solution"
   ✅ "Option A is faster but more expensive; Option B..."
```

---

## 6. Mnemonics & Memory Aids

### **REACD (Interview Steps)**
- **R**equirements (functional + non-functional)
- **E**stimation (QPS, storage, bandwidth)
- **A**PI design (REST endpoints)
- **C**omponents (architecture diagram)
- **D**eep-dive (bottlenecks, trade-offs)

### **SCALPER (Non-Functional Requirements)**
- **S**calability
- **C**onsistency
- **A**vailability
- **L**atency
- **P**erformance
- **E**xtensibility
- **R**eliability

---

## Module 5.2: Estimation & Capacity Planning (Deep Dive)

### 📊 The Math of Millions

#### **1. Traffic Estimation (DAU → QPS)**
**The Golden Conversion**:
`1M DAU ≈ 10 average QPS` (assuming 1 request/day).
If users do 10 actions/day: `1M DAU ≈ 100 QPS`.

**Formula**:
```
QPS = (DAU * requests_per_user) / 100,000 (approximate seconds in a day)
Peak QPS = Average QPS * 2 (or 3)
```

#### **2. Storage Calculations**
Determine consumption over 5 years.

**Formula**:
```
Total Storage = (Daily records * average_record_size * 365 days * 5 years) * Replication_Factor
```

**Common Record Sizes**:
- **User Metadata**: 1 KB
- **Tweet/Message**: 500 bytes - 1 KB
- **Image URL + Thumbnail**: 10 KB
- **Raw Image**: 2 MB
- **Raw Video (1 min)**: 50 MB

#### **3. Bandwidth Estimation**
**Formula**:
```
Bandwidth = QPS * Average Response Size
```

#### **4. Memory Calculations (Cache)**
Use the **80/20 Rule**: Cache 20% of the most active data to satisfy 80% of requests.

**Formula**:
```
Cache Size = Daily active records * size_per_record * 0.2
```

---

## Module 5.3: Trade-offs & Decision Making

### ⚖️ Choosing the Right Tool (SCPR Mnemonic)
Justify every choice using **SCPR**:
- **S**cale: Can it handle 100M users?
- **C**omplexity: Is it too hard to manage?
- **P**erformance: Is it fast enough?
- **R**esources: Is it cost-effective?

### 🔄 Comparison Matrix: Common Trade-offs

| Decision | Pros | Cons | Use Case |
|----------|------|------|----------|
| **SQL** | ACID, Joins, Schema | Hard to scale horizontally | Payments, User Profiles |
| **NoSQL** | High scale, Flexible, Easy sharding | Eventual consistency, No joins | Feeds, Chat, Analytics |
| **Sync** | Simple, Real-time feedback | Resource heavy, Blocking | Login, Payment Check |
| **Async** | Scalable, Fault-tolerant | Complex, Eventual consistency | Image Processing, EMails |
| **Push** | Instant, Real-time | Hotspot problem (celebrities) | Small group chat |
| **Pull** | Scalable for big accounts | Inefficient for inactive users | Twitter (Celebrity timeline) |

---

## Module 5.4: Common Patterns Recognition

### 🧩 System Types (RRBS Mnemonic)

#### **1. Read-heavy Systems (Feeds)**
- **Examples**: Facebook Newsfeed, Twitter Timeline.
- **Goal**: Low latency reads for millions.
- **Solution**: Pre-computing timelines (Fan-out on write), aggressive caching, CDNs.

#### **2. Real-time Systems (Chat/Streaming)**
- **Examples**: WhatsApp, Zoom, Discord.
- **Goal**: Sub-second synchronization.
- **Solution**: WebSockets, Long Polling, Pub/Sub (Redis), Kafka for history.

#### **3. Batch Processing Systems (Analytics)**
- **Examples**: Daily sales reports, user behavior logs.
- **Goal**: Accuracy and throughput over latency.
- **Solution**: Hadoop, Spark, Message Queues (Kafka), Data Lakes.

#### **4. Search-heavy Systems (Elastic)**
- **Examples**: Amazon Product Search, Google.
- **Goal**: High cardinality search + filtering.
- **Solution**: Inverted Index (Elasticsearch), Sharding by document type.

---

## Module 5.5: Communication & Presentation

### 🗣️ Thinking Aloud (The Senior Engineer Mindset)
In an interview, **what you say** is as important as **what you draw**.

#### **The CLEAR Mnemonic for Explanations**
- **C**oncise: Don't ramble. State the point.
- **L**ogical: Top-down approach (User → LB → API → DB).
- **E**ngaging: Ask the interviewer: "Does this scale satisfy your requirements?"
- **A**daptive: If they give you a hint, take it and pivot gracefully.
- **R**eflective: Honestly discuss the downsides of your chosen architecture.

---

## 🚀 Final HLD Success Roadmap

1. **Step 1**: Master the Building Blocks (Part 1).
2. **Step 2**: Learn to Scale (Part 2).
3. **Step 3**: Internalize Patterns (Part 3).
4. **Step 4**: Build for Resilience (Part 4).
5. **Step 5**: Master the Interview Game (Part 5).

---

# Practice Arena: Part 5 Challenges

### 🧠 Challenge 1: The "Why" Game
Pick three components (e.g., Redis, Kafka, Cassandra) and explain **why** you would use them for a specific problem (e.g., a Chat App) using the **SCPR** trade-offs.

### 🧠 Challenge 2: Back-of-Envelope Sprint
Calculate the storage requirements for a system that stores 1 Billion logs per day, each 1KB, for 90 days.
**Solution**: 1B * 1KB = 1TB/day. 1TB * 90 days = 90TB. Add 3x replication = 270TB.

---

🎉 **You have now completed the System Design Problem-Solving Framework!**
You are now fully equipped to step into any System Design interview and crack it with precision. 🚀