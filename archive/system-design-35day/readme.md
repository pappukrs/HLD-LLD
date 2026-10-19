# 5-Week System Design Learning Plan (35 Days Challenge)

## Week 1️⃣ - Scalability & Performance Optimization

### Topics:
- Scalability (Horizontal vs. Vertical Scaling)
- API Gateway
- Load Balancing (Round Robin, Least Connections, etc.)
- Caching (CDN, Redis, Memcached, Cache Invalidation)
- CAP Theorem & PACELC Theorem
- Bloom Filters

### Learning Resources & Activities:
- Read about API gateways (Kong, Nginx, AWS API Gateway).
- Implement a load balancer using Nginx and HAProxy.
- Use Redis for caching in a Node.js project.
- Study CAP theorem and apply its principles in designing databases.
- Implement Bloom Filters in JavaScript.

## Week 2️⃣ - Databases & Data Storage

### Topics:
- SQL vs. NoSQL Databases (MongoDB, PostgreSQL, MySQL)
- Data Modeling and Normalization
- Indexing Strategies (B-Trees, Hash Indexes)
- Partitioning (Range, Hash, List, Composite)
- Sharding (Key-based, Range-based, Directory-based)
- Replication (Leader-Follower, Multi-Leader, Peer-to-Peer)

### Learning Resources & Activities:
- Set up and configure a PostgreSQL database.
- Implement sharding and replication in MongoDB.
- Explore database indexing using PostgreSQL.
- Design a scalable database schema for a social media app.

## Week 3️⃣ - Networking & Communication

### Topics:
- Basics of Computer Networking
- REST API Principles
- gRPC and Protocol Buffers
- GraphQL (Schema Design, Queries, Mutations)
- DNS & Proxies
- WebSockets & Long Polling

### Learning Resources & Activities:
- Build RESTful and GraphQL APIs in Node.js.
- Implement gRPC communication in a microservice.
- Set up WebSockets for real-time chat applications.
- Configure a reverse proxy using Nginx.

## Week 4️⃣ - Distributed Systems & Fault Tolerance

### Topics:
- Distributed Systems Basics
- Consistency Models (Strong, Eventual, Causal)
- Quorum Mechanism
- Leader-Follower Architecture
- Merkle Trees & Data Integrity
- Consistent Hashing

### Learning Resources & Activities:
- Build a leader-follower replication model using PostgreSQL.
- Implement consistent hashing in a caching layer.
- Study and design distributed log processing systems (Kafka).
- Simulate quorum-based decision-making in a database cluster.

## Week 5️⃣ - APIs & Architectural Design Patterns

### Topics:
- API Design Best Practices
- Architectural Patterns (Monolith vs. Microservices)
- Event-Driven Architecture (Pub/Sub Model, Message Queues)
- Sharding Pattern
- Circuit Breaker Pattern
- Static Content Hosting

### Learning Resources & Activities:
- Refactor a monolithic Node.js app into microservices.
- Implement a message queue with RabbitMQ or Kafka.
- Use a circuit breaker library like opossum in Node.js.
- Deploy a microservices-based application on Kubernetes.

## Final Project:
Build a scalable, real-time application (e.g., chat app, stock price tracker) incorporating:
- Load balancing and caching
- Scalable database design (sharding, replication)
- Efficient API communication (REST, GraphQL, WebSockets)
- Microservices and event-driven architecture

This structured plan will help you progress from system design fundamentals to advanced distributed systems, ensuring a strong foundation in designing scalable and efficient systems with Node.js. 🚀

---

### Week 1: Scalability & Performance Optimization

We'll break down the topics into 7 days to move from basic to advanced concepts.

#### 📅 Day 1: Understanding Scalability
- **What is Scalability?**
  - Scalability is the ability of a system to handle increased load by adding resources. It ensures that performance remains stable as traffic grows.
- **Types of Scalability:**
  - **Vertical Scaling (Scaling Up)**
    - Adding more resources (CPU, RAM, Storage) to a single server.
    - Limited by hardware capacity.
    - Example: Upgrading a server from 8GB RAM to 32GB.
  - **Horizontal Scaling (Scaling Out)**
    - Adding more machines (servers) to handle traffic.
    - Load is distributed across multiple instances.
    - Example: Deploying multiple instances behind a load balancer.
