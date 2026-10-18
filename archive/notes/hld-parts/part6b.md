# **Module 6.2: Notification & Communication Systems - Complete Mastery Guide**

## **🎯 Overview**
This module covers **5 critical distributed communication systems** that handle user notifications, rate limiting, task scheduling, webhooks, and email delivery. Master these to handle any interview question on **asynchronous communication, delivery guarantees, and distributed coordination**.

---

## **📚 Part 1: Notification System (Email, SMS, Push)**

### **1.1 Problem Statement**
Design a system that can send **millions of notifications** across multiple channels (email, SMS, push) with:
- High throughput (10M+ notifications/day)
- Delivery tracking
- User preferences management
- Template support
- Retry logic

### **1.2 Core Building Blocks**

#### **A. Architecture Components**
```
┌─────────────┐
│   API       │ ← User triggers notification
│   Gateway   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Notification│ ← Validates, enriches, applies preferences
│   Service   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Message    │ ← Kafka/RabbitMQ for buffering
│   Queue     │
└──────┬──────┘
       │
       ├───────────────┬───────────────┐
       ▼               ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐
│  Email   │    │   SMS    │    │   Push   │
│  Worker  │    │  Worker  │    │  Worker  │
└──────────┘    └──────────┘    └──────────┘
       │               │               ▼
       ▼               ▼         Third-party
   SMTP Server    Twilio/SNS    FCM/APNS
```

#### **B. Database Schema**
```sql
-- User preferences
CREATE TABLE user_notification_preferences (
    user_id BIGINT PRIMARY KEY,
    email_enabled BOOLEAN DEFAULT true,
    sms_enabled BOOLEAN DEFAULT false,
    push_enabled BOOLEAN DEFAULT true,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    timezone VARCHAR(50),
    created_at TIMESTAMP
);

-- Templates
CREATE TABLE notification_templates (
    template_id VARCHAR(50) PRIMARY KEY,
    channel ENUM('email', 'sms', 'push'),
    subject_template TEXT,
    body_template TEXT,
    variables JSONB,  -- {user_name, order_id, etc.}
    version INT,
    created_at TIMESTAMP
);

-- Tracking
CREATE TABLE notification_logs (
    notification_id UUID PRIMARY KEY,
    user_id BIGINT,
    channel VARCHAR(20),
    template_id VARCHAR(50),
    status ENUM('pending', 'sent', 'failed', 'delivered', 'bounced'),
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    error_message TEXT,
    retry_count INT DEFAULT 0
);
```

#### **C. Message Queue Structure**
```json
// Kafka message format
{
  "notification_id": "uuid-1234",
  "user_id": 789456,
  "channel": "email",
  "priority": "high",  // high, medium, low
  "template_id": "order_confirmation",
  "variables": {
    "user_name": "John",
    "order_id": "ORD-9876"
  },
  "scheduled_at": "2025-01-14T10:00:00Z",
  "retry_policy": {
    "max_retries": 3,
    "backoff": "exponential"
  }
}
```

### **1.3 Key Algorithms**

#### **A. Priority Queue Implementation**
```python
import heapq
from dataclasses import dataclass
from datetime import datetime

@dataclass
class Notification:
    id: str
    user_id: int
    channel: str
    priority: int  # 1=high, 2=medium, 3=low
    scheduled_at: datetime
    
    def __lt__(self, other):
        # Higher priority first, then by scheduled time
        if self.priority != other.priority:
            return self.priority < other.priority
        return self.scheduled_at < other.scheduled_at

class NotificationPriorityQueue:
    def __init__(self):
        self.heap = []
        
    def push(self, notification: Notification):
        heapq.heappush(self.heap, notification)
        
    def pop(self) -> Notification:
        return heapq.heappop(self.heap)
    
    def peek(self) -> Notification:
        return self.heap[0] if self.heap else None
```

#### **B. Exponential Backoff Retry**
```python
import time
import random

class RetryHandler:
    def __init__(self, max_retries=3, base_delay=1, max_delay=60):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
    
    def execute_with_retry(self, func, *args, **kwargs):
        for attempt in range(self.max_retries + 1):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                if attempt == self.max_retries:
                    raise  # Final attempt failed
                
                # Calculate exponential backoff with jitter
                delay = min(
                    self.base_delay * (2 ** attempt) + random.uniform(0, 1),
                    self.max_delay
                )
                
                print(f"Attempt {attempt + 1} failed: {e}. Retrying in {delay}s")
                time.sleep(delay)

# Usage
retry = RetryHandler(max_retries=3)
retry.execute_with_retry(send_email, user_id=123, template="welcome")
```

#### **C. User Preference Filtering**
```python
from datetime import datetime
import pytz

def should_send_notification(user_prefs, notification):
    """
    Check if notification should be sent based on user preferences
    """
    # Channel enabled?
    channel = notification['channel']
    if not user_prefs.get(f'{channel}_enabled', False):
        return False
    
    # Quiet hours check
    if user_prefs.get('quiet_hours_start') and user_prefs.get('quiet_hours_end'):
        user_tz = pytz.timezone(user_prefs.get('timezone', 'UTC'))
        current_time = datetime.now(user_tz).time()
        
        start = user_prefs['quiet_hours_start']
        end = user_prefs['quiet_hours_end']
        
        if start <= current_time <= end:
            return False
    
    return True
```

