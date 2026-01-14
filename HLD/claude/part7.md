# Part 7: Practice Problems - Hard & Complex
## Complete Mastery Guide (Week 10-12, 45 hours)

---

## 📋 Overview

This part focuses on **real-world, production-grade system design problems** that appear in FAANG+ interviews. Each problem requires deep understanding of multiple building blocks working together.

**Learning Approach:**
- Each problem takes 2-3 days of deep study
- Focus on trade-offs, not just solutions
- Practice drawing diagrams and explaining verbally
- Understand WHY, not just WHAT

---

# Module 7.1: Social Media Platforms (6 Problems)

## Building Blocks Mastery

### 1. **Feed Generation Architectures**

#### **Fan-out Approaches**

**Fan-out on Write (Push Model)**
```
Concept: Pre-compute feeds when content is created

When user posts:
├─ Find all followers
├─ Write post to each follower's feed cache
└─ Followers get instant reads

Pros:
✓ Fast reads (pre-computed)
✓ Simple read logic

Cons:
✗ Slow writes for celebrities (millions of followers)
✗ Wasted computation if followers don't check feed
✗ Storage overhead (duplicate data)

Use case: Small to medium follower counts
```

**Fan-out on Read (Pull Model)**
```
Concept: Compute feed when user requests it

When user opens app:
├─ Find all people they follow
├─ Fetch recent posts from each
├─ Merge and rank
└─ Return feed

Pros:
✓ No wasted computation
✓ Handles celebrities well
✓ Less storage

Cons:
✗ Slow reads (compute on demand)
✗ Complex read logic
✗ High read latency

Use case: Users with many followings
```

**Hybrid Approach (Production Standard)**
```
Strategy: Combine both based on user type

Celebrity users (>1M followers):
└─ Fan-out on Read (pull model)

Regular users (<1M followers):
└─ Fan-out on Write (push model)

Implementation:
┌─────────────────────────────────────┐
│ Post Service receives new post      │
└──────────────┬──────────────────────┘
               │
               ├─ Check poster's follower count
               │
               ├─ If < 1M followers:
               │  ├─ Get follower list
               │  ├─ For each follower:
               │  │  └─ Redis LPUSH user:{id}:feed post_id
               │  └─ Async workers process in parallel
               │
               └─ If >= 1M followers:
                  └─ Store in celebrity posts cache
                     User fetches during read

On Feed Request:
├─ Get cached feed (fan-out write posts)
├─ Get celebrity posts (fan-out read)
├─ Merge with ranking algorithm
└─ Return top N posts
```

**Code Example: Hybrid Fan-out**
```python
class FeedGenerator:
    def __init__(self):
        self.redis = RedisClient()
        self.db = DatabaseClient()
        self.CELEBRITY_THRESHOLD = 1_000_000
        
    async def create_post(self, user_id, post_data):
        # Create post
        post_id = await self.db.create_post(user_id, post_data)
        
        # Get follower count
        follower_count = await self.db.get_follower_count(user_id)
        
        if follower_count < self.CELEBRITY_THRESHOLD:
            # Fan-out on write
            await self.fanout_on_write(user_id, post_id)
        else:
            # Mark as celebrity post
            await self.redis.zadd(
                f"celebrity_posts:{user_id}",
                {post_id: time.time()}
            )
        
        return post_id
    
    async def fanout_on_write(self, user_id, post_id):
        # Get followers in batches
        followers = await self.db.get_followers(user_id)
        
        # Batch insert to Redis (parallel)
        tasks = []
        for batch in chunk_list(followers, 1000):
            task = self.batch_insert_feed(batch, post_id)
            tasks.append(task)
        
        await asyncio.gather(*tasks)
    
    async def batch_insert_feed(self, user_ids, post_id):
        pipeline = self.redis.pipeline()
        for user_id in user_ids:
            # Add to user's feed cache (keep last 1000)
            pipeline.lpush(f"feed:{user_id}", post_id)
            pipeline.ltrim(f"feed:{user_id}", 0, 999)
        await pipeline.execute()
    
    async def get_feed(self, user_id, page_size=20):
        # Get regular posts (fan-out write)
        regular_posts = await self.redis.lrange(
            f"feed:{user_id}", 0, page_size * 2
        )
        
        # Get celebrity posts (fan-out read)
        following = await self.db.get_following_celebrities(user_id)
        celebrity_posts = []
        for celeb_id in following:
            posts = await self.redis.zrevrange(
                f"celebrity_posts:{celeb_id}", 0, 50
            )
            celebrity_posts.extend(posts)
        
        # Merge and rank
        all_posts = await self.fetch_post_details(
            regular_posts + celebrity_posts
        )
        
        # Rank by ML model
        ranked_posts = await self.rank_posts(user_id, all_posts)
        
        return ranked_posts[:page_size]
```