- **When to Use?**
  - Vertical Scaling is easier but expensive and has a limit.
  - Horizontal Scaling is more flexible but requires extra infrastructure (load balancers, distributed databases).

🔍 **Activity:**
Research how companies like Netflix, Amazon, and Google scale their applications.

#### 📅 Day 2: API Gateway & Its Role in Scalability
- **What is an API Gateway?**
  - An API Gateway is a single entry point for client requests. It acts as a reverse proxy and handles routing, authentication, and rate limiting.
- **Why Use an API Gateway?**
  - ✅ Manages multiple microservices efficiently.
  - ✅ Improves security with authentication & rate limiting.
  - ✅ Reduces API call overhead by aggregating responses.
- **Popular API Gateways:**
  - Kong API Gateway
  - AWS API Gateway
  - NGINX as API Gateway

🔍 **Activity:**
Install Kong API Gateway locally and set up a simple API.

#### 📅 Day 3: Load Balancing - Distributing Traffic Efficiently
- **What is Load Balancing?**
  - Load balancing distributes incoming traffic across multiple servers to prevent overload.
- **Types of Load Balancers:**
  - DNS Load Balancing (Traffic is distributed at the DNS level)
  - Software Load Balancers (NGINX, HAProxy)
  - Hardware Load Balancers (F5, Citrix NetScaler)
- **Load Balancing Algorithms:**
  - Round Robin → Requests are evenly distributed.
  - Least Connections → Sends requests to the server with the fewest connections.
  - IP Hashing → Routes requests from the same client to the same server.

🔍 **Activity:**
Set up an NGINX Load Balancer and route traffic to multiple Node.js servers.

#### 📅 Day 4: Caching - Making Apps Faster
- **What is Caching?**
  - Caching stores frequently accessed data to reduce database queries and improve performance.
- **Types of Caching:**
  - CDN Caching → Stores static assets closer to users (Cloudflare, AWS CloudFront).
  - Application Caching → Stores computed results (Redis, Memcached).
  - Database Caching → Caches query results for faster retrieval.
- **Cache Invalidation Strategies:**
  - Time-based Expiration (TTL - Time to Live).
  - Write-through Cache (Data is updated in cache and DB).
  - Lazy Loading (Cache updates only when data is requested).

🔍 **Activity:**
Install Redis and set up caching for a simple Node.js API.

#### 📅 Day 5: CAP Theorem & PACELC Theorem
- **What is the CAP Theorem?**
  - It states that a distributed system cannot guarantee all three at the same time:
    - Consistency (C) → All nodes see the same data at the same time.
    - Availability (A) → Every request gets a response.
    - Partition Tolerance (P) → System works despite network failures.
  - ⚡ Tradeoff: In reality, systems pick CP (Strong Consistency) or AP (High Availability).
- **PACELC Theorem**
  - Extends CAP by adding a trade-off in the absence of network failure:
    - If partitioned (P) → Choose A or C.
    - Else (E) → Choose Latency (L) or Consistency (C).

🔍 **Activity:**
Study how MongoDB (AP) and PostgreSQL (CP) follow CAP.

#### 📅 Day 6: Bloom Filters - Efficient Lookups
- **What is a Bloom Filter?**
  - A probabilistic data structure used to check if an item may be present in a dataset (false positives possible).
- **How it Works?**
  - Insert an item → Hash it to multiple positions in a bit array.
  - Lookup → Check those positions; if all bits are 1, the item may exist.
- 🚀 **Use Cases:**
  - Caching (Avoid unnecessary DB lookups).
  - Spell checkers.
  - Preventing duplicate registrations.

🔍 **Activity:**
Implement a Bloom Filter in JavaScript.

#### 📅 Day 7: Hands-on Project - Putting It All Together
- **Project: Build a Scalable API Service**
  - ✅ Use NGINX for load balancing.
  - ✅ Implement caching using Redis.
  - ✅ Design an API Gateway using Kong.
  - ✅ Optimize API responses using Bloom Filters.

🔍 **Activity:**
Deploy your API and test its scalability with a load-testing tool like Apache JMeter.

🎯 **What You've Learned in Week 1:**
- ✔️ Scaling applications horizontally & vertically.
- ✔️ Setting up API Gateways & Load Balancers.
- ✔️ Implementing caching using Redis.
- ✔️ Understanding CAP & PACELC Theorems.
- ✔️ Using Bloom Filters for optimization.

