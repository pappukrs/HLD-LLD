# Part 3: System Design Patterns & Architectures - Complete Mastery Guide

## 🎯 Learning Objectives
By mastering this part, you will be able to:
- Design scalable microservices architectures from scratch
- Implement event-driven systems with confidence
- Choose the right architectural patterns for any business problem
- Ace system design interviews at FAANG+ companies
- Understand trade-offs between different architectural approaches

---

# MODULE 3.1: MICROSERVICES ARCHITECTURE

## 📚 Foundation Concepts

### What are Microservices?
Microservices are an architectural style where an application is composed of small, independent services that communicate over well-defined APIs. Each service:
- Runs in its own process
- Can be deployed independently
- Owns its own database
- Is built around business capabilities

### The Evolutionary Path
```
Monolith → Modular Monolith → Service-Oriented Architecture (SOA) → Microservices
```

---

## 🏗️ Topic 1: Microservices vs Monolith

### Monolithic Architecture

**Characteristics:**
- Single deployable unit
- Shared database
- Tightly coupled components
- Single technology stack

**Advantages:**
1. **Simplicity**: Easy to develop initially, straightforward deployment
2. **Performance**: In-process communication is faster than network calls
3. **Consistency**: ACID transactions across entire application
4. **Testing**: Easier end-to-end testing
5. **Debugging**: Single codebase makes debugging simpler

**Disadvantages:**
1. **Scalability**: Must scale entire application, not individual components
2. **Deployment Risk**: Small change requires full redeployment
3. **Technology Lock-in**: Difficult to adopt new technologies
4. **Team Coordination**: Large teams working on same codebase causes conflicts
5. **Reliability**: Bug in one module can crash entire application

### Microservices Architecture

**Characteristics:**
- Multiple independently deployable services
- Decentralized data management
- Organized around business capabilities
- Technology diversity

**Advantages:**
1. **Independent Scalability**: Scale only the services that need it
2. **Technology Flexibility**: Use best tool for each job
3. **Fault Isolation**: Failure in one service doesn't crash everything
4. **Team Autonomy**: Small teams own entire services
5. **Faster Deployment**: Deploy services independently

**Disadvantages:**
1. **Complexity**: Distributed systems are inherently complex
2. **Data Consistency**: No ACID transactions across services
3. **Network Latency**: Inter-service communication over network
4. **Operational Overhead**: More services to monitor and manage
5. **Testing Complexity**: End-to-end testing is challenging

### When to Use Each?

**Use Monolith When:**
- Small team (< 10 developers)
- Simple domain with limited complexity
- Uncertain product-market fit (need to pivot quickly)
- Limited operational expertise
- Performance is critical (low latency requirements)
- **Examples**: MVPs, startups, internal tools, simple CRUD applications

**Use Microservices When:**
- Large team (multiple teams)
- Complex domain requiring modularity
- Different scalability requirements per component
- Need for technology diversity
- Rapid, independent deployments required
- **Examples**: Netflix, Amazon, Uber, large e-commerce platforms

### The Middle Ground: Modular Monolith
- Single deployment unit with well-defined module boundaries
- Can evolve into microservices later
- Best for medium-sized teams
- **Example**: Shopify started this way

---

## 🏗️ Topic 2: Service Boundaries & Domain-Driven Design (DDD)

### What is Domain-Driven Design?

DDD is an approach to software development that focuses on understanding the business domain and modeling software around it.

### Core DDD Concepts

#### 1. **Ubiquitous Language**
- Common vocabulary shared between developers and domain experts
- Same terms used in code, documentation, and conversations
- **Example**: In e-commerce, "Order" means the same thing to developers and business people

#### 2. **Bounded Context**
- Explicit boundary within which a domain model is valid
- Same entity can have different meanings in different contexts
- **Example**: 
  - "Customer" in Sales context: name, contact, order history
  - "Customer" in Shipping context: delivery address, shipping preferences
  - "Customer" in Support context: tickets, interaction history

#### 3. **Aggregates**
- Cluster of domain objects treated as a single unit
- Has a root entity (Aggregate Root) that enforces invariants
- **Example**: Order Aggregate
  ```
  Order (root)
  ├── OrderItems
  ├── ShippingAddress
  └── PaymentInfo
  ```

#### 4. **Entities vs Value Objects**
- **Entity**: Has identity that persists over time (User, Order)
- **Value Object**: Defined by its attributes, no identity (Money, Address)

### Identifying Service Boundaries

#### Strategic Design Patterns

**1. Subdomain Analysis**
```
E-commerce Domain
├── Core Subdomain (competitive advantage)
│   └── Product Catalog, Recommendations
├── Supporting Subdomain
│   └── Inventory, Shipping
└── Generic Subdomain
    └── Authentication, Notifications
```

**2. Context Mapping**
Define relationships between bounded contexts:
- **Shared Kernel**: Shared code between contexts
- **Customer-Supplier**: Downstream depends on upstream
- **Conformist**: Downstream conforms to upstream model
- **Anti-Corruption Layer**: Translation layer to protect from external changes

#### Service Boundary Identification Rules

**Rule 1: One Bounded Context = One Microservice** (starting point)

**Rule 2: High Cohesion, Low Coupling**
- Services should do one thing well
- Minimize dependencies between services

**Rule 3: Data Ownership**
- Each service owns its data exclusively
- No shared databases between services

**Rule 4: Independent Deployment**
- Service should be deployable without coordinating with others

**Rule 5: Team Alignment**
- Service boundary aligns with team ownership

### Practical Example: E-commerce System

```
Bounded Contexts → Microservices:

1. Product Catalog Service
   - Manages products, categories, attributes
   - Data: products, categories, inventory_count

2. Order Management Service
   - Handles order lifecycle
   - Data: orders, order_items, order_status

3. Payment Service
   - Processes payments
   - Data: payment_methods, transactions, refunds

4. User Service
   - User authentication and profiles
   - Data: users, credentials, preferences

5. Notification Service
   - Sends emails, SMS, push notifications
   - Data: notification_templates, notification_logs

6. Shipping Service
   - Manages shipping and tracking
   - Data: shipments, carriers, tracking_info
```

### Common Mistakes in Service Boundaries

**Mistake 1: Too Fine-Grained (Nano-services)**
```
❌ Bad: Separate services for:
- CreateOrderService
- UpdateOrderService
- DeleteOrderService

✅ Good: Single OrderService handling all order operations
```