### **1.4 Scaling Strategies**

#### **A. Partitioning Strategy**
```
Partition by user_id % num_partitions

Benefits:
- All notifications for a user go to same partition
- Easy to apply user preferences
- Can maintain ordering per user

Kafka Topic Structure:
notifications.email.partition-0
notifications.email.partition-1
...
notifications.sms.partition-0
notifications.push.partition-0
```

#### **B. Worker Pool Design**
```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

class NotificationWorker:
    def __init__(self, channel, pool_size=10):
        self.channel = channel
        self.executor = ThreadPoolExecutor(max_workers=pool_size)
        
    async def process_batch(self, notifications):
        """Process notifications in parallel"""
        tasks = [
            asyncio.get_event_loop().run_in_executor(
                self.executor,
                self.send_notification,
                notif
            )
            for notif in notifications
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle results
        for notif, result in zip(notifications, results):
            if isinstance(result, Exception):
                await self.handle_failure(notif, result)
            else:
                await self.update_status(notif, 'sent')
    
    def send_notification(self, notif):
        # Actual sending logic (blocking I/O)
        pass
```

### **1.5 Delivery Guarantees**

#### **A. At-Least-Once Delivery**
```python
# Consumer pattern
def consume_notifications():
    while True:
        message = kafka_consumer.poll(timeout=1.0)
        
        if message is None:
            continue
        
        try:
            # Process notification
            send_notification(message.value)
            
            # Only commit after successful processing
            kafka_consumer.commit()
            
        except Exception as e:
            # Don't commit - message will be redelivered
            log_error(f"Failed to process: {e}")
```

#### **B. Exactly-Once with Idempotency**
```python
import hashlib

class IdempotentNotificationSender:
    def __init__(self, redis_client):
        self.redis = redis_client
        
    def send_with_idempotency(self, notification):
        # Generate idempotency key
        key = self.generate_key(notification)
        
        # Check if already processed (with TTL of 7 days)
        if self.redis.get(key):
            print(f"Notification {key} already sent, skipping")
            return
        
        # Send notification
        send_notification(notification)
        
        # Mark as processed
        self.redis.setex(key, 604800, '1')  # 7 days
    
    def generate_key(self, notification):
        """Create deterministic key from notification"""
        data = f"{notification['user_id']}:{notification['template_id']}:{notification['scheduled_at']}"
        return hashlib.sha256(data.encode()).hexdigest()
```

### **1.6 Interview Deep Dives**

#### **Q1: How do you handle 10M notifications in 1 hour?**
```
Math:
- 10M / 3600s = ~2,778 notifications/second
- If each notification takes 100ms to send = 10 sends/sec/worker
- Need: 2,778 / 10 = ~280 workers

Solution:
1. Partition by channel (email/sms/push)
2. Use Kafka with 20 partitions per channel
3. Deploy 300 workers (100 per channel)
4. Batch processing: Fetch 100 notifications at once
5. Parallel sending within each worker

Optimization:
- Email: Group by recipient domain, send in bulk
- SMS: Use provider's bulk API
- Push: FCM allows 500 messages/request
```

#### **Q2: How to prevent duplicate notifications?**
```
Approach 1: Idempotency Key in Redis
- Key: SHA256(user_id + template_id + timestamp_bucket)
- TTL: 7 days
- Check before sending

Approach 2: Database Constraint
CREATE UNIQUE INDEX idx_unique_notification
ON notification_logs(user_id, template_id, DATE(created_at));

Approach 3: Kafka Exactly-Once Semantics
- Enable idempotent producer
- Use transactional writes
- Set enable.idempotence=true
```

---

## **📚 Part 2: Rate Limiter - Token Bucket & Variants**

### **2.1 Problem Statement**
Build a distributed rate limiter to:
- Prevent API abuse (e.g., 100 requests/minute per user)
- Protect backend services
- Support multiple algorithms (token bucket, leaky bucket, sliding window)

### **2.2 Token Bucket Algorithm**

#### **A. Core Concept**
```
Bucket Capacity: 100 tokens
Refill Rate: 10 tokens/second

┌─────────────────────┐
│   Token Bucket      │
│  ┌───────────────┐  │
│  │ ●●●●●●●●●●    │  │ ← 10 tokens available
│  │               │  │
│  │  Capacity:100 │  │
│  └───────────────┘  │
│   Refill: 10/sec    │
└─────────────────────┘

Request arrives:
1. Check if tokens >= 1
2. If yes: consume 1 token, allow request
3. If no: reject request (429 Too Many Requests)
4. Refill tokens at constant rate
```

#### **B. Implementation (In-Memory)**
```python
import time
from threading import Lock

class TokenBucket:
    def __init__(self, capacity, refill_rate):
        """
        capacity: Maximum tokens
        refill_rate: Tokens added per second
        """
        self.capacity = capacity
        self.tokens = capacity
        self.refill_rate = refill_rate
        self.last_refill = time.time()
        self.lock = Lock()
    
    def allow_request(self, tokens_requested=1):
        with self.lock:
            # Refill tokens based on time elapsed
            now = time.time()
            elapsed = now - self.last_refill
            
            tokens_to_add = elapsed * self.refill_rate
            self.tokens = min(self.capacity, self.tokens + tokens_to_add)
            self.last_refill = now
            
            # Check if enough tokens
            if self.tokens >= tokens_requested:
                self.tokens -= tokens_requested
                return True
            
            return False

# Usage
limiter = TokenBucket(capacity=100, refill_rate=10)

if limiter.allow_request():
    process_request()
else:
    return "429 Too Many Requests"
```