🚀 **Next: Move to Week 2 - Databases & Data Storage!**
Would you like any hands-on coding examples for these topics? 😊

---

### Week 2: Databases & Data Storage

This week, we will explore SQL & NoSQL databases, data modeling, indexing, partitioning, sharding, and replication with hands-on implementation.

#### 📅 Day 1: SQL vs. NoSQL - Understanding the Database Landscape
- **What is a Database?**
  - A database is a structured system for storing, retrieving, and managing data efficiently.
- **Types of Databases:**
  - **SQL Databases (Relational Databases)**
    - Structured data stored in tables.
    - Uses SQL for queries (SELECT, JOIN, etc.).
    - ACID compliance (Atomicity, Consistency, Isolation, Durability).
    - Examples: PostgreSQL, MySQL, MariaDB.
  - **NoSQL Databases (Non-Relational)**
    - Designed for flexible and high-performance applications.
    - Supports unstructured or semi-structured data.
    - BASE (Basically Available, Soft state, Eventually consistent).
    - Examples: MongoDB (Document-based), Redis (Key-Value), Cassandra (Wide-Column), Neo4j (Graph-based).

- **When to Use What?**

| Use Case                  | SQL (Relational) | NoSQL (Non-Relational) |
|---------------------------|------------------|------------------------|
| Banking, Transactions     | ✅ Yes (ACID)    | ❌ No                  |
| Social Media, Real-time Apps | ❌ No           | ✅ Yes (Scalability)   |
| E-commerce                | ✅ Yes           | ✅ Yes (Hybrid Approach) |
| IoT, Big Data             | ❌ No            | ✅ Yes                 |

🔍 **Activity:**
Install PostgreSQL and MongoDB on your local machine.
Create a sample table in PostgreSQL and a document in MongoDB.

#### 📅 Day 2: Data Modeling & Normalization
- **What is Data Modeling?**
  - Data modeling defines the structure, relationships, and rules for storing and retrieving data efficiently.
- **Data Modeling in SQL:**
  - 1NF (First Normal Form): No duplicate columns.
  - 2NF (Second Normal Form): No partial dependencies.
  - 3NF (Third Normal Form): No transitive dependencies.
  - BCNF (Boyce-Codd Normal Form): Stronger version of 3NF.
  - **Example: E-commerce Database**
    - Users (id, name, email, address)
    - Orders (id, user_id, product_id, quantity, status)
    - Products (id, name, price)
- **Data Modeling in NoSQL:**
  - Denormalization is preferred for fast reads.
  - Schema is flexible (JSON, Key-Value, Graph).
  - **Example: A User Profile document in MongoDB:**

  ```json
  {
    "_id": "123",
    "name": "Alice",
    "email": "alice@example.com",
    "orders": [
      {"product": "Laptop", "price": 1200},
      {"product": "Mouse", "price": 50}
    ]
  }
  ```

🔍 **Activity:**
Design a normalized database for an online bookstore in PostgreSQL.
Create a NoSQL schema for a messaging app in MongoDB.

#### 📅 Day 3: Indexing Strategies - Optimizing Query Performance
- **What is Indexing?**
  - An index is a data structure that speeds up search queries.
- **Types of Indexes:**
  - **B-Tree Index (Balanced Tree)**
    - Default in PostgreSQL, MySQL.
    - Optimized for range queries.
  - **Hash Index**
    - Used for exact matches.
    - Faster than B-Tree but not for range queries.
  - **GIN (Generalized Inverted Index)**
    - Used for full-text search.

- **Creating an Index in PostgreSQL:**

  ```sql
  CREATE INDEX idx_user_email ON users(email);
  ```

🔍 **Activity:**
Run an EXPLAIN ANALYZE query in PostgreSQL before and after indexing.
Implement a MongoDB index on a user collection.

#### 📅 Day 4: Partitioning - Handling Large Datasets
- **What is Partitioning?**
  - Partitioning divides a large table into smaller, more manageable pieces.
- **Types of Partitioning:**
  - **Range Partitioning:** Based on value ranges (e.g., Date).
  - **Hash Partitioning:** Even distribution based on a hash function.
  - **List Partitioning:** Based on predefined categories.
  - **Composite Partitioning:** Combination of two or more partitioning types.

- **Partitioning in PostgreSQL:**

  ```sql
  CREATE TABLE orders (
      id SERIAL PRIMARY KEY,
      user_id INT,
      total_price NUMERIC,
      created_at DATE
  ) PARTITION BY RANGE (created_at);
  ```