**Mistake 2: Shared Database**
```
❌ Bad: Multiple services accessing same database tables
✅ Good: Each service has its own database
```

**Mistake 3: Chatty Communication**
```
❌ Bad: UI calls 10 services to render one page
✅ Good: Use API Gateway or Backend-for-Frontend pattern
```

---

## 🏗️ Topic 3: Inter-Service Communication

### Communication Patterns

#### 1. **Synchronous Communication**

**REST (Representational State Transfer)**

**Characteristics:**
- Request-response model
- HTTP-based
- Stateless
- Human-readable (JSON/XML)

**When to Use:**
- External APIs
- Request-response workflows
- Simple CRUD operations

**Pros:**
- Simple, well-understood
- Great tooling and ecosystem
- Cacheable responses
- Firewall-friendly

**Cons:**
- Slower than binary protocols
- Tight coupling between services
- Cascading failures

**Example:**
```javascript
// Product Service API
GET /products/{id}
POST /products
PUT /products/{id}
DELETE /products/{id}

// Order Service calling Product Service
const product = await fetch('http://product-service/products/123')
  .then(res => res.json());
```

**gRPC (Google Remote Procedure Call)**

**Characteristics:**
- Binary protocol (Protocol Buffers)
- HTTP/2 based
- Strongly typed
- Bi-directional streaming

**When to Use:**
- Internal service communication
- High-performance requirements
- Polyglot environments
- Real-time streaming

**Pros:**
- 7-10x faster than REST
- Strong typing with code generation
- Streaming support
- Efficient bandwidth usage

**Cons:**
- Not human-readable
- Browser support limited
- Steeper learning curve

**Example:**
```protobuf
// product.proto
service ProductService {
  rpc GetProduct(ProductRequest) returns (ProductResponse);
  rpc ListProducts(ListRequest) returns (stream ProductResponse);
}

message ProductRequest {
  string product_id = 1;
}

message ProductResponse {
  string id = 1;
  string name = 2;
  double price = 3;
}
```

```javascript
// Node.js gRPC client
const client = new ProductServiceClient('localhost:50051');
client.getProduct({ product_id: '123' }, (err, response) => {
  console.log(response.name);
});
```

#### 2. **Asynchronous Communication**

**Message Queue (Point-to-Point)**

**Characteristics:**
- Each message consumed by one consumer
- Guaranteed delivery
- Order preservation (usually)

**Technologies:** RabbitMQ, Amazon SQS, Azure Service Bus

**When to Use:**
- Task distribution
- Load leveling
- Decoupling services

**Example:**
```javascript
// Order Service publishes to queue
await queue.send('order-processing-queue', {
  orderId: '123',
  items: [...],
  timestamp: Date.now()
});

// Payment Service consumes from queue
queue.subscribe('order-processing-queue', async (message) => {
  await processPayment(message.orderId);
});
```

**Pub/Sub (Event Streaming)**

**Characteristics:**
- Multiple subscribers per message
- Event-driven
- Temporal decoupling

**Technologies:** Apache Kafka, AWS SNS/EventBridge, Google Pub/Sub

**When to Use:**
- Event broadcasting
- Data pipeline
- Event sourcing

**Example:**
```javascript
// Order Service publishes event
await eventBus.publish('order.created', {
  orderId: '123',
  customerId: 'cust-456',
  total: 99.99
});

// Multiple services subscribe
// Inventory Service
eventBus.subscribe('order.created', async (event) => {
  await reserveInventory(event.orderId);
});

// Notification Service
eventBus.subscribe('order.created', async (event) => {
  await sendOrderConfirmation(event.customerId);
});

// Analytics Service
eventBus.subscribe('order.created', async (event) => {
  await trackOrderMetrics(event);
});
```

### Comparison Table

| Aspect | REST | gRPC | Message Queue | Pub/Sub |
|--------|------|------|---------------|---------|
| **Coupling** | Tight | Tight | Loose | Loose |
| **Performance** | Medium | High | Medium | Medium |
| **Reliability** | Low (no retry) | Low (no retry) | High | High |
| **Latency** | Low | Very Low | Variable | Variable |
| **Use Case** | External APIs | Internal APIs | Task processing | Event broadcasting |

---

## 🏗️ Topic 4: Service Discovery

### The Problem
In microservices, services need to find and communicate with each other. With dynamic scaling, IP addresses and ports change frequently.

### Service Discovery Patterns

#### 1. **Client-Side Discovery**

**How it works:**
- Client queries service registry
- Client selects instance (load balancing)
- Client calls service directly

**Example: Netflix Eureka**
```javascript
// Service Registration
const eureka = new Eureka({
  instance: {
    app: 'order-service',
    hostName: 'localhost',
    port: 3000,
  },
  eureka: {
    host: 'eureka-server',
    port: 8761,
  }
});

eureka.start();

// Service Discovery
const instances = eureka.getInstancesByAppId('PRODUCT-SERVICE');
const instance = loadBalancer.selectInstance(instances);
const response = await fetch(`http://${instance.hostName}:${instance.port}/products`);
```

**Pros:**
- Client has full control over load balancing
- No additional network hop

**Cons:**
- Coupling with discovery logic
- Client must implement load balancing

#### 2. **Server-Side Discovery**

**How it works:**
- Client calls load balancer
- Load balancer queries service registry
- Load balancer forwards request

**Example: Consul with HAProxy**
```javascript
// Service Registration with Consul
const consul = require('consul')();

await consul.agent.service.register({
  name: 'order-service',
  port: 3000,
  check: {
    http: 'http://localhost:3000/health',
    interval: '10s'
  }
});

// Client just calls load balancer
const response = await fetch('http://load-balancer/order-service/orders');
```

**Pros:**
- Simpler clients
- Centralized load balancing logic

**Cons:**
- Additional network hop
- Load balancer is single point of failure

### Popular Service Discovery Tools

#### **Consul (HashiCorp)**

**Features:**
- Service registry with health checking
- Key-value store
- Multi-datacenter support
- DNS interface

**Architecture:**
```
┌─────────────┐
│   Service   │──registers──▶┌─────────────┐
│  Instance   │◀──discovers──│   Consul    │
└─────────────┘              │   Server    │
                             └─────────────┘
                                    │
                             ┌──────┴──────┐
                             │   Consul    │
                             │   Agent     │
                             └─────────────┘