### 2. **Feed Ranking Algorithms**

#### **Engagement-Based Ranking**
```
Score = W1×Likes + W2×Comments + W3×Shares + W4×Saves - W5×Age

Components:
├─ Recency decay: score × exp(-λ × age_hours)
├─ User affinity: Higher weight for close friends
├─ Content type: Video > Image > Text (configurable)
└─ Engagement rate: (interactions / impressions)

Example weights:
W1 = 1.0  (Likes)
W2 = 3.0  (Comments - stronger signal)
W3 = 5.0  (Shares - strongest signal)
W4 = 2.0  (Saves)
W5 = 0.1  (Age penalty)
```

**Implementation:**
```python
class FeedRanker:
    def __init__(self):
        self.model = load_ml_model()  # Trained model
        
    def calculate_engagement_score(self, post):
        age_hours = (time.time() - post.created_at) / 3600
        recency_decay = math.exp(-0.1 * age_hours)
        
        engagement_score = (
            1.0 * post.likes +
            3.0 * post.comments +
            5.0 * post.shares +
            2.0 * post.saves
        )
        
        return engagement_score * recency_decay
    
    def calculate_affinity_score(self, user_id, post):
        # How close is the user to the poster?
        # Based on: mutual friends, past interactions, etc.
        
        interaction_count = get_interaction_count(
            user_id, post.author_id
        )
        mutual_friends = get_mutual_friends_count(
            user_id, post.author_id
        )
        
        return (interaction_count * 2 + mutual_friends) / 100
    
    async def rank_posts(self, user_id, posts):
        scored_posts = []
        
        for post in posts:
            # Get base scores
            engagement = self.calculate_engagement_score(post)
            affinity = self.calculate_affinity_score(user_id, post)
            
            # ML model prediction (CTR, dwell time, etc.)
            features = self.extract_features(user_id, post)
            ml_score = self.model.predict(features)
            
            # Combined score
            final_score = (
                0.3 * engagement +
                0.3 * affinity +
                0.4 * ml_score
            )
            
            scored_posts.append((post, final_score))
        
        # Sort by score
        scored_posts.sort(key=lambda x: x[1], reverse=True)
        
        return [post for post, score in scored_posts]
    
    def extract_features(self, user_id, post):
        return {
            'user_age': get_user_age(user_id),
            'post_type': post.type,  # video/image/text
            'post_length': len(post.content),
            'author_follower_count': post.author.followers,
            'user_past_engagement': get_engagement_history(
                user_id, post.type
            ),
            'time_of_day': datetime.now().hour,
            'day_of_week': datetime.now().weekday(),
        }
```

### 3. **Real-Time Updates (WebSocket/Long Polling)**

**WebSocket Architecture:**
```
┌─────────────┐         ┌──────────────────┐
│   Client    │◄───WS───┤  WS Server Pool  │
│  (Browser)  │         │  (Sticky Session)│
└─────────────┘         └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │  Redis Pub/Sub   │
                        │  (Message Broker)│
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │  Post Service    │
                        │  (Publishes)     │
                        └──────────────────┘

Connection Management:
├─ Each WS server holds ~50k connections
├─ User ID → Server mapping in Redis
├─ Heartbeat every 30 seconds
└─ Auto-reconnect with exponential backoff
```

**Implementation:**
```python
# WebSocket Server
class FeedWebSocketServer:
    def __init__(self):
        self.connections = {}  # user_id -> websocket
        self.redis_pubsub = RedisPubSub()
        
    async def handle_connection(self, websocket, user_id):
        # Register connection
        self.connections[user_id] = websocket
        await self.register_user_server(user_id)
        
        # Subscribe to user's feed updates
        await self.redis_pubsub.subscribe(f"feed:{user_id}")
        
        try:
            # Send initial feed
            feed = await get_feed(user_id)
            await websocket.send(json.dumps({
                'type': 'initial_feed',
                'posts': feed
            }))
            
            # Listen for updates
            async for message in self.redis_pubsub.listen():
                if message['type'] == 'message':
                    await websocket.send(message['data'])
                    
        except websockets.ConnectionClosed:
            del self.connections[user_id]
            await self.unregister_user_server(user_id)
    
    async def register_user_server(self, user_id):
        # Store which server this user is connected to
        server_id = get_server_id()
        await redis.setex(
            f"ws:user:{user_id}:server",
            300,  # 5 min TTL (renewed by heartbeat)
            server_id
        )
    
    async def broadcast_new_post(self, post):
        # Called when new post is created
        followers = await get_followers(post.author_id)
        
        for follower_id in followers:
            # Publish to Redis
            await self.redis_pubsub.publish(
                f"feed:{follower_id}",
                json.dumps({
                    'type': 'new_post',
                    'post': post.to_dict()
                })
            )
```