🔍 **Activity:**
Partition a sales table based on year in PostgreSQL.
Implement range-based partitioning in MongoDB.

#### 📅 Day 5: Sharding - Distributing Data Across Nodes
- **What is Sharding?**
  - Sharding splits large databases across multiple machines to improve scalability.
- **Types of Sharding:**
  - **Key-based Sharding:** Uses a hash function (e.g., User ID % number of shards).
  - **Range-based Sharding:** Divides based on range (e.g., A-M goes to Shard 1, N-Z to Shard 2).
  - **Directory-based Sharding:** A lookup service maps data to shards.

- **Sharding in MongoDB:**

  ```shell
  sh.enableSharding("myDatabase");
  sh.shardCollection("myDatabase.users", { "_id": "hashed" });
  ```

🔍 **Activity:**
Implement range-based sharding in MongoDB for a large dataset.
Study how Instagram uses sharding to scale.

#### 📅 Day 6: Replication - Ensuring High Availability
- **What is Replication?**
  - Replication keeps multiple copies of a database across different servers.
- **Types of Replication:**
  - **Leader-Follower (Master-Slave):** Leader handles writes, followers handle reads.
  - **Multi-Leader (Master-Master):** Multiple leaders for writes.
  - **Peer-to-Peer (No Master):** All nodes are equal.

- **Replication in PostgreSQL:**

  ```sql
  SELECT pg_create_physical_replication_slot('replica_slot');
  ```

- **Replication in MongoDB:**

  ```shell
  rs.initiate();
  rs.add("replica2:27017");
  rs.add("replica3:27017");
  ```

🔍 **Activity:**
Set up PostgreSQL replication between two servers.
Implement MongoDB replica set in Docker.

#### 📅 Day 7: Hands-on Project - Designing a Scalable Database
- **Project:**
  - ✅ Set up a PostgreSQL database with proper normalization.
  - ✅ Implement indexing and partitioning for optimization.
  - ✅ Shard a large dataset using MongoDB.
  - ✅ Set up replication to ensure high availability.
  - ✅ Design a scalable schema for a social media platform.

🔍 **Activity:**
Run load tests on your database using Apache JMeter or pgbench.
Compare PostgreSQL vs. MongoDB performance for a use case.

🎯 **What You've Learned in Week 2:**
- ✔️ SQL vs. NoSQL databases and when to use them.
- ✔️ Data modeling techniques for relational & NoSQL databases.
- ✔️ Indexing to optimize queries.
- ✔️ Partitioning & sharding strategies for scalability.
- ✔️ Replication techniques for high availability.

🚀 **Next: Move to Week 3 - Networking & API Communication!**
Would you like coding examples for any of these topics? 😊

---

### Week 3: Networking & Communication

This week, you'll dive into networking fundamentals, REST API design, gRPC, GraphQL, WebSockets, and proxies, progressing from basic concepts to hands-on implementations.

#### 📅 Day 1: Basics of Computer Networking
- **What is Networking?**
  - Networking is the process of connecting computers, servers, and devices to share data efficiently.
- **Key Concepts:**
  - **IP Addresses & Ports**
    - IPv4 vs. IPv6
    - Ports (e.g., HTTP - 80, HTTPS - 443, MySQL - 3306)
  - **TCP vs. UDP**
    - TCP: Reliable, ordered, slower (e.g., HTTP, HTTPS).
    - UDP: Fast, connectionless (e.g., video streaming, gaming).
  - **HTTP vs. HTTPS**
    - HTTP: Unencrypted, insecure.
    - HTTPS: Secure (SSL/TLS).
  - **DNS (Domain Name System)**
    - Resolves domain names to IP addresses (e.g., google.com → 172.217.160.142).

🔍 **Activity:**
Run `ping google.com` and `traceroute google.com` to see network paths. Test TCP vs. UDP by sending data with Netcat (nc).

#### 📅 Day 2: REST API Principles
- **What is REST?**
  - REST (Representational State Transfer) is an API design pattern that follows:
    - ✅ Statelessness (No session state stored on the server).
    - ✅ Client-Server Separation.
    - ✅ Resource-Based URLs (e.g., /users/{id}).

- **RESTful API Methods:**