```

**Health Checks:**
```javascript
{
  name: 'order-service',
  check: {
    http: 'http://localhost:3000/health',
    interval: '10s',
    timeout: '2s',
    deregisterCriticalServiceAfter: '1m'
  }
}
```

#### **Eureka (Netflix OSS)**

**Features:**
- AP system (Availability over Consistency)
- Self-preservation mode
- Client-side caching

**Configuration:**
```yaml
eureka:
  client:
    serviceUrl:
      defaultZone: http://eureka-server:8761/eureka/
  instance:
    leaseRenewalIntervalInSeconds: 30
    leaseExpirationDurationInSeconds: 90
```

#### **Kubernetes Service Discovery**

**Built-in DNS:**
```yaml
apiVersion: v1
kind: Service
metadata:
  name: order-service
spec:
  selector:
    app: order
  ports:
    - port: 80
      targetPort: 3000
```

**Access via DNS:**
```javascript
// Within cluster
const response = await fetch('http://order-service/orders');

// Across namespaces
const response = await fetch('http://order-service.production.svc.cluster.local/orders');
```

### Health Checks

#### Types of Health Checks

**1. Liveness Check**
- Is the service alive?
- Used to restart crashed services

```javascript
app.get('/health/liveness', (req, res) => {
  res.status(200).send('OK');
});
```

**2. Readiness Check**
- Is the service ready to accept traffic?
- Used to remove from load balancer

```javascript
app.get('/health/readiness', async (req, res) => {
  const dbConnected = await checkDatabaseConnection();
  const cacheConnected = await checkCacheConnection();
  
  if (dbConnected && cacheConnected) {
    res.status(200).send('Ready');
  } else {
    res.status(503).send('Not Ready');
  }
});
```

**3. Deep Health Check**
- Detailed status of all dependencies
- Used for monitoring

```javascript
app.get('/health/detailed', async (req, res) => {
  const health = {
    status: 'UP',
    checks: {
      database: await checkDatabase(),
      cache: await checkCache(),
      messageQueue: await checkQueue(),
      externalAPI: await checkExternalAPI()
    },
    timestamp: new Date().toISOString()
  };
  
  const allHealthy = Object.values(health.checks)
    .every(check => check.status === 'UP');
  
  res.status(allHealthy ? 200 : 503).json(health);
});
```

---

## 🏗️ Topic 5: API Gateway Pattern

### What is an API Gateway?

An API Gateway is a server that acts as a single entry point for all clients. It sits between clients and microservices, handling:
- Request routing
- Authentication/Authorization
- Rate limiting
- Response aggregation
- Protocol translation

### Architecture

```
┌──────────┐
│  Mobile  │───┐
└──────────┘   │
               │    ┌─────────────────┐      ┌─────────────┐
┌──────────┐   ├───▶│   API Gateway   │─────▶│   Service   │
│   Web    │───┤    │  (Single Entry) │      │   Mesh      │
└──────────┘   │    └─────────────────┘      └─────────────┘
               │            │                        │
┌──────────┐   │            │                   ┌────┴────┐
│  Partner │───┘            │                   │ Service │
└──────────┘                │                   │Discovery│
                            ▼                   └─────────┘
                     ┌──────────────┐
                     │  Analytics   │
                     │   Logging    │
                     └──────────────┘
```

### Core Responsibilities

#### 1. **Request Routing**

Route requests to appropriate microservices based on:
- URL path
- HTTP method
- Headers
- Query parameters

**Example:**
```javascript
// Kong/Express Gateway configuration
const routes = {
  '/api/products/*': 'product-service:3001',
  '/api/orders/*': 'order-service:3002',
  '/api/users/*': 'user-service:3003',
  '/api/payments/*': 'payment-service:3004'
};

app.use('/api/*', (req, res) => {
  const targetService = findServiceForPath(req.path);
  proxyRequest(req, res, targetService);
});
```

#### 2. **Authentication & Authorization**

**JWT Validation:**
```javascript
async function authenticateRequest(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    // Check permissions
    if (!hasPermission(decoded.role, req.path, req.method)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.use('/api/*', authenticateRequest);
```

#### 3. **Rate Limiting**

**Token Bucket Algorithm:**
```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

const limiter = rateLimit({
  store: new RedisStore({
    client: redisClient
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // max 100 requests per window
  keyGenerator: (req) => req.user.id, // per user
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: req.rateLimit.resetTime
    });
  }
});

app.use('/api/*', limiter);
```

**Tiered Rate Limiting:**
```javascript
const rateLimits = {
  free: { requests: 100, window: '15m' },
  basic: { requests: 1000, window: '15m' },
  premium: { requests: 10000, window: '15m' }
};

function getRateLimiter(tier) {
  const limit = rateLimits[tier];
  return rateLimit({
    windowMs: ms(limit.window),
    max: limit.requests,
    keyGenerator: (req) => `${tier}:${req.user.id}`
  });
}

app.use('/api/*', (req, res, next) => {
  const userTier = req.user.subscriptionTier;
  getRateLimiter(userTier)(req, res, next);
});
```

#### 4. **Response Aggregation**

**Problem:** Mobile app needs data from multiple services

**Solution:** Gateway aggregates responses

```javascript
// Without Gateway: Client makes 4 calls
const user = await fetch('/api/users/123');
const orders = await fetch('/api/orders?userId=123');
const recommendations = await fetch('/api/recommendations/123');
const cart = await fetch('/api/cart/123');

// With Gateway: Client makes 1 call
app.get('/api/users/:id/dashboard', async (req, res) => {
  const userId = req.params.id;
  
  const [user, orders, recommendations, cart] = await Promise.all([
    fetch(`http://user-service/users/${userId}`),
    fetch(`http://order-service/orders?userId=${userId}`),
    fetch(`http://recommendation-service/recommendations/${userId}`),
    fetch(`http://cart-service/cart/${userId}`)
  ]);
  
  res.json({
    user: await user.json(),
    recentOrders: await orders.json(),
    recommendations: await recommendations.json(),
    cart: await cart.json()
  });
});
```

#### 5. **Protocol Translation**

```javascript
// REST to gRPC translation
app.get('/api/products/:id', async (req, res) => {
  const grpcClient = new ProductServiceClient('product-service:50051');
  
  grpcClient.getProduct({ id: req.params.id }, (err, response) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(response);
  });
});
```

### Advanced Patterns

#### **Backend for Frontend (BFF)**

Different gateways for different client types:

```
┌──────────┐        ┌─────────────┐
│  Mobile  │───────▶│ Mobile BFF  │───┐
└──────────┘        └─────────────┘   │
                                      │    ┌─────────────┐