#### **C. Distributed Token Bucket (Redis)**
```python
import redis
import time

class DistributedTokenBucket:
    def __init__(self, redis_client, capacity, refill_rate):
        self.redis = redis_client
        self.capacity = capacity
        self.refill_rate = refill_rate
    
    def allow_request(self, user_id, tokens_requested=1):
        key = f"rate_limit:{user_id}"
        
        # Lua script for atomic operations
        lua_script = """
        local key = KEYS[1]
        local capacity = tonumber(ARGV[1])
        local refill_rate = tonumber(ARGV[2])
        local tokens_requested = tonumber(ARGV[3])
        local now = tonumber(ARGV[4])
        
        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1]) or capacity
        local last_refill = tonumber(bucket[2]) or now
        
        -- Refill tokens
        local elapsed = now - last_refill
        tokens = math.min(capacity, tokens + elapsed * refill_rate)
        
        -- Check if request can be allowed
        if tokens >= tokens_requested then
            tokens = tokens - tokens_requested
            redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
            redis.call('EXPIRE', key, 3600)  -- 1 hour TTL
            return 1
        else
            return 0
        end
        """
        
        result = self.redis.eval(
            lua_script,
            1,  # number of keys
            key,
            self.capacity,
            self.refill_rate,
            tokens_requested,
            time.time()
        )
        
        return result == 1

# Usage
redis_client = redis.Redis(host='localhost', port=6379)
limiter = DistributedTokenBucket(redis_client, capacity=100, refill_rate=10)

if limiter.allow_request(user_id=12345):
    process_request()
else:
    return "429 Too Many Requests"
```

### **2.3 Alternative Algorithms**

#### **A. Leaky Bucket**
```python
import time
from collections import deque

class LeakyBucket:
    def __init__(self, capacity, leak_rate):
        """
        capacity: Queue size
        leak_rate: Requests processed per second
        """
        self.capacity = capacity
        self.leak_rate = leak_rate
        self.queue = deque()
        self.last_leak = time.time()
    
    def allow_request(self):
        # Leak (process) requests
        now = time.time()
        elapsed = now - self.last_leak
        
        leaks = int(elapsed * self.leak_rate)
        for _ in range(min(leaks, len(self.queue))):
            self.queue.popleft()
        
        self.last_leak = now
        
        # Add new request
        if len(self.queue) < self.capacity:
            self.queue.append(now)
            return True
        
        return False
```

**Key Difference:**
- Token Bucket: **Allows bursts** (if bucket is full)
- Leaky Bucket: **Smooth constant rate** (no bursts)

#### **B. Fixed Window Counter**
```python
import time

class FixedWindowCounter:
    def __init__(self, redis_client, max_requests, window_seconds):
        self.redis = redis_client
        self.max_requests = max_requests
        self.window = window_seconds
    
    def allow_request(self, user_id):
        key = f"rate_limit:{user_id}:{int(time.time() / self.window)}"
        
        # Increment counter
        count = self.redis.incr(key)
        
        # Set expiry on first request
        if count == 1:
            self.redis.expire(key, self.window)
        
        return count <= self.max_requests

# Problem: Edge case - 200 requests in 2 seconds
# t=59s: 100 requests (allowed)
# t=0s (new window): 100 requests (allowed)
# Total: 200 requests in 1 second!
```

#### **C. Sliding Window Log**
```python
import time

class SlidingWindowLog:
    def __init__(self, redis_client, max_requests, window_seconds):
        self.redis = redis_client
        self.max_requests = max_requests
        self.window = window_seconds
    
    def allow_request(self, user_id):
        key = f"rate_limit:{user_id}"
        now = time.time()
        window_start = now - self.window
        
        # Remove old entries
        self.redis.zremrangebyscore(key, 0, window_start)
        
        # Count requests in current window
        count = self.redis.zcard(key)
        
        if count < self.max_requests:
            # Add current request
            self.redis.zadd(key, {now: now})
            self.redis.expire(key, self.window)
            return True
        
        return False

# Accurate but memory intensive (stores every request timestamp)
```

#### **D. Sliding Window Counter (Hybrid)**
```python
import time

class SlidingWindowCounter:
    def __init__(self, redis_client, max_requests, window_seconds):
        self.redis = redis_client
        self.max_requests = max_requests
        self.window = window_seconds
    
    def allow_request(self, user_id):
        now = time.time()
        current_window = int(now / self.window)
        previous_window = current_window - 1
        
        current_key = f"rate_limit:{user_id}:{current_window}"
        previous_key = f"rate_limit:{user_id}:{previous_window}"
        
        # Get counts
        current_count = int(self.redis.get(current_key) or 0)
        previous_count = int(self.redis.get(previous_key) or 0)
        
        # Calculate weighted count
        elapsed_in_window = now % self.window
        weight = (self.window - elapsed_in_window) / self.window
        
        estimated_count = previous_count * weight + current_count
        
        if estimated_count < self.max_requests:
            self.redis.incr(current_key)
            self.redis.expire(current_key, self.window * 2)
            return True
        
        return False
```