| HTTP Method | Action       | Example Endpoint |
|-------------|--------------|------------------|
| GET         | Read Data    | /users/1         |
| POST        | Create Data  | /users           |
| PUT         | Update Data  | /users/1         |
| DELETE      | Remove Data  | /users/1         |

- **Example: Building a REST API in Node.js**

  ```javascript
  const express = require('express');
  const app = express();
  app.use(express.json());

  app.get('/users/:id', (req, res) => {
    res.json({ id: req.params.id, name: "John Doe" });
  });

  app.listen(3000, () => console.log('Server running on port 3000'));
  ```

🔍 **Activity:**
Test REST APIs using Postman or curl.
Create CRUD APIs for a To-Do App using Express.js.

#### 📅 Day 3: gRPC and Protocol Buffers
- **What is gRPC?**
  - gRPC is a high-performance, language-independent Remote Procedure Call (RPC) framework developed by Google.
  - 🚀 Faster than REST due to Protocol Buffers (protobufs) instead of JSON.

- **Key Features:**
  - ✔️ Binary data format (protobuf) → Smaller, faster.
  - ✔️ Strongly-typed contracts → API schema enforced.
  - ✔️ Bidirectional streaming → Efficient real-time communication.

- **Example: Define a gRPC Service (user.proto)**

  ```protobuf
  syntax = "proto3";

  service UserService {
    rpc GetUser (UserRequest) returns (UserResponse);
  }

  message UserRequest {
    string id = 1;
  }

  message UserResponse {
    string id = 1;
    string name = 2;
  }
  ```

- **Run gRPC Server in Node.js**

  ```javascript
  const grpc = require('@grpc/grpc-js');
  const protoLoader = require('@grpc/proto-loader');

  const packageDefinition = protoLoader.loadSync('user.proto');
  const userProto = grpc.loadPackageDefinition(packageDefinition).UserService;

  const server = new grpc.Server();
  server.addService(userProto.service, {
    GetUser: (call, callback) => {
      callback(null, { id: call.request.id, name: "Alice" });
    }
  });

  server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
    server.start();
  });
  ```

🔍 **Activity:**
Implement a gRPC microservice for user management.
Compare REST vs. gRPC performance using Postman & BloomRPC.

#### 📅 Day 4: GraphQL - Schema Design, Queries, Mutations
- **What is GraphQL?**
  - GraphQL is a query language for APIs that allows clients to request only the data they need.

- **Key Benefits:**
  - ✔️ Single Endpoint (/graphql) – No multiple REST routes.
  - ✔️ Strongly Typed Schema – Defines API contract.
  - ✔️ No Over-fetching – Fetch only required fields.

- **GraphQL Schema Example (User Type)**

  ```graphql
  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Query {
    getUser(id: ID!): User
  }

  type Mutation {
    createUser(name: String!, email: String!): User
  }
  ```

- **Building a GraphQL API in Node.js**

  ```javascript
  const { ApolloServer, gql } = require('apollo-server');

  const typeDefs = gql`
    type User {
      id: ID!
      name: String!
      email: String!
    }
    type Query {
      getUser(id: ID!): User
    }
    type Mutation {
      createUser(name: String!, email: String!): User
    }
  `;

  const resolvers = {
    Query: {
      getUser: (_, { id }) => ({ id, name: "Alice", email: "alice@example.com" }),
    },
    Mutation: {
      createUser: (_, { name, email }) => ({ id: "1", name, email }),
    },
  };

  const server = new ApolloServer({ typeDefs, resolvers });
  server.listen(4000, () => console.log('GraphQL Server running on 4000'));
  ```

🔍 **Activity:**
Test GraphQL queries in Apollo Sandbox.
Convert a REST API into GraphQL.

#### 📅 Day 5: DNS & Proxies
- **What is DNS?**
  - DNS (Domain Name System) translates domain names into IP addresses.

- **Types of Proxies:**
  - **Forward Proxy:** Acts on behalf of the client (e.g., VPNs).
  - **Reverse Proxy:** Sits in front of the server (e.g., Nginx, Cloudflare).

- **Setting Up Nginx as a Reverse Proxy**

  ```nginx
  server {
      listen 80;
      location /api/ {
          proxy_pass http://localhost:5000/;
      }
  }
  ```

🔍 **Activity:**
Configure Nginx as a reverse proxy for a Node.js server.
Use `dig` or `nslookup` to analyze DNS resolution.