┌──────────┐        ┌─────────────┐   ├───▶│  Services   │
│   Web    │───────▶│  Web BFF    │───┤    └─────────────┘
└──────────┘        └─────────────┘   │
                                      │
┌──────────┐        ┌─────────────┐   │
│  Partner │───────▶│ Partner BFF │───┘
└──────────┘        └─────────────┘
```

**Why?**
- Different clients need different data shapes
- Mobile needs optimized, smaller payloads
- Web can handle more detailed responses
- Partner API has different auth requirements

#### **Circuit Breaker in Gateway**

```javascript
const CircuitBreaker = require('opossum');

const options = {
  timeout: 3000, // 3 seconds
  errorThresholdPercentage: 50,
  resetTimeout: 30000 // 30 seconds
};

const breaker = new CircuitBreaker(async (serviceUrl) => {
  return fetch(serviceUrl);
}, options);

breaker.fallback(() => ({
  status: 'degraded',
  message: 'Service temporarily unavailable',
  cached: true
}));

app.get('/api/products/:id', async (req, res) => {
  try {
    const response = await breaker.fire(`http://product-service/products/${req.params.id}`);
    res.json(await response.json());
  } catch (error) {
    const fallback = breaker.fallback();
    res.status(503).json(fallback);
  }
});
```

### Popular API Gateway Tools

#### 1. **Kong**
- Plugin-based architecture
- Built on Nginx
- Extensive ecosystem

```yaml
# Kong route configuration
routes:
  - name: product-route
    paths:
      - /products
    service: product-service
    plugins:
      - name: rate-limiting
        config:
          minute: 100
      - name: jwt
```

#### 2. **AWS API Gateway**
- Managed service
- Integrates with Lambda
- Built-in CloudWatch

#### 3. **Zuul (Netflix OSS)**
- Dynamic routing
- Filter-based

#### 4. **Express Gateway / Node.js Custom**
- Full control
- JavaScript ecosystem

---

## 🏗️ Topic 6: Distributed Tracing

### The Problem

In microservices, a single user request might flow through 10+ services:

```
User Request
    └─▶ API Gateway
         └─▶ User Service
              └─▶ Auth Service
         └─▶ Product Service
              └─▶ Inventory Service
              └─▶ Pricing Service
         └─▶ Recommendation Service
              └─▶ ML Service
         └─▶ Cart Service
         └─▶ Order Service
              └─▶ Payment Service
```

**Question:** When a request is slow or fails, which service is the bottleneck?

**Answer:** Distributed tracing

### Core Concepts

#### **Trace**
- Complete journey of a request through all services
- Has unique trace ID

#### **Span**
- Individual unit of work (single service operation)
- Has span ID and parent span ID

#### **Tags & Logs**
- Metadata attached to spans
- Tags: structured key-value pairs
- Logs: timestamped events

### Tracing Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Service A  │───▶│  Service B  │───▶│  Service C  │
│  (span 1)   │    │  (span 2)   │    │  (span 3)   │
└──────┬──────┘    └──────┬──────┘    └──────┬──────┘
       │                  │                  │
       └──────────────────┴──────────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │    Jaeger    │
                   │   Collector  │
                   └──────┬───────┘
                          │
                          ▼
                   ┌──────────────┐
                   │   Storage    │
                   │  (Cassandra) │
                   └──────┬───────┘
                          │
                          ▼
                   ┌──────────────┐
                   │  Jaeger UI   │
                   └──────────────┘
```

### Implementation with Jaeger

#### **Step 1: Initialize Tracer**

```javascript
const { initTracer } = require('jaeger-client');

function initJaegerTracer(serviceName) {
  const config = {
    serviceName: serviceName,
    sampler: {
      type: 'const',
      param: 1, // sample 100% of traces
    },
    reporter: {
      logSpans: true,
      agentHost: 'jaeger-agent',
      agentPort: 6831,
    },
  };
  
  return initTracer(config);
}

const tracer = initJaegerTracer('order-service');
```

#### **Step 2: Create Spans**

```javascript
const opentracing = require('opentracing');

async function createOrder(orderData) {
  // Start root span
  const span = tracer.startSpan('create_order');
  span.setTag('order.id', orderData.id);
  span.setTag('user.id', orderData.userId);
  
  try {
    // Child span for validation
    const validateSpan = tracer.startSpan('validate_order', {
      childOf: span
    });
    await validateOrder(orderData);
    validateSpan.finish();
    
    // Child span for payment
    const paymentSpan = tracer.startSpan('process_payment', {
      childOf: span
    });
    const paymentResult = await processPayment(orderData.paymentInfo);
    paymentSpan.setTag('payment.status', paymentResult.status);
    paymentSpan.finish();
    
    // Child span for inventory
    const inventorySpan = tracer.startSpan('reserve_inventory', {
      childOf: span
    });
    await reserveInventory(orderData.items);
    inventorySpan.finish();
    
    span.setTag('order.status', 'completed');
    span.log({ event: 'order_completed', orderId: orderData.id });
    
  } catch (error) {
    span.setTag('error', true);
    span.log({ event: 'error', message: error.message });
    throw error;
  } finally {
    span.finish();
  }
}
```

#### **Step 3: Propagate Context Across Services**

```javascript
// Service A: Inject trace context into HTTP headers
async function callServiceB(data) {
  const span = tracer.startSpan('call_service_b');
  
  const headers = {};
  tracer.inject(span.context(), opentracing.FORMAT_HTTP_HEADERS, headers);
  
  const response = await fetch('http://service-b/api/process', {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  span.finish();
  return response;
}

// Service B: Extract trace context from headers
app.post('/api/process', (req, res) => {
  const parentSpanContext = tracer.extract(
    opentracing.FORMAT_HTTP_HEADERS,
    req.headers
  );
  
  const span = tracer.startSpan('process_request', {
    childOf: parentSpanContext
  });
  
  // Process request...
  
  span.finish();
  res.json({ status: 'ok' });
});
```

### Trace Analysis

#### **Visualizing Traces in Jaeger UI**

```
Trace: 7f8a9b2c4d5e6f1a (256ms total)
├─ API Gateway: handle_request (256ms)
│  ├─ Auth Service: validate_token (12ms)
│  ├─ Product Service: get_product (45ms)
│  │  └─ Database: query_product (38ms) ← Bottleneck!
│  ├─ Inventory Service: check_stock (8ms)
│  └─ Pricing Service: calculate_price (18ms)
```