### **2.4 Multi-Level Rate Limiting**

```python
class HierarchicalRateLimiter:
    def __init__(self, redis_client):
        self.redis = redis_client
        self.limiters = {
            'user': DistributedTokenBucket(redis_client, 100, 10),  # 100/min per user
            'ip': DistributedTokenBucket(redis_client, 1000, 100),  # 1000/min per IP
            'global': DistributedTokenBucket(redis_client, 100000, 10000)  # 100K/min total
        }
    
    def allow_request(self, user_id, ip_address):
        # Check all levels
        checks = [
            self.limiters['user'].allow_request(user_id),
            self.limiters['ip'].allow_request(ip_address),
            self.limiters['global'].allow_request('global')
        ]
        
        return all(checks)  # All levels must pass
```

### **2.5 Interview Deep Dives**

#### **Q: Which algorithm should I use?**
```
Token Bucket:
✅ Best for most APIs
✅ Allows controlled bursts
✅ Simple to implement
Use when: General API protection

Leaky Bucket:
✅ Smooth, constant rate
✅ Prevents bursts completely
Use when: Protecting legacy systems with strict rate limits

Fixed Window:
❌ Edge case issues
✅ Very simple
Use when: Low precision ok

Sliding Window Counter:
✅ Accurate + memory efficient
✅ No edge cases
Use when: High precision needed without log overhead

Sliding Window Log:
✅ Most accurate
❌ Memory intensive
Use when: Audit trail needed
```

#### **Q: How to handle distributed rate limiting across 100 servers?**
```
Problem: Each server has its own counter → 100x the limit!

Solution 1: Centralized Redis
- All servers check same Redis counter
- Pros: Accurate
- Cons: Redis is single point of failure, network latency

Solution 2: Sticky Sessions
- Route user to same server
- Pros: Local counters work
- Cons: Uneven load, session affinity required

Solution 3: Distributed Counter (Cassandra)
- Eventual consistency
- Pros: No single point of failure
- Cons: May allow slight overages

Recommended: Redis with replication + connection pooling
```

---

## **📚 Part 3: Task Scheduler - Distributed Cron**

### **3.1 Problem Statement**
Design a system like **cron** but distributed:
- Schedule tasks (run every hour, daily at 2 AM, etc.)
- Handle millions of tasks
- Fault tolerance (if a node dies, task still runs)
- Exactly-once execution

### **3.2 Core Architecture**

```
┌─────────────────┐
│  Scheduler DB   │ ← Stores task definitions
│  (Postgres)     │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Leader  │ ← Elected via ZooKeeper/etcd
    │ Node    │
    └────┬────┘
         │ Scans for due tasks
         ▼
┌─────────────────┐
│ Message Queue   │ ← RabbitMQ/Kafka
│ (Task Queue)    │
└────────┬────────┘
         │
    ┌────┴─────┬─────────┐
    ▼          ▼         ▼
┌────────┐ ┌────────┐ ┌────────┐
│Worker 1│ │Worker 2│ │Worker 3│ ← Execute tasks
└────────┘ └────────┘ └────────┘
```

### **3.3 Database Schema**

```sql
CREATE TABLE scheduled_tasks (
    task_id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100),  -- '0 2 * * *' = daily at 2 AM
    task_type VARCHAR(50),  -- 'http_request', 'run_script', etc.
    payload JSONB,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE task_executions (
    execution_id UUID PRIMARY KEY,
    task_id BIGINT REFERENCES scheduled_tasks(task_id),
    scheduled_at TIMESTAMP,  -- When it should run
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    status ENUM('pending', 'running', 'completed', 'failed'),
    worker_id VARCHAR(50),
    result JSONB,
    error_message TEXT,
    retry_count INT DEFAULT 0
);

CREATE INDEX idx_executions_scheduled ON task_executions(scheduled_at, status);
CREATE INDEX idx_executions_task ON task_executions(task_id, scheduled_at DESC);
```

### **3.4 Cron Expression Parser**

```python
from croniter import croniter
from datetime import datetime, timedelta

class CronScheduler:
    def __init__(self, cron_expression):
        """
        Cron format: minute hour day month day_of_week
        Examples:
        - '0 2 * * *' = Every day at 2 AM
        - '*/15 * * * *' = Every 15 minutes
        - '0 9 * * 1-5' = Weekdays at 9 AM
        """
        self.cron = croniter(cron_expression, datetime.now())
    
    def get_next_run(self):
        return self.cron.get_next(datetime)
    
    def get_next_n_runs(self, n):
        runs = []
        for _ in range(n):
            runs.append(self.cron.get_next(datetime))
        return runs

# Example
scheduler = CronScheduler('0 */6 * * *')  # Every 6 hours
print(scheduler.get_next_run())  # 2025-01-14 18:00:00
```

### **3.5 Leader Election (ZooKeeper)**