#### 📅 Day 6: WebSockets & Long Polling
- **What is WebSockets?**
  - WebSockets allow bidirectional communication between client and server.
  - 🚀 Used in chat apps, real-time notifications, stock trading apps.

- **WebSockets in Node.js**

  ```javascript
  const WebSocket = require('ws');
  const wss = new WebSocket.Server({ port: 8080 });

  wss.on('connection', ws => {
    ws.send('Welcome to WebSocket Server!');
    ws.on('message', message => console.log(`Received: ${message}`));
  });
  ```

🔍 **Activity:**
Implement a real-time chat app using WebSockets.
Compare WebSockets vs. Long Polling performance.

#### 📅 Day 7: Final Project - Real-World API Architecture
- ✅ Build a REST API & GraphQL API for a user management system.
- ✅ Implement a gRPC microservice for authentication.
- ✅ Use WebSockets for real-time notifications.
- ✅ Deploy with Nginx reverse proxy & load balancing.

🚀 **Congratulations! You've learned Networking & API Communication.**

📌 **Next: Move to Week 4 - Distributed Systems & Microservices!**

---

### Week 4: Distributed Systems & Fault Tolerance

This week, you'll explore distributed computing, consistency models, replication strategies, and fault tolerance techniques from basic concepts to hands-on implementations.

#### 📅 Day 1: Basics of Distributed Systems
- **What is a Distributed System?**
  - A distributed system is a collection of computers working together as a single unit.
  - 🚀 Examples: Google Search, Netflix, Kubernetes clusters.

- **Challenges in Distributed Systems:**
  - Latency & Network Failures – Communication delays and node failures.
  - Consistency & Availability Trade-offs – CAP Theorem (Consistency, Availability, Partition Tolerance).
  - Concurrency & Synchronization – Handling multiple requests efficiently.

- **Types of Distributed Architectures:**
  - **Peer-to-Peer (P2P):** Equal nodes (e.g., BitTorrent).
  - **Client-Server:** Centralized servers handle clients (e.g., Web apps).
  - **Microservices:** Independent services communicate via APIs (e.g., Netflix).

🔍 **Activity:**
Read about Google's Spanner & Amazon DynamoDB distributed systems.
Set up a basic multi-node cluster using Docker Swarm.

#### 📅 Day 2: Consistency Models (Strong, Eventual, Causal)
- **Why is Consistency Important?**
  - Consistency ensures that all nodes in a distributed system have the same view of data.

- **Types of Consistency Models:**

| Consistency Model   | Description                                      | Example                                      |
|---------------------|--------------------------------------------------|----------------------------------------------|
| Strong Consistency  | All nodes see the latest data immediately.       | Traditional SQL databases (PostgreSQL, MySQL)|
| Eventual Consistency| Nodes may have stale data but will eventually be up-to-date. | NoSQL databases (DynamoDB, Cassandra)        |
| Causal Consistency  | Ensures cause-effect relationships in data updates. | Google Docs, collaborative editing apps      |

🔍 **Activity:**
Simulate eventual consistency with MongoDB Replication.
Experiment with strong consistency using PostgreSQL transactions.

#### 📅 Day 3: Quorum Mechanism
- **What is Quorum?**
  - A quorum ensures a minimum number of nodes agree before an operation is confirmed.
  - 📌 Used in distributed databases (Raft, Paxos, Cassandra).

- **How Quorum Works in a Distributed Database:**
  - **Read Quorum (R):** Minimum nodes required to read data.
  - **Write Quorum (W):** Minimum nodes required to confirm a write.
  - **Total Nodes (N):** Typically, R + W > N ensures consistency.

- **Example:** In Cassandra, setting R=2, W=2, N=3 ensures strong consistency.

🔍 **Activity:**
Simulate quorum-based reads & writes in Cassandra.
Experiment with ZooKeeper quorum mechanisms.

#### 📅 Day 4: Leader-Follower Architecture
- **What is Leader-Follower Replication?**
  - 🚀 Leader-Follower (Master-Slave) replication is a model where one node (Leader) writes data, while others (Followers) replicate it.

- **How It Works:**
  1. Leader handles all writes → Ensures strong consistency.
  2. Followers replicate data asynchronously.
  3. Failover: If the leader fails, a new leader is elected.