#### **Key Metrics from Traces**

1. **Latency Distribution**
```
P50: 120ms
P95: 350ms
P99: 890ms ← 1% of requests are very slow
```

2. **Error Rate**
```
Total Traces: 10,000
Failed Traces: 150
Error Rate: 1.5%
```

3. **Service Dependencies**
```
API Gateway depends on:
├─ Auth Service (100% of traces)
├─ Product Service (95% of traces)
└─ User Service (100% of traces)
```

### Advanced Tracing Patterns

#### **Sampling Strategies**

Sampling is essential to reduce the overhead of tracing and storage costs in high-volume systems.

1. **Constant Sampling**: Sample everything (100% or 0%). Good for low-traffic dev environments.
2. **Probabilistic Sampling**: Sample a percentage (e.g., 1% of requests).
3. **Rate Limiting Sampling**: Specify a maximum number of traces per second.
4. **Adaptive Sampling**: Automatically adjust sampling rate based on traffic patterns and importance.

---

## 🏗️ Topic 7: Service Mesh (Advanced)

### What is a Service Mesh?
A dedicated infrastructure layer for handling service-to-service communication. It uses a **Sidecar Proxy** pattern to remove cross-cutting concerns (retry, timeout, mTLS) from the application code.

**Key Components:**
1. **Data Plane**: Local proxies (e.g., Envoy) that intercept all traffic.
2. **Control Plane**: Manages and configures the proxies (e.g., Istio, Linkerd).

### Why use a Service Mesh?
- **Observability**: Automatic tracing and logging without code changes.
- **Security**: mTLS (mutual TLS) between all services by default.
- **Traffic Control**: A/B testing, Canary deployments, Fault injection.
- **Resilience**: Retries, timeouts, and circuit breaking handled by the proxy.

---

## 🚀 Module 3.1 Practice: Hands-on Exercises

### 🧠 Practice 1: 5 Case Studies (Breaking the Monolith)

| Case Study | Business Problem | Strategy | Proposed Microservices |
| :--- | :--- | :--- | :--- |
| **1. Legacy Retail** | Huge Java app, slow deployments, scaling issues during Black Friday. | **Strangler Fig Pattern**: Gradually replace modules with services. | Product, Inventory, Order, Customer, Payment. |
| **2. Ride-Sharing** | Tightly coupled matching and payment logic leading to driver payment delays. | **Domain Extraction**: Isolate the high-load "Matching" logic. | Trip-Management, Dispatcher, Billing, Rider-Profile. |
| **3. Content Platform** | Video processing blocks the UI and metadata updates. | **Vertical Slice**: Split by feature area. | Video-Service, User-Feed, Search, Ads-Engine. |
| **4. FinTech App** | Compliance requires strict isolation of transaction data. | **Database Splitting**: First split the DB, then the code. | Ledger-Service, User-KYC, Wallet-Service, Reporting. |
| **5. E-learning** | Different teams fighting over the same "Course" entity. | **Bounded Context Policy**: Context-specific course models. | Course-Creation, Student-Progress, Assessment, Enrollment. |

### 🛠️ Practice 2: Implement API Gateway in Node.js (Conceptual)

```javascript
// Simple API Gateway with Express and Http-Proxy
const express = require('express');
const httpProxy = require('express-http-proxy');
const app = express();

// 1. Authentication Middleware
const authenticate = (req, res, next) => {
  const token = req.headers['authorization'];
  if (token === 'valid-token') next();
  else res.status(401).send('Unauthorized');
};

// 2. Routing to Microservices
const userServiceProxy = httpProxy('http://user-service:3001');
const productServiceProxy = httpProxy('http://product-service:3002');
const orderServiceProxy = httpProxy('http://order-service:3003');

app.get('/users/*', authenticate, (req, res) => userServiceProxy(req, res));
app.get('/products/*', (req, res) => productServiceProxy(req, res));
app.post('/orders/*', authenticate, (req, res) => orderServiceProxy(req, res));

app.listen(8080, () => console.log('API Gateway running on port 8080'));
```

### 🧠 Practice 3: Design a Service Mesh Architecture
**Challenge:** Design an architecture where the "Payment Service" and "Order Service" use a Service Mesh for secure communication.
**Solution:**
1. Deploy **Envoy Sidecars** next to both services.
2. Configure **Istio Control Plane** to enforce `STRICT` mTLS.
3. Define a `VirtualService` to route 90% of traffic to `v1` and 10% to `v2` (Canary).
4. Monitor traffic via **Kiali** or **Jaeger** (built-in).

---

## ✨ Mnemonics for Module 3.1
**Microservices: SAID**
- **S**mall: Fine-grained responsibilities.
- **A**utonomous: Independent teams and lifecycles.
- **I**ndependent-data: No shared databases.
- **D**istributed: Communicates over the network.

---

## ❓ Interview Q&A (FAANG Level)

**Q1: How do you handle distributed transactions in Microservices?**
*A: Avoid 2PC (Two-Phase Commit) as it causes blocking. Use the **Saga Pattern** with compensating transactions. Or, use **Transactional Outbox** to ensure data and event consistency.*

**Q2: What is the "Strangler Fig Pattern"?**
*A: A migration strategy where a legacy monolithic system is gradually replaced by microservices. New features are built as services, and old features are migrated one by one until the monolith is "strangled" and removed.*

**Q3: When should you NOT use Microservices?**
*A: When the team is small (overhead > benefit), when the domain is simple, or when very low latency is required (network hops kill performance). Start with a modular monolith.*

---

# MODULE 3.2: EVENT-DRIVEN ARCHITECTURE (EDA)

## 📚 Foundation Concepts

### What is Event-Driven Architecture?
EDA is a design pattern where services communicate by producing and consuming events. Unlike request-response (Active), EDA is **Reactive**.

**Event**: A significant change in state (e.g., `OrderPlaced`, `UserRegistered`).
**Emitter**: Service that detects and sends the event.
**Consumer**: Service that reacts to the event.

---

## 🏗️ Topic 1: Event Sourcing Pattern

### Concept
Instead of storing the *current state* of an entity, you store the *chronological sequence* of all changes (events) that happened to it.

**Traditional (State-based):**
- Table `Accounts` → `balance: 500`