```python
from kazoo.client import KazooClient
from kazoo.recipe.election import Election

class DistributedSchedulerLeader:
    def __init__(self, zk_hosts):
        self.zk = KazooClient(hosts=zk_hosts)
        self.zk.start()
        
        self.election = Election(self.zk, "/scheduler/leader")
    
    def run_as_leader(self):
        """
        This method blocks until this node becomes leader
        """
        self.election.run(self.leader_loop)
    
    def leader_loop(self):
        """
        Only the leader node runs this
        """
        print("I am the leader!")
        
        while True:
            # Scan for tasks due in next minute
            due_tasks = self.get_due_tasks()
            
            for task in due_tasks:
                self.enqueue_task(task)
            
            time.sleep(10)  # Check every 10 seconds
    
    def get_due_tasks(self):
        # Query database for tasks due in next minute
        now = datetime.now()
        next_minute = now + timedelta(minutes=1)
        
        query = """
        SELECT t.task_id, t.name, t.cron_expression, t.payload
        FROM scheduled_tasks t
        LEFT JOIN task_executions e ON t.task_id = e.task_id 
            AND e.scheduled_at = %s
        WHERE t.enabled = true 
        AND e.execution_id IS NULL  -- Not already scheduled
        """
        
        # Calculate next run time for each task
        # Compare with current time
        # Return tasks that should run in [now, now+1min]
```

### **3.6 Task Execution with Exactly-Once Guarantee**

```python
import uuid
from enum import Enum

class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"

class TaskExecutor:
    def __init__(self, db_conn, worker_id):
        self.db = db_conn
        self.worker_id = worker_id
    
    def execute_task(self, task):
        execution_id = str(uuid.uuid4())
        
        # Step 1: Try to claim the task (atomic operation)
        claimed = self.try_claim_task(task, execution_id)
        
        if not claimed:
            print(f"Task {task['task_id']} already claimed by another worker")
            return
        
        try:
            # Step 2: Mark as running
            self.update_status(execution_id, TaskStatus.RUNNING)
            
            # Step 3: Execute the actual task
            result = self.run_task(task)
            
            # Step 4: Mark as completed
            self.update_status(execution_id, TaskStatus.COMPLETED, result=result)
            
        except Exception as e:
            # Handle failure
            self.update_status(execution_id, TaskStatus.FAILED, error=str(e))
            
            # Retry logic
            if task.get('retry_count', 0) < 3:
                self.schedule_retry(task, execution_id)
    
    def try_claim_task(self, task, execution_id):
        """
        Atomic operation to claim a task execution
        """
        query = """
        INSERT INTO task_executions (
            execution_id, task_id, scheduled_at, status, worker_id
        )
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (task_id, scheduled_at) DO NOTHING
        RETURNING execution_id
        """
        
        result = self.db.execute(
            query,
            (execution_id, task['task_id'], task['scheduled_at'], 
             TaskStatus.PENDING.value, self.worker_id)
        )
        
        # If insert succeeded, we claimed it
        return result.rowcount > 0
    
    def run_task(self, task):
        """Execute the actual task based on type"""
        task_type = task['task_type']
        
        if task_type == 'http_request':
            return self.execute_http_task(task)
        elif task_type == 'run_script':
            return self.execute_script_task(task)
        # ... more task types
```

### **3.7 Handling Missed Tasks (Backfill)**