### 4. **Graph Database for Social Connections**

**Schema Design:**
```
Nodes:
├─ User
│  ├─ id (indexed)
│  ├─ username
│  ├─ created_at
│  └─ metadata
│
└─ Post
   ├─ id (indexed)
   ├─ content
   ├─ created_at
   └─ type

Relationships:
├─ FOLLOWS (User → User)
│  ├─ created_at
│  └─ notification_enabled
│
├─ POSTED (User → Post)
│  └─ created_at
│
├─ LIKED (User → Post)
│  └─ created_at
│
└─ COMMENTED (User → Post)
   ├─ comment_text
   └─ created_at
```

**Query Examples:**
```cypher
// Get followers (1-hop)
MATCH (follower:User)-[:FOLLOWS]->(user:User {id: $userId})
RETURN follower
LIMIT 1000

// Get friends (mutual following)
MATCH (user:User {id: $userId})-[:FOLLOWS]->(friend:User)
      -[:FOLLOWS]->(user)
RETURN friend

// Friend of friends (2-hop)
MATCH (user:User {id: $userId})-[:FOLLOWS]->()-[:FOLLOWS]->(fof:User)
WHERE NOT (user)-[:FOLLOWS]->(fof) AND user <> fof
RETURN DISTINCT fof, count(*) as mutual_friends
ORDER BY mutual_friends DESC
LIMIT 50

// Trending posts in network
MATCH (user:User {id: $userId})-[:FOLLOWS*1..2]->(poster:User)
      -[:POSTED]->(post:Post)
WHERE post.created_at > $last24Hours
WITH post, count(*) as network_reach
MATCH (liker:User)-[:LIKED]->(post)
RETURN post, network_reach, count(liker) as likes
ORDER BY likes DESC, network_reach DESC
LIMIT 20
```

**Hybrid SQL + Graph Approach:**
```python
class SocialGraph:
    def __init__(self):
        self.sql_db = PostgreSQL()  # User data, posts
        self.neo4j = Neo4jClient()  # Relationships
        self.redis = RedisClient()  # Cache
        
    async def get_followers(self, user_id, limit=1000):
        # Try cache first
        cache_key = f"followers:{user_id}"
        cached = await self.redis.get(cache_key)
        if cached:
            return json.loads(cached)
        
        # Query graph database
        query = """
        MATCH (follower:User)-[:FOLLOWS]->(user:User {id: $userId})
        RETURN follower.id
        LIMIT $limit
        """
        result = await self.neo4j.run(query, 
            userId=user_id, limit=limit
        )
        
        follower_ids = [record['follower.id'] for record in result]
        
        # Cache for 5 minutes
        await self.redis.setex(cache_key, 300, 
            json.dumps(follower_ids)
        )
        
        return follower_ids
    
    async def get_feed_candidates(self, user_id):
        # Get people user follows
        following = await self.get_following(user_id)
        
        # Get their recent posts from SQL
        posts = await self.sql_db.query("""
            SELECT * FROM posts
            WHERE author_id = ANY($1)
            AND created_at > NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC
            LIMIT 500
        """, following)
        
        return posts
```

### 5. **Content Moderation Pipeline**

**Multi-Stage Moderation:**
```
Stage 1: Pre-Upload Validation
├─ File type check
├─ Size limits
├─ Duplicate detection (perceptual hash)
└─ Known bad content hash

Stage 2: Automated ML Screening
├─ Text: Toxicity, hate speech, spam
├─ Image: NSFW, violence, copyrighted
├─ Video: Sampled frame analysis
└─ Confidence score → Queue for review

Stage 3: Human Review (Low Confidence)
├─ Distributed to moderators
├─ Multiple reviews for consensus
├─ Training data for ML improvement
└─ Appeals process

Stage 4: User Reports
├─ Community flagging
├─ Priority queue based on severity
├─ Pattern detection (repeat offenders)
└─ Automated actions (soft delete, shadow ban)
```