**Event Sourcing:**
- `Event 1`: AccountOpened (balance: 0)
- `Event 2`: MoneyDeposited (amount: 1000)
- `Event 3`: MoneyWithdrawn (amount: 500)
- Current State = Sum(Events)

### Implementation Example (Bank Account)

```javascript
class BankAccount {
  constructor(id) {
    this.id = id;
    this.balance = 0;
    this.events = []; // The "Source of Truth"
  }

  // Command handlers
  apply(event) {
    switch (event.type) {
      case 'DEPOSITED':
        this.balance += event.amount;
        break;
      case 'WITHDRAWN':
        this.balance -= event.amount;
        break;
    }
    this.events.push(event);
  }

  // Replaying events to restore state
  static reload(id, historicalEvents) {
    const account = new BankAccount(id);
    historicalEvents.forEach(e => account.apply(e));
    return account;
  }
}
```

**Pros:**
1. **Audit Log**: Perfect history of every change.
2. **Time Travel**: You can reconstruct state at any point in history.
3. **Immutability**: Events never change; append-only storage is fast.

**Cons:**
1. **Complexity**: Restoring state takes time (mitigated by snapshots).
2. **Side Effects**: Replaying events shouldn't re-trigger external actions (emails, payments).

---

## 🏗️ Topic 2: CQRS (Command Query Responsibility Segregation)

### Concept
Split the data model into two:
1. **Command Side**: Handles Writes (Updates, Deletes). Optimized for transactions.
2. **Query Side**: Handles Reads. Optimized for performance and complex joins.

### Architecture
```
User Request
  │
  ├─▶ Command API ─▶ Write DB (MySQL/SQL) ──┐
  │                                         │ (Sync/Async)
  └─▶ Query API   ◀─ Read DB (Elastic/Redis) ┘ (Projection)
```

### Why use CQRS?
- **Independent Scaling**: Read traffic is usually 10x write traffic.
- **Performance**: High-speed searches in Read DB without affecting Write DB.
- **Complex Projections**: Easily generate specialized views (e.g., analytics dashboard).

---

## 🏗️ Topic 3: Saga Pattern for Distributed Transactions

### The Problem
If a transaction spans multiple microservices (Order → Inventory → Payment), how do you ensure data consistency without `BEGIN/COMMIT`?

### The Solution: Saga
A sequence of local transactions. If one fail, the Saga executes **Compensating Transactions** to undo the previous steps.

#### **1. Choreography (Event-based)**
Services exchange events without a central conductor.
- Order Service emits `OrderCreated`.
- Inventory Service listens, reserves, and emits `InventoryReserved`.
- Payment Service listens, pays, and emits `OrderPaid`.

#### **2. Orchestration (Command-based)**
A central "Saga Manager" directs the flow.
- Manager tells Inventory: "Reserve items".
- Manager tells Payment: "Collect money".
- If Payment fails, Manager tells Inventory: "Release items".

### Comparison

| Aspect | Choreography | Orchestration |
| :--- | :--- | :--- |
| **Coupling** | Looser | Tighter (on manager) |
| **Complexity** | High (hard to track) | Medium (central flow) |
| **Good for** | Simple workflows | Complex workflows |

---

## 🏗️ Topic 4: Event Streaming vs Messaging

### Messaging (Queue)
- **Tool**: RabbitMQ, SQS.
- **Nature**: Transient. Message is deleted after consumption.
- **Use Case**: Task processing, order emails.

### Streaming (Log)
- **Tool**: Kafka, Kinesis.
- **Nature**: Persistent. Events stay in the log for days/months.
- **Use Case**: Real-time analytics, user tracking, event sourcing.

---

## 🏗️ Topic 5: Handling Event Ordering & Consistency

### Ordering Challenges
In distributed systems, Event A might reach the consumer *after* Event B.
**Solution:**
- **Sequence IDs**: Assign monotonic IDs.
- **Kafka Partitions**: Events with the same key (e.g., `userId`) always go to the same partition, ensuring order.

### Eventual Consistency
Data will be consistent "eventually," but there is a lag.
**User Experience Tips:**
- **Optimistic UI**: Update the UI immediately, show an error later if it fails.
- **Polling**: Client polls the API until the state update is visible.

---

## 🚀 Module 3.2 Practice: Hands-on Exercises

### 🧠 Practice 1: Design Order Processing with Saga
**Workflow:** Order → Points → Shipping.
1. `PointsDeducted` → `ShippingRequested`.
2. If Shipping fails → `RefundPoints` → `CancelOrder`.
**Task:** Draw the flow chart for Orchestration mode.

### 🛠️ Practice 2: Implement CQRS for Analytics
**Scenario:** An e-commerce system needs to show "Top 10 Selling Products" every hour.
**Solution:**
1. Write DB: MySQL `orders` table.
2. Send `OrderPlaced` event to Kafka.
3. Consumer updates Redis `ZSET` (Ranking) in real-time.
4. UI queries Redis directly.

---

## ✨ Mnemonics for Module 3.2
**Saga Pattern: CEC**
- **C**horeography: Events drive the flow.
- **E**xplicit Orchestration: A manager drives the flow.
- **C**ompensating transactions: Rollback mechanism.

---

## ❓ Interview Q&A (Advanced EDA)

**Q1: How do you handle idempotency in Event-driven systems?**
*A: A consumer might receive the same event twice (At-least-once delivery). Maintain a `ProcessedEvents` table with the `EventID`. Before processing, check if the ID exists. If yes, skip.*

**Q2: What is "Outbox Pattern"?**
*A: To avoid atomicity issues (DB update succeeds, but event publishing fails), you write the event into an `Outbox` table within the same DB transaction. A separate process then reads from the `Outbox` and publishes to Kafka.*

**Q3: Describe CQRS vs Read Replicas.**
*A: Read replicas are copies of the same DB schema. CQRS allows the Read DB to have a completely different schema (e.g., SQL to Elasticsearch) optimized for specific queries.*

---

# MODULE 3.3: API DESIGN PATTERNS

## 📚 Foundation Concepts

### What is a RESTful API?
REST (Representational State Transfer) is an architectural style that uses HTTP methods to perform CRUD operations on resources identified by URIs.

---

## 🏗️ Topic 1: RESTful Best Practices

### 1. Versioning
Avoid breaking changes for clients.
- **URL Versioning**: `/v1/users`, `/v2/users` (Most common).
- **Header Versioning**: `Accept: application/vnd.company.v1+json`.

