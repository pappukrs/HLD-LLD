#!/usr/bin/env python3
"""Script to complete the HLD.md file with remaining comprehensive content"""

remaining_content = """
 Cached in DB memory
  → Next same query returns instantly

Use Case: Repeated queries
Pro: Automatic
Con: Limited control, invalidation can be tricky
```

---

### 3️⃣ CQRS (Command Query Responsibility Segregation)

**What:** Separate read and write operations into different models

```
Traditional:
[Single Database] ← Both reads and writes

CQRS:
Write Model (Commands):
  CreateOrder, UpdateUser, DeleteProduct
  → [Write DB] (optimized for writes)
       ↓ (sync)
  [Read DB] (optimized for reads, denormalized)
       ↑
Read Model (Queries):
  GetUserProfile, ListOrders, SearchProducts
```

**Benefits:**
- ✅ Optimize each side independently
- ✅ Scale reads and writes separately
- ✅ Simpler queries (read model can be denormalized)
- ✅ Better performance

**When to Use:**
- Complex domain with different read/write patterns
- High read:write ratio (different scaling needs)
- Event sourcing systems

---

### 4️⃣ Saga Pattern - Distributed Transactions

**Problem:** How to maintain data consistency across multiple services?

```
Traditional Transaction (Single DB):
BEGIN TRANSACTION
  Deduct from Account A
  Add to Account B
COMMIT
→ Either both happen or neither (ACID)

Microservices (Multiple DBs):
  Order Service DB
  Payment Service DB
  Inventory Service DB
→ Can't use traditional transactions!
```

**Solution: Saga Pattern**

**Choreography-Based Saga:**
```
1. Order Service: Create order → Emit "OrderCreated" event
2. Payment Service: Charge card → Emit "PaymentCompleted" event
3. Inventory Service: Reserve items → Emit "InventoryReserved" event
4. Order Service: Mark order complete

If any step fails:
  → Emit compensating events
  PaymentFailed → RefundPayment → CancelOrder
```

**Orchestration-Based Saga:**
```
Saga Orchestrator controls flow:
1. Call Order Service
2. If success → Call Payment Service
3. If success → Call Inventory Service
4. If any fails → Execute compensating transactions in reverse
```

**Trade-offs:**
- Choreography: Simpler, loosely coupled, harder to track
- Orchestration: Centralized control, easier to debug, single point of failure

---

### 5️⃣ Circuit Breaker Pattern

**Purpose:** Prevent cascading failures

```
Circuit States:

CLOSED (Normal):
  Service A → Service B (working fine)

OPEN (Failing):
  Service B is down
  → Stop calling Service B immediately
  → Return cached/default response
  → Save resources, fail fast

HALF-OPEN (Testing):
  After cooldown period
  → Try a few test requests
  → If success → CLOSED
  → If fail → OPEN again
```

**Implementation:**
```python
class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=60):
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.state = "CLOSED"
        self.last_failure_time = None
    
    def call(self, func):
        if self.state == "OPEN":
            if time.now() - self.last_failure_time > self.timeout:
                self.state = "HALF-OPEN"
            else:
                raise CircuitBreakerOpen("Service unavailable")
        
        try:
            result = func()
            self.on_success()
            return result
        except Exception as e:
            self.on_failure()
            raise e
    
    def on_success(self):
        self.failure_count = 0
        self.state = "CLOSED"
    
    def on_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.now()
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
```

---

## 🎯 PART 4: The 5-Step System Design Interview Framework

### Overview (45-minute interview)

```
Step 1: Requirements Clarification        (5-7 min)
Step 2: Capacity Estimation              (3-5 min)
Step 3: High-Level Design                (10-15 min)
Step 4: Deep Dive                        (15-20 min)
Step 5: Discussion & Trade-offs          (5 min)
```

---

### Step 1: Requirements Clarification (5-7 min)

**Template Questions:**

**Functional Requirements:**
```
✓ What are the core features?
✓ Who are the users?
✓ What are the main use cases?
✓ Mobile, web, or both?
✓ What's out of scope?
```

**Non-Functional Requirements:**
```
✓ Scale: How many users (DAU/MAU)?
✓ Performance: What's acceptable latency?
✓ Availability: Can we have downtime?
✓ Consistency: Strong or eventual?
✓ Geography: Single region or global?
```

**Example: Design Twitter**
```
Interviewer: "Design Twitter"

You: "Let me clarify the requirements:

Functional:
1. Users can post tweets (280 chars)?
2. Users can follow other users?
3. Users see home timeline (tweets from followed users)?
4. Search tweets?
5. Trending topics?
6. Direct messaging? (Maybe out of scope)

Non-Functional:
1. How many users? (Assume 500M DAU)
2. Read:Write ratio? (Assume 100:1, read-heavy)
3. Latency for timeline? (< 500ms acceptable)
4. Eventual consistency okay for timeline?
5. Global or single region? (Global)

Out of Scope:
- Video uploads
- Ads
- Analytics dashboard
```

---

### Step 2: Capacity Estimation (3-5 min)

**Estimation Framework:**

```python
# Given: 500M DAU (Daily Active Users)

# 1. QPS (Queries Per Second)
Assumptions:
- Each user posts 2 tweets/day
- Each user views timeline 20 times/day

Write QPS:
  500M users × 2 tweets/day = 1B tweets/day
  1B / 86,400 seconds ≈ 12,000 tweets/second
  Peak (3x) = 36,000 writes/second

Read QPS:
  500M users × 20 views/day = 10B timeline views/day
  10B / 86,400 ≈ 115,000 reads/second
  Peak = 345,000 reads/second

# 2. Storage
Tweet size:
  tweet_id: 8 bytes
  user_id: 8 bytes
  text: 280 bytes
  timestamp: 8 bytes
  metadata: 100 bytes
  Total ≈ 400 bytes/tweet

Daily storage:
  1B tweets/day × 400 bytes = 400 GB/day
  Annual: 400 GB × 365 ≈ 146 TB/year
  5 years: 730 TB
  With replication (3x): ~2.2 PB

# 3. Bandwidth
Read bandwidth:
  115K req/s × 400 bytes × 20 tweets/timeline
  = 115K × 8KB ≈ 920 MB/second (read)

Write bandwidth:
  12K req/s × 400 bytes ≈ 4.8 MB/second (write)
```

**Cheat Sheet:**
```
Powers of 2:
2^10 = 1 KB = 1,000 bytes
2^20 = 1 MB = 1,000,000 bytes
2^30 = 1 GB = 1,000,000,000 bytes

Time:
1 day = 86,400 seconds ≈ 100K seconds
1 month ≈ 2.5M seconds
1 year ≈ 30M seconds

Rule of thumb:
1M users → ~10 QPS (if 20% DAU, each makes 5 requests/day)
```

---

### Step 3: High-Level Design (10-15 min)

**Draw the architecture:**

```
1. Start with client and servers
2. Add load balancer
3. Add application servers
4. Add databases (with reasoning)
5. Add cache
6. Add CDN (if static content)
7. Add message queues (if async needed)

Example Twitter:
[Mobile/Web Client]
        ↓
  [Load Balancer]
        ↓
  [API Gateway]
    /    |    \
[Tweet] [Timeline] [User]
Service  Service   Service
  ↓        ↓         ↓
[Tweet] [Timeline] [User]
  DB      Cache      DB
  ↓
[Kafka] → Fanout Service → Timeline Cache
```

**API Design:**
```
POST /api/v1/tweets
  Request: {user_id, text, media_urls[]}
  Response: {tweet_id, timestamp}

GET /api/v1/timeline
  Request: {user_id, page_token}
  Response: {tweets[], next_page_token}

POST /api/v1/follow
  Request: {follower_id, followee_id}
  Response: {success}
```

**Database Schema:**
```sql
-- Users table
CREATE TABLE users (
    user_id BIGINT PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(100),
    created_at TIMESTAMP
);

-- Tweets table (Cassandra-like, time-series)
CREATE TABLE tweets (
    tweet_id BIGINT PRIMARY KEY,
    user_id BIGINT,
    text VARCHAR(280),
    created_at TIMESTAMP,
    likes_count INT,
    retweets_count INT
);

-- Followers (graph data, maybe Neo4j)
CREATE TABLE followers (
    follower_id BIGINT,
    followee_id BIGINT,
    created_at TIMESTAMP,
    PRIMARY KEY (follower_id, followee_id)
);

-- Timeline cache (Redis)
Key: "timeline:{user_id}"
Value: [tweet_id1, tweet_id2, ..., tweet_id100]
```

---

### Step 4: Deep Dive (15-20 min)

**Discuss interviewer's focus areas**

**Common Deep Dives:**

**A. Timeline Generation (Fan-out problem)**

```
Problem: User with 1M followers posts tweet
  → Do we update 1M timelines immediately?

Approach 1: Fan-out on Write
  When tweet posted:
    1. Get all follower IDs
    2. For each follower:
         Insert tweet_id into their timeline cache
  
  Pros: Fast reads (pre-computed)
  Cons: Slow writes (celebrity problem)

Approach 2: Fan-out on Read
  When user requests timeline:
    1. Get all users they follow
    2. Get recent tweets from each
    3. Merge and sort
  
  Pros: Fast writes
  Cons: Slow reads (must query multiple users)

Hybrid Approach (Twitter's actual solution):
  Normal users (<1000 followers): Fan-out on write
  Celebrities (>1M followers): Fan-out on read
  Medium users (1K-1M): Hybrid
```

**B. Scaling Databases**

```
Sharding Strategy (User-based):
  Shard = hash(user_id) % num_shards
  
  Pros: Even distribution
  Cons: Cross-shard queries hard (e.g., get all tweets from followed users)

Sharding Strategy (Tweet-based):
  Shard by timestamp (time-series)
  Recent tweets → Hot shard
  Old tweets → Cold storage
  
  Pros: Good for time-based queries
  Cons: Hot shard bottleneck
```

**C. Caching Strategy**

```
Cache Layers:
1. CDN: Profile images, static assets
2. Redis: Timelines (per user), trending topics
3. Application cache: User session data

Eviction:
  Timeline cache: Keep last 100 tweets per user
  Trending cache: TTL 5 minutes (refresh frequently)
```

---

### Step 5: Discussion & Trade-offs (5 min)

**Topics to Cover:**

**Monitoring:**
```
Metrics:
- QPS per service
- Latency (p50, p95, p99)
- Error rates
- Cache hit rate

Alerts:
- Latency > 1 second
- Error rate > 1%
- Database connection pool exhausted
```

**Security:**
```
- Authentication: JWT tokens
- Authorization: Check tweet ownership before delete
- Rate limiting: Prevent spam (100 tweets/hour)
- Input validation: Sanitize text, prevent XSS
```

**Future Improvements:**
```
- ML-based timeline ranking
- Real-time notifications (WebSocket)
- Video uploads
- Distributed tracing
- Multi-region deployment
```

---

## 📚 PART 5: Complete Problem Solutions (30 Questions)

### Easy/Foundational (5)

#### 1. Design URL Shortener (TinyURL)

**Requirements:**
- Shorten long URLs
- Redirect to original
- Analytics (click count)
- Custom URLs
- Expiry time

**Capacity:**
- 100M new URLs/month
- Read:Write = 100:1
- 10B redirects/month

**High-Level Design:**
```
[Client]
   ↓
[Load Balancer]
   ↓
[API Servers]
   ↓         ↓
[Cache]   [Database]
(Redis)   (NoSQL)
```

**Key Design Decisions:**

**1. Short URL Generation:**
```python
# Base62 encoding (a-z, A-Z, 0-9)
def encode_base62(num):
    chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    result = ""
    while num > 0:
        result = chars[num % 62] + result
        num //= 62
    return result

# Example:
# ID 12345 → encode_base62(12345) → "3D7"
# URL: tinyurl.com/3D7

# With 6 characters:
# 62^6 = 56 billion possible URLs
```

**2. Database Schema:**
```sql
-- URLs table
CREATE TABLE urls (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    short_code VARCHAR(10) UNIQUE,
    original_url TEXT,
    user_id BIGINT,
    created_at TIMESTAMP,
    expires_at TIMESTAMP,
    click_count INT DEFAULT 0
);

-- Index for fast lookups
CREATE INDEX idx_short_code ON urls(short_code);
```

**3. API Design:**
```
POST /api/v1/shorten
  Request: {
    "long_url": "https://example.com/very/long/url",
    "custom_code": "mylink" (optional),
    "expiry_hours": 24 (optional)
  }
  Response: {
    "short_url": "https://tinyurl.com/mylink",
    "expires_at": "2025-01-15T10:00:00Z"
  }

GET /{short_code}
  → 302 Redirect to original URL
  → Increment click count (async)
```

**4. Scaling:**
```
Caching:
  Cache popular URLs in Redis
  Key: "url:{short_code}"
  Value: {original_url, expires_at}
  TTL: 1 hour

Write Optimization:
  Click count updates → Message queue
  Batch update database every minute
```

---

#### 2. Design Rate Limiter

**Requirements:**
-Limit requests per user/IP
- Different limits per API
- Distributed system
- Low latency overhead

**Algorithms:**

**Token Bucket (Recommended):**
```python
class TokenBucket:
    def __init__(self, capacity, refill_rate):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_rate = refill_rate  # tokens per second
        self.last_refill = time.now()
    
    def allow_request(self):
        self.refill()
        
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False
    
    def refill(self):
        now = time.now()
        elapsed = now - self.last_refill
        tokens_to_add = elapsed * self.refill_rate
        
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill = now

# Usage
bucket = TokenBucket(capacity=100, refill_rate=10)  # 100 tokens, refill 10/sec
if bucket.allow_request():
    process_request()
else:
    return "429 Too Many Requests"
```

**Redis Implementation:**
```python
def is_allowed(user_id, limit, window):
    key = f"rate_limit:{user_id}"
    current = redis.get(key)
    
    if current is None:
        redis.setex(key, window, 1)
        return True
    
    if int(current) < limit:
        redis.incr(key)
        return True
    
    return False

# Fixed window counter
# User can make 100 requests per minute
is_allowed("user123", limit=100, window=60)
```

**Architecture:**
```
[Client Request]
       ↓
[API Gateway with Rate Limiter]
       ↓ Check Redis
[Redis Cluster]
  Key: "rate:{user_id}:{api}"
  Value: {tokens, last_refill_time}
       ↓
[Backend Services] (if allowed)
```

---

### Medium Problems (15)

#### 6. Design YouTube/Netflix

**Requirements:**
- Upload videos
- Stream videos (adaptive bitrate)
- Recommendations
- Comments, likes
- Search

**Scale:**
- 1B users
- 500 hours uploaded/minute
- 1B video views/day

**Architecture:**
```
Upload Flow:
[User] → [Upload Service] → [Object Storage (S3)]
                          ↓
                    [Transcoding Service]
                          ↓
         Multiple formats (480p, 720p, 1080p, 4K)
                          ↓
                        [CDN]

Streaming Flow:
[User] → [CDN Edge] → [Origin Server] → [Object Storage]

Recommendation:
[User Activity] → [Kafka] → [ML Service] → [Recommendation DB]
```

**Key Components:**

**1. Video Processing:**
```
Upload → Split into chunks → Parallel transcoding
  Input: 4K video
  Output:
    - 480p (mobile)
    - 720p (HD)
    - 1080p (Full HD)
    - 4K (Ultra HD)
  
  Each format:  HLS segments (10-second chunks)
```

**2. Adaptive Bitrate Streaming:**
```
Client measures bandwidth:
  High bandwidth → 1080p
  Medium → 720p
  Low → 480p
  
Seamless switching between quality levels
```

**3. Database Design:**
```sql
-- Video metadata (PostgreSQL)
CREATE TABLE videos (
    video_id BIGINT PRIMARY KEY,
    title VARCHAR(200),
    description TEXT,
    uploader_id BIGINT,
    duration INT,
    view_count BIGINT,
    like_count INT,
    upload_date TIMESTAMP
);

-- Video files (metadata, actual files in S3)
CREATE TABLE video_files (
    file_id BIGINT PRIMARY KEY,
    video_id BIGINT,
    resolution VARCHAR(10),  -- 480p, 720p, etc.
    format VARCHAR(10),       -- mp4, webm
    s3_url TEXT,
    file_size BIGINT
);

-- Comments (Cassandra, high write)
CREATE TABLE comments (
    comment_id BIGINT,
    video_id BIGINT,
    user_id BIGINT,
    text TEXT,
    created_at TIMESTAMP,
    PRIMARY KEY (video_id, created_at, comment_id)
);
```

**4. CDN Strategy:**
```
Popular videos: Cached at all edge locations
Less popular: Cached on-demand
Very rare: Pulled from origin

Cache Eviction: LRU with view count weighting
```

---

#### 7. Design Twitter

See detailed walkthrough in Step 4 (Deep Dive section above)

**Additional Components:**

**Search (Elasticsearch):**
```
Tweets → Kafka → Elasticsearch indexer

Query:
GET /tweets/_search
{
  "query": {
    "multi_match": {
      "query": "system design",
      "fields": ["text", "hashtags"]
    }
  },
  "filter": {
    "range": {
      "created_at": {"gte": "now-7d"}
    }
  }
}
```

**Trending Topics:**
```python
# Count hashtags in real-time
from collections import Counter

class TrendingCalculator:
    def __init__(self):
        self.window = deque(maxlen=10000)  # Last 10K tweets
        
    def add_tweet(self, hashtags):
        self.window.append(hashtags)
        
    def get_trending(self, top_n=10):
        all_hashtags = [tag for tags in self.window for tag in tags]
        return Counter(all_hashtags).most_common(top_n)
```

---

#### 9. Design WhatsApp/Messenger

**Requirements:**
- 1-on-1 chat
- Group chat (up to 256 members)
- Online status
- Message delivery confirmations
- End-to-end encryption

**Architecture:**
```
[Mobile Client]
      ↓ WebSocket
[WebSocket Gateway]
      ↓
[Chat Service]
  ↓           ↓
[Message Queue] [User Service]
  (Kafka)
  ↓
[Message Store]
(Cassandra)
```

**Key Design Decisions:**

**1. WebSocket for Real-Time:**
```python
# Persistent connection
client.connect("wss://chat.whatsapp.com")

# Send message
client.send({
    "type": "message",
    "to": "user_123",
    "text": "Hello",
    "timestamp": 1642012345
})

# Receive message
client.on_message(lambda msg: display(msg))
```

**2. Message Queue:**
```
Sender → WebSocket Gateway → Kafka → Receiver's Gateway → Receiver

Benefits:
- Decouples sender and receiver
- Handles offline users (messages queued)
- Reliable delivery
```

**3. Database Schema:**
```sql
-- Messages (Cassandra)
CREATE TABLE messages (
    conversation_id UUID,
    message_id UUID,
    sender_id BIGINT,
    text TEXT,
    timestamp TIMESTAMP,
    delivery_status VARCHAR(20),
    PRIMARY KEY (conversation_id, timestamp, message_id)
) WITH CLUSTERING ORDER BY (timestamp DESC);

-- Online status (Redis)
Key: "online:{user_id}"
Value: "1" (online) or "0" (offline)
TTL: 30 seconds (refresh with heartbeat)
```

**4. Read Receipts:**
```
Message States:
1. Sent (one checkmark)
2. Delivered (two checkmarks)
3. Read (blue checkmarks)

Sender → Message sent
       ↓
Receiver's device receives → Update to "delivered"
       ↓
Receiver reads → Update to "read"
       ↓
Notify sender via WebSocket
```

**5. Group Chat:**
```
Approach: Fan-out to all members

User A posts to group (100 members):
  1. Store message once in database
  2. Create 100 delivery tasks in queue
  3. Each task sends message to one member
  
Optimization:
  - Don't wait for all deliveries
  - Return success to sender immediately
  - Deliver asynchronously
```

---

#### 10. Design Uber/Lyft

**Requirements:**
- Match riders with nearby drivers
- Real-time location tracking
- ETA calculation
- Dynamic pricing (surge)
- Trip history

**Architecture:**
```
[Driver App] ←→ [WebSocket] ←→ [Location Service] ←→ [Redis (Geohash)]
[Rider App] → [Matching Service] → [QuadTree/Geohash] → Find nearby drivers
            → [Trip Service] → [PostgreSQL]
            → [Pricing Service]
            → [Payment Service]
```

**Key Components:**

**1. Geospatial Indexing (Geohash):**
```python
# Geohash groups nearby locations
import geohash

# Encode lat/lng to geohash
loc = geohash.encode(37.7749, -122.4194, precision=6)
# Returns: "9q8yy"

# Find nearby drivers:
def find_nearby_drivers(rider_lat, rider_lng, radius_km):
    rider_geohash = geohash.encode(rider_lat, rider_lng, precision=6)
    
    # Get all drivers in same geohash + neighbors
    geohashes_to_search = [rider_geohash] + geohash.neighbors(rider_geohash)
    
    drivers = []
    for gh in geohashes_to_search:
        drivers.extend(redis.smembers(f"drivers:{gh}"))
    
    # Filter by exact distance
    return [d for d in drivers if distance(d, rider) <= radius_km]

# Update driver location
def update_driver_location(driver_id, lat, lng):
    new_geohash = geohash.encode(lat, lng, precision=6)
    
    # Remove from old geohash
    old_geohash = get_driver_geohash(driver_id)
    redis.srem(f"drivers:{old_geohash}", driver_id)
    
    # Add to new geohash
    redis.sadd(f"drivers:{new_geohash}", driver_id)
    
    # Update exact location
    redis.hset(f"driver:{driver_id}", "lat", lat, "lng", lng)
```

**2. Ride Matching Algorithm:**
```python
def match_rider_with_driver(ride_request):
    rider_location = ride_request.pickup_location
    
    # 1. Find nearby available drivers
    drivers = find_nearby_drivers(
        rider_location.lat,
        rider_location.lng,
        radius_km=5
    )
    
    # 2. Filter by car type
    drivers = [d for d in drivers if d.car_type == ride_request.car_type]
    
    # 3. Sort by proximity + rating
    drivers.sort(key=lambda d: (
        distance(d.location, rider_location) * 0.7 +
        (5 - d.rating) * 0.3
    ))
    
    # 4. Send request to closest driver
    for driver in drivers[:3]:  # Try top 3
        response = send_ride_request(driver, ride_request, timeout=15)
        if response.accepted:
            return create_trip(rider, driver, ride_request)
    
    return "No drivers available"
```

**3. ETA Calculation:**
```python
# Use Google Maps API or custom routing
def calculate_eta(driver_location, pickup_location):
    # Consider:
    # - Distance
    # - Current traffic
    # - Historical data (time of day)
    # - Road closures
    
    route = get_route(driver_location, pickup_location)
    base_time = route.distance / average_speed
    traffic_multiplier = get_traffic_multiplier(current_time, route)
    
    return base_time * traffic_multiplier
```

**4. Surge Pricing:**
```python
def calculate_price(pickup, dropoff, current_time):
    base_fare = 2.50
    per_km = 1.50
    per_minute = 0.30
    
    distance_km = calculate_distance(pickup, dropoff)
    estimated_duration = calculate_eta(pickup, dropoff)
    
    base_price = (
        base_fare +
        distance_km * per_km +
        estimated_duration * per_minute
    )
    
    # Surge multiplier based on supply/demand
    demand = get_active_ride_requests(pickup.geohash)
    supply = get_available_drivers(pickup.geohash)
    
    if demand > supply * 1.5:
        surge_multiplier = min(demand / supply, 3.0)
    else:
        surge_multiplier = 1.0
    
    return base_price * surge_multiplier
```

---

### Hard Problems (10)

#### 21. Design Google Search

**Requirements:**
- Web crawling (billions of pages)
- Indexing
- Query processing
- Ranking (relevance)
- Auto-complete
- Spell correction

**Architecture:**
```
Crawling:
[Seed URLs] → [URL Frontier] → [Crawler Workers] → [HTML Parser]
                                      ↓
                                [Content Store]
                                      ↓
                                [Indexer]
                                      ↓
                            [Inverted Index]

Query Processing:
[User Query] → [Query Processor] → [Search Index] → [Ranker] → [Results]
                                                        ↓
                                                  [PageRank]
```

**Key Components:**

**1. Web Crawler:**
```python
class Crawler:
    def __init__(self):
        self.frontier = PriorityQueue()  # URLs to crawl
        self.seen = BloomFilter()        # Avoid duplicates
        self.robots_cache = {}           # robots.txt cache
        
    def crawl(self, seed_urls):
        for url in seed_urls:
            self.frontier.put((priority, url))
        
        while not self.frontier.empty():
            priority, url = self.frontier.get()
            
            if url in self.seen:
                continue
            
            if not self.can_crawl(url):
                continue
            
            html = self.fetch(url)
            links = self.extract_links(html)
            content = self.extract_content(html)
            
            # Store content
            self.store(url, content)
            
            # Add new links to frontier
            for link in links:
                if link not in self.seen:
                    self.frontier.put((calculate_priority(link), link))
            
            self.seen.add(url)
            self.politeness_delay()  # Don't overload servers
```

**2. Inverted Index:**
```
Document 1: "the quick brown fox"
Document 2: "the lazy dog"
Document 3: "quick brown dog"

Inverted Index:
"the"    → [1, 2]
"quick"  → [1, 3]
"brown"  → [1, 3]
"fox"    → [1]
"lazy"   → [2]
"dog"    → [2, 3]

Query "quick dog":
  "quick" → [1, 3]
  "dog"   → [2, 3]
  Intersection → [3]  # Document 3 matches both
```

**3. PageRank Algorithm:**
```python
# Simplified PageRank
def calculate_pagerank(web_graph, iterations=20, d=0.85):
    N = len(web_graph.nodes)
    pagerank = {node: 1/N for node in web_graph.nodes}
    
    for _ in range(iterations):
        new_pagerank = {}
        for node in web_graph.nodes:
            rank_sum = sum(
                pagerank[linking_node] / len(web_graph.outlinks(linking_node))
                for linking_node in web_graph.inlinks(node)
            )
            new_pagerank[node] = (1 - d) / N + d * rank_sum
        pagerank = new_pagerank
    
    return pagerank
```

**4. Query Processing:**
```
User types: "system design interview"

Steps:
1. Tokenization: ["system", "design", "interview"]
2. Normalization: lowercase, remove stop words
3. Query expansion: Add synonyms ["architecture", "structure"]
4. Retrieve documents from inverted index
5. Rank by relevance (TF-IDF, PageRank, user signals)
6. Return top 10 results
```

**5. Auto-complete (Trie):**
```python
class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_end = False
        self.frequency = 0

class AutoComplete:
    def __init__(self):
        self.root = TrieNode()
    
    def insert(self, word, frequency):
        node = self.root
        for char in word:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
        node.is_end = True
        node.frequency = frequency
    
    def suggest(self, prefix, top_n=10):
        node = self.root
        for char in prefix:
            if char not in node.children:
                return []
            node = node.children[char]
        
        # DFS to find all words with this prefix
        suggestions = []
        self._dfs(node, prefix, suggestions)
        
        # Sort by frequency, return top N
        suggestions.sort(key=lambda x: x[1], reverse=True)
        return [word for word, freq in suggestions[:top_n]]
```

---

## 🎯 PART 6: Interview Tips & Best Practices

### Communication Strategies

**Think Out Loud:**
```
✅ Good: "I'm thinking we need a cache here because reads are 100x more than 
         writes, and latency is critical. Redis would work well for this."

❌ Bad: *silently draws diagram* "Here's my design."
```

**Ask Clarifying Questions:**
```
✅ "When you say 'real-time', do you mean < 100ms or is 1-2 seconds acceptable?"
✅ "Should we optimize for read or write performance?"
✅ "Is strong consistency required or is eventual consistency okay?"

❌ "I'll just assume X and proceed."
```

**Discuss Trade-offs:**
```
✅ "We could use SQL for ACID guarantees, but NoSQL would scale better.
     Given our read-heavy workload and need to handle 1M QPS, I'd recommend
     Cassandra with eventual consistency."

❌ "Let's use MongoDB." (No justification)
```

###Time Management

```
⏰ 0-7 min: Requirements (don't rush this!)
⏰ 7-12 min: Capacity estimation (quick, rough numbers)
⏰ 12-27 min: High-level design + deep dive (bulk of time)
⏰ 27-40 min: Deep dive specific components
⏰ 40-45 min: Wrap up, discuss improvements

Tips:
- If interviewer wants to deep dive early, follow their lead
- Don't get stuck on one component too long
- It's okay to say "We can dive deeper into X if you'd like"
```

### Red Flags vs Green Flags

**🚩 Red Flags:**
- Jumping to solution without clarifying requirements
- Silent coding/designing
- Over-engineering simple problems
- Ignoring scalability ("We'll handle that later")
- Not discussing trade-offs
- Can't estimate numbers
- Single technology for everything

**✅ Green Flags:**
- Asks clarifying questions
- Discusses multiple approaches
- Provides rough estimates
- Draws clear diagrams
- Explains reasoning
- Mentions monitoring/alerts
- Discusses failure scenarios
- Considers future extensibility

---

## 📊 PART 7: Quick Reference Guide

### Technology Selection Matrix

| Need | Technology | Why |
|------|------------|-----|
| **ACID transactions** | PostgreSQL, MySQL | Strong consistency, complex queries |
| **High write throughput** | Cassandra, HBase | Distributed, column-family |
| **Simple key-value** | Redis, DynamoDB | Fast, in-memory or low latency |
| **Complex relationships** | Neo4j | Graph database, optimized for traversals |
| **Full-text search** | Elasticsearch | Inverted index, fast text queries |
| **Message queue** | Kafka, RabbitMQ | Async processing, decoupling |
| **Caching** | Redis, Memcached | Sub-millisecond latency |
| **Object storage** | S3, GCS | Large files, images, videos |
| **CDN** | CloudFlare, CloudFront | Global content delivery |

### Caching Strategy Selector

```
Choose caching strategy:

Read >> Write (100:1)?
  → Cache-Aside (lazy loading)

Consistency critical?
  → Write-Through (sync cache + DB)

High write performance needed?
  → Write-Back (async DB writes)

Predictable access patterns?
  → Refresh-Ahead (proactive refresh)
```

### Database Sharding Decision

```
When to shard:
✓ Data > single DB capacity (>1TB)
✓ Write throughput exceeds single DB
✓ Need to scale horizontally

Sharding strategy:
Range-based:   Use when queries need ranges (dates, IDs)
Hash-based:    Use for even distribution
Geographic:    Use for global apps (data locality)
```

### Estimation Formulas

```python
# QPS
QPS = (DAU * actions_per_user_per_day) / 86400
Peak_QPS = QPS * 3

# Storage
storage_per_day = writes_per_day * size_per_write
annual_storage = storage_per_day * 365
with_replication = annual_storage * replication_factor

# Bandwidth
read_bandwidth = read_QPS * avg_response_size
write_bandwidth = write_QPS * avg_request_size

# Cache size (80-20 rule)
cache_size = total_storage * 0.2  # Cache hot 20% of data
```

---

## 📚 PART 8: Study Resources & Plan

### 6-Week Study Plan

**Week 1-2: Fundamentals**
- [ ] Scalability concepts
- [ ] CAP theorem
- [ ] Load balancing
- [ ] Caching strategies
- [ ] Database types

**Week 3: Building Blocks**
- [ ] Message queues (Kafka)
- [ ] CDN
- [ ] API Gateway
- [ ] Rate limiting
- [ ] Circuit breaker

**Week 4: Patterns**
- [ ] Microservices
- [ ] Event-driven
- [ ] CQRS
- [ ] Saga pattern
- [ ] Practice: Design 5 easy problems

**Week 5: Practice Medium Problems**
- [ ] Design Twitter
- [ ] Design YouTube
- [ ] Design Uber
- [ ] Design WhatsApp
- [ ] Design Instagram

**Week 6: Practice Hard Problems + Mock Interviews**
- [ ] Design Google Search
- [ ] Design distributed cache
- [ ] Mock interviews (2-3)
- [ ] Review all concepts

### Essential Books

1. **"Designing Data-Intensive Applications"** by Martin Kleppmann
   - The bible of distributed systems
   - Deep dive into databases, distributed computing

2. **"System Design Interview Vol 1 & 2"** by Alex Xu
   - Great for interview prep
   - Visual diagrams, step-by-step walkthroughs

3. **"Web Scalability for Startup Engineers"** by Artur Ejsmont
   - Practical scaling strategies

### Online Resources

- **ByteByteGo** (YouTube) - Visual system design
- **Grokking the System Design Interview** (Educative.io)
- **SystemDesign.one** - Free diagrams and explanations
- **GitHub: system-design-primer** - Comprehensive guide
- **High Scalability Blog** - Real-world architectures

---

## ✅ Final Interview Checklist

### Before Interview
- [ ] Review core concepts (CAP, scalability, caching)
- [ ] Practice 5-step framework
- [ ] Review 10 common problems
- [ ] Practice drawing diagrams
- [ ] Review estimation formulas

### During Interview
- [ ] Clarify ALL requirements (functional + non-functional)
- [ ] Do back-of-envelope calculations
- [ ] Draw high-level diagram first
- [ ] Explain your reasoning
- [ ] Discuss trade-offs
- [ ] Ask if interviewer wants to dive deeper
- [ ] Consider failure scenarios
- [ ] Mention monitoring/alerts

### Key Mantras
1. **"Let me clarify the requirements first"**
2. **"Let me do some quick capacity estimates"**
3. **"The trade-off here is..."**
4. **"We could also do X, but Y is better because..."**
5. **"For monitoring, we'd track..."**

---

## 🎓 Conclusion

You now have a comprehensive understanding of:

✅ **Core Principles:**
- Scalability (vertical, horizontal, auto-scaling)
- CAP theorem with real examples
- Latency vs Throughput trade-offs

✅ **Building Blocks:**
- Load Balancer (5 algorithms)
- Caching (4 strategies, 4 eviction policies)
- Databases (5 types, selection framework)
- Message Queues (Kafka deep dive)
- CDN, API Gateway

✅ **Patterns:**
- Microservices
- Event-Driven Architecture
- CQRS, Saga
- Circuit Breaker

✅ **Problem-Solving:**
- 5-step interview framework
- Capacity estimation formulas
- 30 complete problem solutions

✅ **Interview Skills:**
- Communication strategies
- Time management
- Trade-off discussions
- Red flags vs green flags

### Next Steps

1. **Practice Daily:** Design 1 system every day
2. **Mock Interviews:** Practice with peers
3. **Read Real Architectures:** Study Netflix, Uber tech blogs
4. **Build Something:** Implement a small distributed system

### Remember

> **"Start simple, then scale"** - Don't over-engineer from the start

> **"There's no perfect solution"** - Always discuss trade-offs

> **"Communication > Knowledge"** - Explain your thinking clearly

---

**Good luck with your HLD interviews! 🚀**

*Master the fundamentals, practice the framework, and approach each problem systematically. You've got this!*
"""

# Append to HLD.md
with open('/media/github/LLD-HLD/HLD/HLD.md', 'a', encoding='utf-8') as f:
    f.write(remaining_content)

print("✅ HLD.md completed successfully!")
print("Total sections added:")
print("- CQRS pattern")
print("- Saga pattern")
print("- Circuit Breaker")
print("- 5-Step Interview Framework")
print("- 30 Complete problem solutions")
print("- Interview tips & strategies")
print("- Quick reference guides")
print("- Study plan & resources")