- **Example: PostgreSQL Leader-Follower Setup**

  1. **Set up the Leader node**

  ```sql
  ALTER SYSTEM SET wal_level = 'replica';
  SELECT pg_start_backup('backup');
  ```

  2. **Configure the Follower node**

  ```shell
  cp -r data/* replica_data/
  echo "standby_mode = 'on'" >> replica_data/postgresql.conf
  ```

  3. **Start the Follower instance**

  ```shell
  pg_ctl start -D replica_data
  ```

🔍 **Activity:**
Implement leader-follower replication in PostgreSQL.
Use Redis Sentinel for automatic failover in Redis clusters.

#### 📅 Day 5: Merkle Trees & Data Integrity
- **What is a Merkle Tree?**
  - A Merkle Tree is a tree structure where each node stores a hash of its child nodes.
  - 📌 Used in Git, Bitcoin, Cassandra to verify data integrity efficiently.

- **How It Works:**
  - **Leaf Nodes:** Store data hashes.
  - **Parent Nodes:** Store combined hashes of child nodes.
  - **Root Hash:** Unique fingerprint of all data.

- **Example:** Verifying blockchain transactions with Merkle Trees

  ```javascript
  const crypto = require('crypto');
  function hash(data) { return crypto.createHash('sha256').update(data).digest('hex'); }

  let transactions = ["tx1", "tx2", "tx3", "tx4"].map(hash);
  let parent = hash(transactions[0] + transactions[1]);
  console.log("Merkle Root Hash:", parent);
  ```

🔍 **Activity:**
Implement a Merkle Tree hash function in Python or JavaScript.
Explore how Bitcoin uses Merkle Trees for transaction validation.

#### 📅 Day 6: Consistent Hashing
- **What is Consistent Hashing?**
  - Consistent hashing is a load-balancing technique that minimizes reallocation of data when servers are added or removed.
  - 📌 Used in DynamoDB, Memcached, Distributed Caching Systems.

- **How It Works:**
  1. Each server is assigned a range on a circular hash ring.
  2. Keys are mapped to a server using a hash function.
  3. When a server fails or is added, only a fraction of keys are remapped instead of all.

- **Example:** Hashing a Key to a Server

  ```javascript
  const crypto = require('crypto');
  const servers = ["Server-1", "Server-2", "Server-3"];
  function hashKey(key) {
    return crypto.createHash('md5').update(key).digest('hex');
  }
  console.log("Assigned Server:", servers[parseInt(hashKey("user123"), 16) % servers.length]);
  ```

🔍 **Activity:**
Implement consistent hashing in a distributed caching system (e.g., Redis, Memcached).
Analyze how Amazon DynamoDB uses consistent hashing.

#### 📅 Day 7: Final Project - Distributed System Simulation
- ✅ Build a leader-follower PostgreSQL database cluster.
- ✅ Implement a distributed cache using consistent hashing (Redis).
- ✅ Use Merkle Trees for efficient data integrity verification.
- ✅ Simulate quorum-based decision-making in Cassandra.

🚀 **Congratulations! You've completed Distributed Systems & Fault Tolerance!**

📌 **Next: Move to Week 5 - Scalability & Performance Optimization!**

---

### Week 5️⃣ - APIs & Architectural Design Patterns

This week, you'll dive deep into API design, explore architectural patterns, and implement scalable system designs from basic concepts to hands-on applications.

#### 📅 Day 1: API Design Best Practices
- **What Makes a Good API?**
  - A well-designed API is:
    - ✅ Consistent → Follows predictable naming conventions.
    - ✅ Versioned → Allows backward compatibility.
    - ✅ Secure → Implements authentication & rate limiting.
    - ✅ Efficient → Uses proper status codes and pagination.

- **RESTful API Design Guidelines:**
  1. Use nouns in URIs → /users, /orders/{id} ✅ (Avoid verbs like /getUser).
  2. Use HTTP status codes:
     - 200 OK → Success
     - 201 Created → Resource created
     - 400 Bad Request → Invalid input
     - 404 Not Found → Resource missing
  3. Version your API: /api/v1/users

🔍 **Activity:**
Build a REST API in Node.js with Express. Apply API versioning & proper status codes.

#### 📅 Day 2: Monolith vs. Microservices Architecture
- **Monolithic Architecture**
  - 🟢 Pros:
    - ✔ Simple to develop & deploy
    - ✔ Single codebase & shared memory
  - 🔴 Cons:
    - ❌ Hard to scale
    - ❌ A single failure can crash the entire system