### 2. Pagination
Essential for performance when returning large lists.
- **Offset-based**: `/users?offset=20&limit=10`. (Simple but slow for large offsets).
- **Cursor-based**: `/users?cursor=xyz&limit=10`. (Faster, consistent, recommended for infinite scroll).

### 3. Filtering, Sorting, Searching
- `GET /products?color=red&sort=price_desc&q=iphone`

### 4. Error Handling
Use standard HTTP status codes:
- `200 OK`, `201 Created`, `204 No Content`.
- `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`.
- `429 Too Many Requests` (Rate limit).
- `500 Internal Server Error`, `503 Service Unavailable`.

---

## 🏗️ Topic 2: GraphQL vs REST vs gRPC

| Feature | REST | GraphQL | gRPC |
| :--- | :--- | :--- | :--- |
| **Payload** | JSON/XML | JSON | Protobuf (Binary) |
| **Fetching** | Over-fetching common | Exact data (No over-fetching) | Extremely fast |
| **Contract** | Loose (OpenAPI) | Strong (Schema) | Strong (Proto file) |
| **Streaming** | No | Subscriptions | Bi-directional streaming |
| **Best For** | Public APIs, Simple CRUD | Complex UI data requirements | Internal microservices |

---

## 🏗️ Topic 3: API Versioning Strategies

1. **URL Path**: `api.example.com/v1/resource`. Simple, easy to cache.
2. **Query Param**: `api.example.com/resource?version=1`. Less common.
3. **Accept Header**: `Accept: version=1.0`. Clean URLs, but harder for browser testing.

---

## 🏗️ Topic 4: Rate Limiting & Throttling

### Algorithms
1. **Fixed Window**: 100 requests every 1-minute window. (Spikes at window edges).
2. **Sliding Window**: Smooths out spikes by checking the last 60 seconds relative to the request.
3. **Token Bucket**: Constant flow of tokens, bucket stores excess capacity for bursts.
4. **Leaky Bucket**: Requests processed at a fixed rate, excess is dropped or queued.

---

## 🏗️ Topic 5: Idempotency in APIs

### Why?
Ensures that making the same request multiple times doesn't cause side effects (e.g., charging a customer twice).

### Implementation
1. Client sends an `Idempotency-Key` (UUID) in the header.
2. Server stores the key and the response in Redis for a short duration (e.g., 24h).
3. If the key exists, return the cached response without re-processing.

---

## 🚀 Module 3.3 Practice: Hands-on Exercises

### 🧠 Practice 1: Design RESTful API for 10 Resources
**Scenario:** A Social Media Platform.
- Resources: `Users`, `Posts`, `Comments`, `Likes`, `Friends`, `Messages`, `Notifications`, `Profiles`, `Stories`, `Ads`.
- **Task:** Write the endpoints for `Comments` and `Likes` following REST principles.

### 🛠️ Practice 2: Implement Pagination, Filtering, Sorting
```javascript
// Example Node.js/Express logic
app.get('/api/products', (req, res) => {
  const { page = 1, limit = 10, sort = 'id', color } = req.query;
  const offset = (page - 1) * limit;
  
  // SQL Query:
  // SELECT * FROM products 
  // WHERE color = ? 
  // ORDER BY ? 
  // LIMIT ? OFFSET ?
});
```

---

## ✨ Mnemonics for Module 3.3
**REST Maturity: LRUL**
- **L**evel 0: POX (Plain Old XML) / One URI.
- **R**esources (Level 1): Multiple URIs.
- **U**niform Interface (Level 2): HTTP verbs (GET, POST).
- **L**inks (Level 3): HATEOAS (Hypermedia as the Engine of Application State).

---

## ❓ Interview Q&A (API Design)

**Q1: What is HATEOAS?**
*A: Hypermedia As The Engine Of Application State. The API response contains links to other related resources, allowing the client to discover the API dynamically.*

**Q2: How do you handle "The N+1 Problem" in APIs?**
*A: In REST, use `joins` in the DB or `/resource?include=comments`. In GraphQL, use **DataLoader** (Batching and Caching) to fetch data efficiently.*

**Q3: When would you use gRPC over REST?**
*A: For internal microservices where performance is critical, when you need strictly typed contracts (Protobuf), or when bi-directional streaming is required.*

---

# MODULE 3.4: AUTHENTICATION & AUTHORIZATION

## 📚 Foundation Concepts

### Authentication (AuthN)
Verifying **who** a user is (e.g., Login).

### Authorization (AuthZ)
Verifying **what** a user can do (e.g., Permissions).

---

## 🏗️ Topic 1: Session-based vs Token-based Auth

### Session-based (Stateful)
1. User logs in.
2. Server creates a session in memory/DB and returns a `session_id` in a Cookie.
3. Server must lookup the session for every request.
**Pros**: Easy to revoke sessions.
**Cons**: Hard to scale (needs shared session store like Redis).

### Token-based (Stateless - JWT)
1. User logs in.
2. Server returns a signed **JWT** (JSON Web Token).
3. Client sends JWT in the `Authorization` header.
4. Server validates signature without DB lookup.
**Pros**: Highly scalable.
**Cons**: Hard to scale revoking before expiry.

---

## 🏗️ Topic 2: JWT Structure & Claims

A JWT has three parts: `Header.Payload.Signature`

1. **Header**: Algorithm and Type.
2. **Payload**: User info (**Claims**) like `sub` (user_id), `role`, `exp` (expiry).
3. **Signature**: Verified using a secret key.

---

## 🏗️ Topic 3: OAuth 2.0 Flows

### 1. Authorization Code Flow (Server-side apps)
*The most secure flow.*
- User clicks "Login with Google".
- Google returns a **Code**.
- Backend exchanges Code + ClientSecret for an **Access Token**.

### 2. Client Credentials Flow (Machine-to-Machine)
- Service A sends ID + Secret to Auth Server.
- Auth Server returns Token.

### 3. Implicit Flow (Legacy - SPA)
- *Deprecated*: Token is returned directly in the URL fragment.

---

## 🏗️ Topic 4: Single Sign-On (SSO)
Allows a user to login once and access multiple independent systems (e.g., Google login working for Gmail, YouTube, Drive). Uses protocols like **SAML** or **OIDC** (OpenID Connect).

---

## 🏗️ Topic 5: RBAC vs ABAC

### RBAC (Role-Based Access Control)
Access based on assigned roles (e.g., `Admin`, `Editor`, `Viewer`).
- `if (user.role === 'Admin') ...`