**Implementation:**
```python
class ContentModerator:
    def __init__(self):
        self.ml_model = load_moderation_model()
        self.hash_db = BadContentHashDB()
        
    async def moderate_content(self, content):
        # Stage 1: Quick checks
        if await self.is_known_bad(content):
            return {'approved': False, 'reason': 'known_bad'}
        
        # Stage 2: ML screening
        ml_result = await self.ml_screen(content)
        
        if ml_result['confidence'] > 0.95:
            if ml_result['is_safe']:
                return {'approved': True}
            else:
                return {
                    'approved': False,
                    'reason': ml_result['violation_type']
                }
        
        # Stage 3: Queue for human review
        await self.queue_for_review(content, ml_result)
        return {'approved': 'pending', 'review_id': review_id}
    
    async def ml_screen(self, content):
        features = self.extract_features(content)
        
        results = {
            'toxicity': self.ml_model.predict_toxicity(features),
            'nsfw': self.ml_model.predict_nsfw(content.image),
            'spam': self.ml_model.predict_spam(features),
        }
        
        max_violation = max(results.values())
        
        return {
            'confidence': max_violation['confidence'],
            'is_safe': max_violation['score'] < 0.5,
            'violation_type': max_violation['type']
        }
```

---

## Problem 1: Design Twitter/X