- **Microservices Architecture**
  - 🟢 Pros:
    - ✔ Independent deployment & scaling
    - ✔ Easier fault isolation
  - 🔴 Cons:
    - ❌ More complex communication
    - ❌ Requires service discovery & orchestration

🔍 **Activity:**
Convert a monolithic Node.js app into microservices using Express & Docker.
Implement inter-service communication with REST or gRPC.

#### 📅 Day 3: Event-Driven Architecture (Pub/Sub, Message Queues)
- **What is Event-Driven Architecture?**
  - Event-driven systems react to changes asynchronously.
  - 📌 Used in real-time systems (Uber, Netflix, Slack).

- **Key Patterns:**
  1. **Pub/Sub Model:** A publisher sends events to multiple subscribers.
  2. **Message Queues (Kafka, RabbitMQ):** Messages are sent to a queue and processed later.

- **Example:** Kafka Pub/Sub in Node.js

  ```javascript
  const kafka = require('kafka-node');
  const producer = new kafka.Producer(new kafka.KafkaClient());
  producer.send([{ topic: 'order_created', messages: 'New order placed!' }], () => {});
  ```

🔍 **Activity:**
Set up a Pub/Sub model using Redis or Kafka.
Implement event-driven order processing.

#### 📅 Day 4: Sharding Pattern
- **What is Sharding?**
  - Sharding splits data across multiple databases to improve performance & scalability.
  - 📌 Used by Facebook, Instagram, YouTube for large-scale systems.

- **Types of Sharding:**

| Type         | How It Works                          | Example                                      |
|--------------|---------------------------------------|----------------------------------------------|
| Key-Based    | Uses a hash function to distribute data. | User IDs in a distributed database.          |
| Range-Based  | Divides data into ranges.             | Orders from 2020–2022 in DB1, 2023 in DB2.   |
| Directory-Based | Stores a lookup table for shard locations. | Managing large-scale file storage.          |

🔍 **Activity:**
Implement MongoDB sharding in a Node.js app.
Analyze PostgreSQL partitioning strategies.

#### �� Day 5: Circuit Breaker Pattern
- **What is Circuit Breaking?**
  - A circuit breaker prevents a system from making repeated failed requests to an unhealthy service.
  - 📌 Used in Netflix, Amazon, and distributed microservices.

- **States of a Circuit Breaker:**
  1. **Closed:** Requests are sent normally.
  2. **Open:** Requests are blocked after repeated failures.
  3. **Half-Open:** A few test requests check if the system recovers.

- **Implementing a Circuit Breaker in Node.js with Opossum:**

  ```javascript
  const CircuitBreaker = require('opossum');
  const slowAPI = () => fetch('https://example.com/api');

  const breaker = new CircuitBreaker(slowAPI, { timeout: 5000, errorThresholdPercentage: 50 });
  breaker.fallback(() => "Service unavailable, try later.");

  breaker.fire().then(console.log).catch(console.error);
  ```

🔍 **Activity:**
Implement a circuit breaker for a microservice using Opossum.
Simulate a failing API and analyze recovery behavior.

#### 📅 Day 6: Static Content Hosting
- **What is Static Content?**
  - Static files (HTML, CSS, JS, images) don't change dynamically and can be cached for performance.

- **Hosting Options:**
  1. **CDN (Cloudflare, AWS S3, Netlify, Vercel):** Best for speed & scalability.
  2. **Nginx/Apache:** Serve static files from a traditional web server.
  3. **Node.js & Express:** Serve files with express.static().

- **Example:** Serving Static Files in Express.js

  ```javascript
  const express = require('express');
  const app = express();
  app.use(express.static('public'));
  app.listen(3000, () => console.log('Server running on port 3000'));
  ```

🔍 **Activity:**
Deploy a React app on Vercel or Netlify.
Optimize images & cache static assets with Nginx.

#### 📅 Day 7: Final Project - Building a Scalable API System
- ✅ Refactor a monolithic app into microservices.
- ✅ Use Kafka for asynchronous event-driven communication.
- ✅ Implement a circuit breaker in a microservice.
- ✅ Deploy the application on Kubernetes using Docker.

🚀 **Congratulations! You've mastered APIs & Architectural Design Patterns!**

📌 **Next: Move to Week 6 - Scalability & Performance Optimization!**

---