### ABAC (Attribute-Based Access Control)
Access based on attributes (e.g., User department, IP address, Time of day).
- `if (user.dept === 'HR' && resource.owner === user.id) ...`

---

## 🚀 Module 3.4 Practice: Hands-on Exercises

### 🛠️ Practice 1: Implement JWT Authentication in Express
```javascript
const jwt = require('jsonwebtoken');

// 1. Generate Token
const token = jwt.sign({ id: 123, role: 'admin' }, 'secret', { expiresIn: '1h' });

// 2. Middleware to verify
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  jwt.verify(token, 'secret', (err, decoded) => {
    if (err) return res.status(401).send();
    req.user = decoded;
    next();
  });
};
```

---

## ✨ Mnemonics for Module 3.4
**OAuth Flows: AICR**
- **A**uthorization-code: For web servers.
- **I**mplicit: For mobile/browser (legacy).
- **C**lient-credentials: For backend-to-backend.
- **R**esource-owner password: Use credentials directly (rare).

---

## ❓ Interview Q&A (Auth & Security)

**Q1: What are "Refresh Tokens"?**
*A: Short-lived Access Tokens improve security. When it expires, the client uses a long-lived Refresh Token to get a new Access Token without asking the user to login again.*

**Q2: How do you handle JWT Revocation?**
*A: JWTs are stateless, but if you need revocation (e.g., user logs out), you can maintain a "Blacklist" of token IDs in Redis until they expire.*

**Q3: What is "Scope" in OAuth?**
*A: A way to limit an application's access to a user's account. E.g., `read:profile`, `write:tweets`.*

---

# MODULE 3.5: DATA STORAGE PATTERNS

## 📚 Foundation Concepts

### Polyglot Persistence
Using the best database technology for each specific use case within a single system.
- **Transactional Data** → SQL (PostgreSQL/MySQL).
- **Session/Cache** → Redis.
- **Product Search** → Elasticsearch.
- **Social Graph** → Neo4j.

---

## 🏗️ Topic 1: BLOB Storage Patterns

### What is a BLOB?
Binary Large Object (Images, Videos, PDFs).

### Best Practices
- **Never store in SQL**: SQL databases are not optimized for large files.
- **Use Object Storage**: AWS S3, Google Cloud Storage, Azure Blob.
- **Pattern**: Store the file in S3 and the **URL string** in the SQL database.

---

## 🏗️ Topic 2: Time-Series Databases

### Why?
Optimized for data that changes over time (Monitoring metrics, Stock prices, IoT sensor data).
- **Tools**: InfluxDB, Prometheus, TimescaleDB.
- **Key Feature**: High write throughput and efficient data retention policies.

---

## 🏗️ Topic 3: Search Engines (Elasticsearch)

### Architecture
- **Inverted Index**: Maps words to document IDs for lightning-fast full-text search.
- **Sharding**: Distributed search and storage.
- **Near Real-Time**: Data becomes searchable within 1 second of indexing.

---

## 🏗️ Topic 4: Data Lake vs Data Warehouse

| Feature | Data Warehouse | Data Lake |
| :--- | :--- | :--- |
| **Data Type** | Structured (Relational) | Structured, Semi-structured, Unstructured |
| **Schema** | Schema-on-Write | Schema-on-Read |
| **Process** | ETL (Extract, Transform, Load) | ELT (Extract, Load, Transform) |
| **Users** | Business Analysts | Data Scientists |

---

## 🏗️ Topic 5: Hot vs Cold Storage Tiers

- **Hot Storage**: High speed, high cost. For data accessed frequently (active orders).
- **Warm Storage**: Medium speed/cost. For data accessed occasionally (last 3 months history).
- **Cold Storage**: Low speed, very low cost. For archival data (compliance, 7-year records). E.g., AWS S3 Glacier.

---

## 🚀 Module 3.5 Practice: Hands-on Exercises

### 🧠 Practice 1: Choose Storage for 15 Data Types
1. User Profile → SQL
2. Large Videos → S3
3. Friend List → Graph (Neo4j)
4. Order History → SQL
5. Chat Logs → NoSQL (Cassandra)
6. Logging Metrics → InfluxDB
7. Session Tokens → Redis
8. Search Autocomplete → Elasticsearch
9. Product Schema (Flexible) → MongoDB
10. Financial Audit logs → Immutable Log
11. Thumbnail Images → S3 + CDN
12. Ad Click Stream → Kafka + Kinesis
13. User Metadata → Document Store
14. Geographic POIs → PostGIS
15. Real-time Leaderboard → Redis (ZSET)

---

## ✨ Mnemonics for Module 3.5
**Storage Types: RSTB**
- **R**elational: PostgreSQL/MySQL.
- **S**earch: Elasticsearch.
- **T**ime-series: InfluxDB.
- **B**lob: AWS S3.

---

## ❓ Interview Q&A (Storage)

**Q1: What is "Schema-on-Read" vs "Schema-on-Write"?**
*A: Schema-on-Write (SQL) requires you to define a schema before saving data. Schema-on-Read (NoSQL/Data Lake) allows you to save raw data and define the structure when you query it.*

**Q2: How does Elasticsearch's "Inverted Index" work?**
*A: It's like the index at the back of a book. Instead of searching every page for a word, you look at the word "System" and it tells you it's on pages 12, 45, and 89.*

**Q3: When would you use a Graph Database?**
*A: When the relationships between data points are as important as the data themselves (e.g., social networks, recommendation engines, fraud detection).*

---

# Final Summary: Part 3 Mastery Checklist

### Architecture ✅
- [x] Design a Microservices system with API Gateway & Service Mesh.
- [x] Break a monolith into services using DDD.
- [x] Choose between REST, gRPC, and Events for communication.

### Patterns ✅
- [x] Implement Saga for distributed transactions.
- [x] Design systems using CQRS and Event Sourcing.
- [x] Handle event ordering and eventual consistency.

### APIs & Security ✅
- [x] Design production-ready RESTful APIs.
- [x] Implement JWT and OAuth 2.0 flows.
- [x] Secure systems with RBAC and Rate Limiting.

### Storage ✅
- [x] Architect a Polyglot persistence layer.
- [x] Optimize storage with Tiered patterns (Hot/Cold).
- [x] Implement Search and Time-series solutions.

🎉 **Part 3 is now COMPLETE! You've mastered the patterns and architectures that power the world's most scalable systems.**
Next up: **Part 4: High-Level Design Case Studies (The Real-world application).**