### Requirements
**Functional:**
- Post tweets (280 chars, media)
- Follow/unfollow users
- Home timeline (tweets from following)
- User timeline (specific user's tweets)
- Search tweets
- Trending topics
- Likes, retweets, replies

**Non-Functional:**
- 500M DAU, 200M tweets/day
- Home timeline < 200ms
- Tweet posting < 1s
- High availability
- Eventually consistent

### High-Level Design
```
┌─────────────────────────────────────────────────────────┐
│                     Load Balancer                        │
└────┬──────────────┬──────────────┬──────────────────────┘
     │              │              │
┌────▼─────┐  ┌────▼──────┐  ┌───▼──────────┐
│  Write   │  │   Read    │  │   Search     │
│  Service │  │  Service  │  │   Service    │
└────┬─────┘  └────┬──────┘  └───┬──────────┘
     │              │              │
┌────▼──────────────▼──────────────▼──────────┐
│              Message Queue                   │
│         (Kafka - Fan-out workers)           │
└────┬─────────────────────────────────────────┘
     │
┌────▼─────┐  ┌──────────┐  ┌───────────┐
│ PostgreSQL│  │  Redis   │  │Elasticsearch│
│ (Tweets)  │  │(Timeline)│  │  (Search)   │
└───────────┘  └──────────┘  └─────────────┘
```

### Deep Dive Components

**1. Tweet Service (Write Path)**
```python
class TweetService:
    async def create_tweet(self, user_id, content, media=None):
        # Validate
        if len(content) > 280:
            raise ValidationError("Tweet too long")
        
        # Generate ID (Snowflake)
        tweet_id = self.id_generator.generate()
        
        # Store tweet
        tweet = await self.db.execute("""
            INSERT INTO tweets 
            (id, user_id, content, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING *
        """, tweet_id, user_id, content)
        
        # Upload media if exists
        if media:
            media_urls = await self.upload_media(media)
            await self.db.execute("""
                UPDATE tweets SET media_urls = $1 
                WHERE id = $2
            """, media_urls, tweet_id)
        
        # Async fan-out
        await self.kafka.publish('tweet.created', {
            'tweet_id': tweet_id,
            'user_id': user_id,
            'tweet': tweet
        })
        
        # Index for search
        await self.elasticsearch.index(
            index='tweets',
            id=tweet_id,
            body=tweet
        )
        
        return tweet
```

**2. Timeline Service (Read Path)**
```python
class TimelineService:
    async def get_home_timeline(self, user_id, page_size=20):
        # Check cache
        cache_key = f"timeline:{user_id}"
        cached = await self.redis.lrange(cache_key, 0, page_size-1)
        
        if cached and len(cached) >= page_size:
            tweets = await self.hydrate_tweets(cached)
            return tweets
        
        # Cache miss - regenerate
        timeline = await self.generate_timeline(user_id)
        
        # Cache timeline (keep 1000 tweets)
        pipeline = self.redis.pipeline()
        pipeline.delete(cache_key)
        for tweet_id in timeline[:1000]:
            pipeline.rpush(cache_key, tweet_id)
        pipeline.expire(cache_key, 3600)  # 1 hour
        await pipeline.execute()
        
        tweets = await self.hydrate_tweets(timeline[:page_size])
        return tweets
    
    async def generate_timeline(self, user_id):
        # Get following list
        following = await self.graph_db.get_following(user_id)
        
        # Get recent tweets from following
        tweets = await self.db.query("""
            SELECT id FROM tweets
            WHERE user_id = ANY($1)
            AND created_at > NOW() - INTERVAL '7 days'
            ORDER BY created_at DESC
            LIMIT 500
        """, following)
        
        # Rank tweets
        ranked = await self.rank_timeline(user_id, tweets)
        
        return [t.id for t in ranked]
```

**3. Fan-out Worker**
```python
class FanoutWorker:
    async def process_new_tweet(self, event):
        tweet_id = event['tweet_id']
        user_id = event['user_id']
        
        # Get follower count
        follower_count = await self.db.get_follower_count(user_id)
        
        if follower_count < 1_000_000:
            # Fan-out on write
            await self.fanout_to_followers(user_id, tweet_id)
        else:
            # Celebrity - fan-out on read
            await self.cache_celebrity_tweet(user_id, tweet_id)
    
    async def fanout_to_followers(self, user_id, tweet_id):
        # Get followers in batches
        batch_size = 1000
        offset = 0
        
        while True:
            followers = await self.graph_db.get_followers(
                user_id, limit=batch_size, offset=offset
            )
            
            if not followers:
                break
            
            # Batch insert to timelines
            pipeline = self.redis.pipeline()
            for follower_id in followers:
                timeline_key = f"timeline:{follower_id}"
                pipeline.lpush(timeline_key, tweet_id)
                pipeline.ltrim(timeline_key, 0, 999)
            await pipeline.execute()
            
            offset += batch_size
```

**4. Search Service**
```python
class TweetSearchService:
    async def search_tweets(self, query, filters=None):
        # Build Elasticsearch query
        es_query = {
            'query': {
                'bool': {
                    'must': [
                        {
                            'multi_match': {
                                'query': query,
                                'fields': ['content^2', 'user.name'],
                                'type': 'best_fields'
                            }
                        }
                    ],
                    'filter': []
                }
            },
            'sort': [
                {'created_at': 'desc'},
                {'_score': 'desc'}
            ]
        }
        
        # Apply filters
        if filters:
            if filters.get('from_user'):
                es_query['query']['bool']['filter'].append({
                    'term': {'user_id': filters['from_user']}
                })
            
            if filters.get('since'):
                es_query['query']['bool']['filter'].append({
                    'range': {'created_at': {'gte': filters['since']}}
                })
        
        # Execute search
        results = await self.elasticsearch.search(
            index='tweets',
            body=es_query,
            size=20
        )
        
        # Hydrate results
        tweet_ids = [hit['_id'] for hit in results['hits']['hits']]
        tweets = await self.fetch_tweets(tweet_ids)
        
        return tweets
```

**5. Trending Topics**
```python
class TrendingService:
    def __init__(self):
        self.window_size = 3600  # 1 hour
        self.min_sketch = CountMinSketch(width=1000, depth=5)
        
    async def process_tweet(self, tweet):
        # Extract hashtags
        hashtags = extract_hashtags(tweet.content)
        
        timestamp = int(time.time())
        window_id = timestamp // self.window_size
        
        for tag in hashtags:
            # Increment count
            key = f"trend:{window_id}:{tag}"
            await self.redis.zincrby('trending', 1, tag)
            
            # Update Count-Min Sketch
            self.min_sketch.update(tag)
    
    async def get_trending(self, limit=10):
        # Get top hashtags from last hour
        trending = await self.redis.zrevrange(
            'trending', 0, limit-1, withscores=True
        )
        
        # Calculate velocity (trending up/down)
        results = []
        for tag, count in trending:
            prev_count = await self.get_previous_hour_count(tag)
            velocity = (count - prev_count) / prev_count if prev_count > 0 else float('inf')
            
            results.append({
                'tag': tag,
                'count': count,
                'velocity': velocity
            })
        
        # Sort by velocity
        results.sort(key=lambda x: x['velocity'], reverse=True)
        
        return results
```

### Database Schema
```sql
-- PostgreSQL Schema
CREATE TABLE users (
    id BIGINT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    follower_count INT DEFAULT 0,
    following_count INT DEFAULT 0
);

CREATE TABLE tweets (
    id BIGINT PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    content TEXT NOT NULL,
    media_urls TEXT[],
    reply_to_id BIGINT REFERENCES tweets(id),
    retweet_of_id BIGINT REFERENCES tweets(id),
    created_at TIMESTAMP DEFAULT NOW(),
    like_count INT DEFAULT 0,
    retweet_count INT DEFAULT 0,
    reply_count INT DEFAULT 0
);

CREATE INDEX idx_tweets_user_created ON tweets(user_id, created_at DESC);
CREATE INDEX idx_tweets_created ON tweets(created_at DESC);

CREATE TABLE likes (
    user_id BIGINT REFERENCES users(id),
    tweet_id BIGINT REFERENCES tweets(id),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, tweet_id)
);

CREATE TABLE follows (
    follower_id BIGINT REFERENCES users(id),
    following_id BIGINT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

-- Partitioned by month for scalability
CREATE TABLE tweets_2024_01 PARTITION OF tweets
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### Scaling Considerations

**Write Scalability:**
- Partition tweets by time (monthly partitions)
- Shard by user_id for hot users
- Kafka for async processing
- Batch writes to reduce DB load

**Read Scalability:**
- Redis cache for timelines (hot data)
- CDN for media
- Read replicas for user timelines
- Elasticsearch for search

**Numbers:**
- 200M tweets/day = 2,300 tweets/sec average
- Peak: 10,000 tweets/sec
- Timeline reads: 500M DAU × 20 reads/day = 10B reads/day = 115k reads/sec
- Redis can handle millions of ops/sec

---

## Problem 2: Design Instagram

### Unique Challenges
- Heavy media (photos/videos)
- Stories (ephemeral content)
- Image filters/processing
- Explore feed (discovery)

### Key Differences from Twitter
```
Instagram vs Twitter:
├─ Media-first (not text)
├─ Larger file sizes (need CDN)
├─ Image processing pipeline
├─ Stories (24-hour TTL)
└─ Explore algorithm (personalized discovery)
```

### Architecture
```
Upload Flow:
User uploads photo
├─ Upload to S3 (original)
├─ Queue processing job
├─ Generate thumbnails (multiple sizes)
├─ Apply filters (if selected)
├─ Store metadata in DB
├─ Update feed caches
└─ Send notifications

Story Flow:
User posts story
├─ Upload to S3
├─ Set TTL (24 hours)
├─ Add to story ring cache
├─ Notify followers
└─ Auto-delete after 24h
```

**Image Processing Pipeline:**
```python
class ImageProcessor:
    SIZES = {
        'thumbnail': (150, 150),
        'feed': (640, 640),
        'full': (1080, 1080)
    }
    
    async def process_upload(self, image_data, user_id):
        # Upload original
        original_key = f"originals/{user_id}/{uuid4()}.jpg"
        await self.s3.upload(original_key, image_data)
        
        # Queue processing
        job = {
            'image_key': original_key,
            'user_id': user_id,
            'sizes': self.SIZES,
            'filters': []
        }
        await self.kafka.publish('image.process', job)
        
        return original_key
    
    async def process_job(self, job):
        # 1. Download original from S3
        image_data = await self.s3.download(job['image_key'])
        
        # 2. Sequential processing
        processed_urls = {}
        for size_name, dimensions in job['sizes'].items():
            # Resize
            resized = await self.resize_image(image_data, dimensions)
            
            # Apply filters if any
            for filter_name in job['filters']:
                resized = await self.apply_filter(resized, filter_name)
                
            # Upload to S3 (Publicly accessible via CDN)
            key = f"processed/{job['user_id']}/{size_name}/{uuid4()}.jpg"
            await self.s3.upload(key, resized)
            processed_urls[size_name] = f"https://cdn.instaclone.com/{key}"
            
        # 3. Update DB with new URLs
        await self.db.update_photo_urls(job['image_key'], processed_urls)
        
        # 4. Notify followers (Fan-out)
        await self.notify_followers(job['user_id'], processed_urls['thumbnail'])

---

## Problem 3: Facebook News Feed
### Key Challenges:
- **Massive Scale**: 3B+ users, trillions of edges in social graph.
- **Complex Ranking**: Hundreds of signals (affinity, weight, time decay).
- **Ads Integration**: Real-time ad auction and placement.

### Architecture:
- **Web Tier**: Aggregates data from multiple services.
- **News Feed Service**: The heart of the system.
- **Social Graph Service (TAO)**: Facebook's distributed graph database for relationships.
- **Ranking Engine**: ML-based scorer.
- **Ad Service**: Inserts sponsored content.

### Ranking Logic (Simplified):
```python
def news_feed_score(user, post):
    affinity = calculate_user_affinity(user, post.author)
    weight = get_post_type_weight(post.type) # Video > Photo > Text
    time_decay = 1 / (time_since_post + 1)**1.5
    
    return (affinity * weight * time_decay)
```

---

## Problem 4: LinkedIn - Professional Network
### Key Challenges:
- **Search (People/Jobs)**: Complex filtering (skills, location, company).
- **"Who Viewed Your Profile"**: Real-time tracking and privacy.
- **Connection Recommendations**: "People You May Know" (Triadic Closure).

### Data Model:
- **Nodes**: Person, Company, Job, Post, Skill.
- **Edges**: WORKS_AT, FOLLOWS, MEMBER_OF, HAS_SKILL, CONNECTED_TO.

---

## Problem 5: TikTok - Short Video & FYP
### Key Challenges:
- **For You Page (FYP)**: Ultra-personalized, real-time feedback loop.
- **Global Content Distribution**: High-bandwidth video delivery.
- **Creation Tools**: AR filters and music integration.

### FYP Algorithm Hook:
- **Cold Start**: Show diverse popular videos to new users.
- **Engagement Loop**: Track watch time (critical!), re-watches, and skips.
- **Interest Graph**: Group users by niche interests (hashtags, music).

---

## Problem 6: Reddit - The Front Page
### Key Challenges:
- **Upvoting/Downvoting**: Real-time score aggregation.
- **r/all Ranking**: Hot ranking algorithm (Wilcoxon confidence interval for comments).
- **Concurrency**: Massive traffic to specific subreddits during events.

### Hot Ranking Formula:
```python
def hot_ranking(ups, downs, date):
    score = ups - downs
    order = log10(max(abs(score), 1))
    sign = 1 if score > 0 else -1 if score < 0 else 0
    seconds = date - 1134028003 # Reddit Epoch
    return round(sign * order + seconds / 45000, 7)
```

---

# Module 7.2: Media & Streaming

## Problem 1: YouTube - Video Platform
### Key Challenges:
- **Video Transcoding**: Converting raw 4K to 144p, 360p, etc.
- **DASH/HLS Streaming**: Segmented video delivery.
- **View Count**: Handling concurrent viewers (eventual consistency).

### Transcoding Pipeline:
1. **Upload**: Chunked upload to Blob Storage.
2. **Analysis**: Extract metadata, resolution, frame rate.
3. **Split**: Break video into small segments.
4. **Worker Pool**: Parallel workers transcode segments into various bitrates.
5. **Merge**: Combine segments into manifest files (m3u8/mpd).

## Problem 2: Netflix - Global Streaming
### Key Challenges:
- **Open Connect (CDN)**: ISP-internal caching servers.
- **Microservices Complexity**: 1000+ services communicating via Hystrix/gRPC.
- **Personalization**: Unique homepage for every user.

## Problem 3: Spotify - Music & Playlists
### Key Challenges:
- **Massive Catalog Search**: Inverted indexes for artists/tracks.
- **Discover Weekly**: Matrix factorization and word2vec on playlists.
- **Audio Buffering**: Small initial buffer for instant playback.

## Problem 4: Twitch - Live Streaming
### Key Challenges:
- **Real-time Chat**: Millions of messages per second in one channel.
- **Low Latency**: <1s delay between streamer and viewer.
- **Transcoding at Scale**: Live transcoding for thousands of simultaneous streams.

## Problem 5: Zoom - Video Conferencing
### Key Challenges:
- **Latency Control**: <150ms round-trip for natural conversation.
- **Variable Bitrate**: Adapting to poor network conditions.
- **MCU vs SFU**: Multipoint Control Unit vs Selective Forwarding Unit (SFU is preferred for scalability).

---

# Module 7.3: E-commerce & Marketplace

## Problem 1: Amazon - E-commerce Platform
### Key Challenges:
- **Inventory Management**: Real-time stock updates across millions of products.
- **Order Processing**: Distributed transactions and idempotency.
- **Cart Consistency**: Session management vs DB persistence.

### Distributed Lock for Inventory:
```python
def update_inventory(product_id, quantity):
    # Using Redis Redlock for distributed consistency
    with redis.lock(f"lock:product:{product_id}", timeout=5):
        stock = db.get_stock(product_id)
        if stock >= quantity:
            db.reduce_stock(product_id, quantity)
            return True
        return False
```

## Problem 2: Uber/Lyft - Ride Matching
### Key Challenges:
- **Geospatial Indexing**: QuadTree or Geohash for finding nearby drivers.
- **Dynamic Pricing**: Surge pricing based on real-time supply and demand.
- **Live Tracking**: High-frequency location updates via WebSockets.

### Geohash Search Concept:
```python
def find_nearby_drivers(lat, lon, radius_km):
    center_hash = geohash.encode(lat, lon, precision=6)
    neighbors = geohash.neighbors(center_hash)
    
    potential_drivers = []
    for h in [center_hash] + neighbors:
        # Fetch drivers from Redis GEO sets
        drivers = redis.georadius(f"drivers:{h}", lat, lon, radius_km, unit='km')
        potential_drivers.extend(drivers)
    
    return potential_drivers
```

## Problem 3: Airbnb - Property Search & Booking
### Key Challenges:
- **Calendar Availability**: Handling overlapping bookings and timezones.
- **Search Ranking**: Personalized recommendations based on user history and reviews.
- **Secure Payments**: Integrating with third-party gateways (Stripe).

## Problem 4: Food Delivery (DoorDash/UberEats)
### Key Challenges:
- **Order Life Cycle**: Customer -> Restaurant -> Driver -> Customer.
- **Real-time Dispatching**: Optimizing driver routes for multiple deliveries.

## Problem 5: Ticket Booking (BookMyShow)
### Key Challenges:
- **Seat Locking**: Temporary locks during checkout (e.g., 5-min TTL in Redis).
- **Concurrency**: High traffic spikes (Flash Sales).

---

# Module 7.4: Communication & Collaboration

## Problem 1: WhatsApp - Messenger
### Key Challenges:
- **Presence Tracking**: Distributed last seen/online status.
- **Group Chat Fan-out**: Delivering messages to thousands of members efficiently.
- **End-to-End Encryption**: Signal Protocol.

## Problem 2: Slack - Professional Chat
### Key Challenges:
- **Channel History Search**: Full-text search over millions of messages.
- **Threads**: Hierarchical message storage.

## Problem 3: Google Docs - Collaborative Editing
### Key Challenges:
- **Conflict Resolution**: Operational Transform (OT) vs CRDT.
- **Low Latency Sync**: Real-time cursor positions and edits.

---

# Module 7.5: Cloud Storage & Sync

## Problem 1: Dropbox - File Hosting
### Key Challenges:
- **Chunking**: Breaking large files into 4MB blocks.
- **Deduplication**: Storing identical blocks only once across the system.
- **Delta Sync**: Syncing only modified chunks.

## Problem 2: Google Photos - Photo Management
### Key Challenges:
- **Massive Storage**: Billions of photos (S3/Cold Storage).
- **Auto-tagging**: ML-based image recognition and indexing.

---

# Module 7.6: Search & Discovery

## Problem 1: Google Search
### Key Challenges:
- **Crawling**: Discovering and indexing billions of web pages.
- **Ranking**: PageRank and hundreds of other signals.
- **Inverted Index**: Mapping words to documents.

## Problem 2: Typeahead/Autocomplete
### Key Challenges:
- **Trie Data Structure**: Efficient prefix matching.
- **Low Latency**: <10ms for search suggestions.
- **Popularity Tracking**: Updating suggestions based on real-time trends.

---

# Module 7.7: Financial & Trading

## Problem 1: Stock Trading Platform
### Key Challenges:
- **Low Latency Matching Engine**: Order execution in microseconds.
- **Market Data Feed**: Real-time price updates via WebSockets/UDP.
- **Acid Transactions**: Guaranteeing trade execution and balance updates.

## Problem 2: Payment System (Stripe)
### Key Challenges:
- **Idempotency**: Preventing double charges (using Idempotency-Key).
- **Compliance**: PCI DSS and secure credential handling.

---

# Module 7.8: Infrastructure & Platform

## Problem 1: Kafka-like Message Queue
### Key Challenges:
- **Partitioning**: Horizontal scaling of topics.
- **Zero-copy Reads**: High-throughput message delivery using `sendfile()`.
- **Replication**: High availability via Quorum.

## Problem 2: API Gateway
### Key Challenges:
- **Rate Limiting**: Throttling requests per user/IP.
- **Authentication**: Centralized JWT/OAuth verification.
- **Request Routing**: Global load balancing and service discovery.