```python
class MissedTaskHandler:
    def __init__(self, db_conn):
        self.db = db_conn
    
    def find_missed_tasks(self):
        """
        Find tasks that should have run but didn't
        (e.g., due to system downtime)
        """
        query = """
        WITH expected_runs AS (
            -- Generate expected run times for last 24 hours
            SELECT 
                t.task_id,
                generate_series(
                    NOW() - INTERVAL '24 hours',
                    NOW(),
                    INTERVAL '1 hour'  -- Adjust based on task frequency
                ) AS expected_at
            FROM scheduled_tasks t
            WHERE t.enabled = true
        )
        SELECT er.task_id, er.expected_at
        FROM expected_runs er
        LEFT JOIN task_executions te 
            ON er.task_id = te.task_id 
            AND er.expected_at = te.scheduled_at
        WHERE te.execution_id IS NULL  -- No execution record
        ORDER BY er.expected_at
        """
        
        return self.db.execute(query).fetchall()
    
    def backfill_tasks(self, max_backfill=100):
        """
        Run missed tasks (with limits to prevent overwhelming the system)
        """
        missed = self.find_missed_tasks()
        
        for task_id, expected_at in missed[:max_backfill]:
            # Re-enqueue to task queue
            self.enqueue_task({
                'task_id': task_id,
                'scheduled_at': expected_at,
                'is_backfill': True
            })

### **3.8 Scaling & Reliability Trade-offs**

| Feature | Distributed Cron (DB-Scanning) | Distributed Task Queue (Delayed Messages) |
| :--- | :--- | :--- |
| **Scalability** | Limited by DB scan (100k tasks) | Extremely high (Millions of tasks) |
| **Precision** | ± 10-30 seconds | High (milliseconds) |
| **Complex Logic** | Supports complex cron (monthly, etc.) | Harder to implement custom cron |
| **Recovery** | Easy (scan DB for missed tasks) | Hard (requires DLQ processing) |

---

## **📚 Part 4: Webhook System - Event Delivery**

### **4.1 Problem Statement**
Design a system to deliver event notifications to third-party servers (e.g., Stripe, GitHub) with:
- Guaranteed delivery (at-least-once)
- Exponential backoff retry logic
- Security (Signature verification)
- Isolation (One slow customer shouldn't block others)

### **4.2 Core Architecture**
```
┌─────────────┐
│ Event       │
│ Producer    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Webhook     │ ← Validates user subscription & filters
│ Dispatcher  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Msg Queue   │ ← Partitioned by subscriber_id or priority
│ (Kafka)     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Delivery    │ ← Executes HTTP POST, handles retries
│ Workers     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Destination │ ← Third-party URL (https://customer.com/webhook)
│ (User Webhook)│
└─────────────┘
```

### **4.3 Key Implementation Details**

#### **A. Signature Generation (Security)**
```python
import hmac
import hashlib

def generate_signature(secret: str, payload: str) -> str:
    """Generate HMAC-SHA256 signature for the payload"""
    return hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

# Header: X-Webhook-Signature: t=1609459200,v1=sha256_hash...
```

#### **B. Delivery Worker with Retry & Backoff**
```python
import requests
import time

class WebhookWorker:
    def __init__(self, max_retries=5):
        self.max_retries = max_retries
        self.base_delay = 5  # 5 seconds
        
    def deliver_event(self, subscription, event):
        payload = event['data']
        url = subscription['target_url']
        secret = subscription['secret']
        
        signature = generate_signature(secret, payload)
        
        for attempt in range(self.max_retries + 1):
            try:
                response = requests.post(
                    url,
                    data=payload,
                    headers={
                        'X-Webhook-Signature': signature,
                        'Content-Type': 'application/json'
                    },
                    timeout=10
                )
                
                if response.status_code == 200:
                    return True # Success
                
                # Non-200 status - maybe retryable
                if response.status_code in [429, 500, 502, 503, 504]:
                    self.wait_before_retry(attempt)
                else:
                    return False # 400, 403, etc. - don't retry
                    
            except requests.exceptions.RequestException:
                self.wait_before_retry(attempt)
        
        return False
    
    def wait_before_retry(self, attempt):
        delay = self.base_delay * (2 ** attempt)
        time.sleep(delay)
```

### **4.4 Scaling Strategies: Customer Isolation**
**The "Bad Neighbor" Problem**: One customer's server is down or very slow, clogging the delivery workers.
**Solution**:
1. **Tiered Queues**: High, Medium, and Low volume customers in different queues.
2. **Per-Customer Resource Limits**: Cap the number of concurrent connections per subscriber.
3. **Dedicated Workers**: For VIP customers.

---

## **📚 Part 5: Email Service - High Volume Delivery**

### **5.1 Problem Statement**
Design a service to send transactional and bulk emails:
- High deliverability (Avoid spam folders)
- Handle rate limits of SMTP providers
- Manage bounces and complaints
- Support templates and tracking (Open/Click)

### **5.2 Architecture Components**
1. **Email Gateway**: API to receive requests.
2. **Template Engine**: Merges data with HTML templates.
3. **Reputation Manager**: Tracks IP health, manages SPF/DKIM/DMARC headers.
4. **Provider Adapter**: Routes mail to SendGrid, Mailgun, or internal SMTP servers.

### **5.3 Deliverability Checklist (Interview Gold)**
- **SPF (Sender Policy Framework)**: List of authorized IPs.
- **DKIM (DomainKeys Identified Mail)**: Cryptographic signature to verify domain.
- **DMARC**: Policy for what to do if SPF/DKIM fail.
- **Warm-up**: Gradually increasing volume on new IPs to build trust.

### **5.4 Handling Bounces (Idempotency)**
```python
class EmailTrackingHandler:
    def handle_bounce(self, bounce_payload):
        user_email = bounce_payload['email']
        bounce_type = bounce_payload['type']  # Hard or Soft
        
        if bounce_type == 'HARD':
            # Permanently suppress this email to protect reputation
            self.db.add_to_suppression_list(user_email)
            self.db.mark_user_email_invalid(user_email)
```

---

# **MODULE 6.3: Data Processing Systems - Mastery Guide**

## **🎯 Overview**
This module covers systems that handle **massive data ingestion and transformation**. Unlike Module 6.2 (Communication), the focus here is on **throughput, data integrity, and latency of calculation**.

---

## **📚 Part 1: Web Crawler - Distributed Ingestion**

### **1.1 Problem Statement**
Build a crawler to index the entire web (Google/Bing style):
- Scalability: Billions of pages.
- Politeness: Respect `robots.txt` and don't overwhelm sites.
- Deduplication: Avoid crawling same content via different URLs.
- Extensibility: Support HTML, PDF, Images.

### **1.2 High-Level Architecture**
```
┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│  Seed URLs   ├─────>│ URL Frontier│<─────┤ DNS Resolver │
└──────────────┘      └──────┬──────┘      └──────────────┘
                             │
                             ▼
                      ┌─────────────┐
                      │ Fetcher     │ ← Distributed Pool
                      └──────┬──────┘
                             │
                             ▼
┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│ Content Store│<─────┤ HTML Parser │─────>│ Link Extactor│
└──────────────┘      └──────┬──────┘      └──────┬───────┘
                             │                    │
                             ▼                    ▼
                      ┌─────────────┐      ┌──────────────┐
                      │ Dup Check   │      │ URL Filter   │
                      │ (Bloom)     │      │ (Robots.txt) │
                      └─────────────┘      └──────────────┘
```

### **1.3 Key Components**

#### **A. URL Frontier - Respecting Politeness**
The frontier ensures we don't hit the same server too fast.
```
Structure:
- Input Queue: Prioritizes URLs (PageRank).
- Output Queue (Mapping): One queue per HOST/IP.
- Delay Manager: Ensures min interval between requests to same host.
```

#### **B. Bloom Filter for Deduplication**
```python
from pybloom_live import BloomFilter

class CrawlerDedup:
    def __init__(self, capacity=1_000_000_000):
        # Probabilistic check for URL seen before
        # Memory efficient: billions of bits vs GBs of strings
        self.bloom = BloomFilter(capacity=capacity, error_rate=0.001)
        
    def should_crawl(self, url):
        if url in self.bloom:
            # Might be duplicate, check DB for confirmation (or skip)
            return False
        self.bloom.add(url)
        return True
```

---

## **📚 Part 2: Metrics Monitoring System - Time-Series Mastery**

### **2.1 Problem Statement**
Design a system like **Prometheus** or **DataDog**:
- High write throughput (Millions of metrics/sec).
- Low latency queries (Dashboard loading).
- Data aggregation (Average, P99, Sum).

### **2.2 Data Model: Time-Series**
Metric: `service.latency{host="worker-1", method="GET"} 25ms 1609459200`
- **Metric Name**: `service.latency`
- **Labels (Tags)**: `host`, `method`
- **Value**: `25`
- **Timestamp**: `1609459200`

### **2.3 Push vs Pull Model**
| Model | Push (Graphite, CloudWatch) | Pull (Prometheus) |
| :--- | :--- | :--- |
| **Control** | Clients decide when to push. | Server decides when to scrape. |
| **Simplicity** | Easy behind firewalls. | No service discovery needed. |
| **Scaling** | Harder to control ingestion. | Easy to detect down targets. |

### **2.4 Storage: TSDB (Time Series Database)**
Use **In-Memory Buffer** for current data + **Columnar Storage (LSM Tree)** for historical data.
- **Compaction**: Aggregate 1-second data into 1-minute blocks after 24 hours to save space.

---

## **📚 Part 3: Analytics System - Real-Time Aggregation**

### **3.1 Problem Statement**
Calculate metrics like "Top 10 Most Viewed Products in the last 15 minutes" in real-time.

### **3.2 Windowing Concepts**
1. **Fixed Window**: 0-5 mins, 5-10 mins.
2. **Sliding Window**: Last 5 minutes updated every 10 seconds.
3. **Session Window**: Activities until a gap of 30 mins occurs.

### **3.3 Top-K Algorithm (Count-Min Sketch)**
Instead of storing every user request, use a probabilistic data structure to keep approximate counts.
```python
# Count-Min Sketch for Top-K
class TrendingCounter:
    def add_event(self, item_id):
        # Hash item_id multiple times
        # Increment counters at hashed indices
        # Simplified example logic
        pass
        
    def get_estimate(self, item_id):
        # Return min of hashed indices
        pass
```

---

## **📚 Part 4: Search Autocomplete - Trie Implementation**

### **4.1 Problem Statement**
Provide search suggestions as users type (Typeahead).
- Low latency (< 20ms).
- Relevant suggestions (Ranked by popularity).

### **4.2 Core Structure: Trie (Prefix Tree)**
```python
class TrieNode:
    def __init__(self):
        self.children = {}
        self.is_end = False
        self.frequency = 0  # To track popularity
        self.top_suggestions = [] # Optimization: precompute at each node

class AutocompleteSystem:
    def __init__(self):
        self.root = TrieNode()
        
    def insert(self, word, freq):
        node = self.root
        for char in word:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
            # Update precomputed top 10 suggestions for this prefix
            self.update_top_list(node, word, freq)
        node.is_end = True
        node.frequency += freq
```

### **4.3 Scaling Strategy**
1. **Shard by Prefix**: 
   - Server A: a-m
   - Server B: n-z
2. **Aggressive Caching**: Browser-side cache for common prefixes.
3. **Offline Pipeline**: Aggregating logs to update frequencies in the Trie periodically.

---

# **MODULE 6.4: Storage Systems - Deep Mastery**

## **🎯 Overview**
This module explores the internal workings of **distributed storage engines**. You will learn how systems like Redis, Cassandra, and Zookeeper manage data across multiple nodes with high availability and consistency.

---

## **📚 Part 1: Key-Value Store - Distributed Hash Table**

### **1.1 Core Concept: Consistent Hashing**
To scale a KV store, we distribute keys across multiple nodes.
**Problem**: Traditional hashing `key % N` fails when N changes (re-shuffles all data).
**Solution**: Consistent Hashing minimizes reshuffling to `K/N` keys.

```python
import hashlib

class ConsistentHash:
    def __init__(self, nodes=None, replicas=3):
        self.replicas = replicas
        self.ring = {}
        self.sorted_keys = []
        if nodes:
            for node in nodes:
                self.add_node(node)

    def add_node(self, node):
        for i in range(self.replicas):
            key = self._hash(f"{node}:{i}")
            self.ring[key] = node
            self.sorted_keys.append(key)
        self.sorted_keys.sort()

    def get_node(self, key):
        if not self.ring: return None
        h = self._hash(key)
        for node_key in self.sorted_keys:
            if h <= node_key:
                return self.ring[node_key]
        return self.ring[self.sorted_keys[0]]

    def _hash(self, key):
        return int(hashlib.md5(key.encode()).hexdigest(), 16)
```

### **1.2 Data Replication & Quorum**
To ensure reliability, use **Quorum Reads/Writes**:
- `N`: Number of replicas.
- `W`: Write quorum (nodes that must acknowledge write).
- `R`: Read quorum (nodes that must be queried).
- **Rule**: `R + W > N` ensures strong consistency (at least one node has the latest data).

---

## **📚 Part 2: Distributed Cache (Redis-Like)**

### **2.1 Internal Mechanisms**
- **Data Structures**: String, List, Hash, Set, Sorted Set (SkipList).
- **Eviction**: LRU (Least Recently Used), LFU (Least Frequently Used).
- **Persistence**: 
  - **RDB**: Snapshot at intervals.
  - **AOF**: Append-only log of every write.

### **2.2 High Availability: Sentinel & Cluster**
- **Sentinel**: Automatic failover (promotes slave to master).
- **Cluster**: Sharding across multiple masters (16,384 slots).

---

## **📚 Part 3: Unique ID Generator - Snowflake Revisited**

### **3.1 Global Uniqueness without Coordination**
While we covered basic ID generation, the **Snowflake Algorithm** is the industry standard:
- **41 bits**: Timestamp (ms accuracy).
- **10 bits**: Worker/Machine ID (1024 distinct workers).
- **12 bits**: Sequence number (Protects against 4096 IDs in the same ms).

### **3.2 Anti-Entropy: Gossip Protocol**
How do nodes agree on who is alive?
- Each node periodically sends its "view" of the cluster to a random neighbor.
- Information spreads like a virus.
- **Benefit**: No central "brain," highly resilient to network partitions.

---

## **📚 Part 4: Configuration Service - Distributed Coordination**

### **4.1 Use Case: Feature Flags & Dynamic Config**
Managing settings across 10,000 servers without restarting them.
- **Tools**: Zookeeper, etcd, Consul.

### **4.2 Consensus Algorithm: Raft Basics**
1. **Leader Election**: One node is elected leader; others are followers.
2. **Log Replication**: Leader receives commands, appends to log, and replicates to followers.
3. **Commit**: Command is executed once a majority of followers acknowledge.

---

# **MODULE 6.5: User-Facing Services - System Design Patterns**

## **🎯 Overview**
This module applies all previous concepts to build **real-world user features**. We focus on **fan-out patterns, nested data, and real-time aggregation**.

---

## **📚 Part 1: News Feed (Basic Version)**

### **1.1 Push vs Pull (Fan-out)**
- **Pull (Fan-out on Read)**: Fetch items when user opens feed. Good for celebrities (avoiding million-write spikes).
- **Push (Fan-out on Write)**: Post items to follower feeds immediately. Good for fast reads for normal users.
- **Hybrid**: Push for regular users, Pull for celebrities.

---

## **📚 Part 2: Comment System - Nested Data**

### **2.1 Challenges**
- Infinite nesting (infinite depth).
- Fast retrieval of top-level comments.
- Pagination within nested replies.

### **2.2 Approaches**
1. **Adjacency List**: `parent_id` reference. (Hard to fetch whole tree).
2. **Path Enumeration**: Store `path = "1/5/12"`. (Fast path queries).
3. **Closure Table**: Map every ancestor-descendant pair. (Most flexible but high storage).

---

## **📚 Part 3: Like / Voting System**

### **3.1 Scaling Writing (Hotspots)**
- **Problem**: 1 million people liking a post at the same time.
- **Solution**: 
  - **In-Memory Buffer**: Aggregate likes in Redis (`INCR`) and flush to DB every 10 seconds.
  - **Sharded Counters**: Split the counter into `N` rows and sum them up.

---

## **📚 Part 4: Leaderboard - Real-time Rankings**

### **4.1 Redis Sorted Sets (ZSET)**
The perfect data structure for leaderboards:
- `ZADD leaderboard 100 "user_1"` (Set score 100 for user_1).
- `ZREVRANGE leaderboard 0 9 WITHSCORES` (Get top 10).
- **Complexity**: O(log N) for insertions/updates.

---

## **📚 Part 5: File Sharing & Image Services**

### **5.1 Architecture**
1. **Upload**: Client → S3 (Blob Storage).
2. **Processing**: S3 Event → Lambda → ImageMagick (Thumbnail generation).
3. **Delivery**: CDN (CloudFront) caching for global speed.

### **5.2 Integrity & Deduplication**
- Use **Content-Addressable Storage (CAS)**: Hash the file content; if hash exists, don't store again.

---

🎉 **Congratulations! You have mastered the Core Practice Problems of HLD.**
Next, we move to **Part 7: Hard & Complex Production Systems**.