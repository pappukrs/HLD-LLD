import React, { useState } from 'react';
import { ChevronDown, ChevronRight, BookOpen, Code, Brain, Target, Zap } from 'lucide-react';

const HLDSyllabus = () => {
  const [expandedParts, setExpandedParts] = useState({});
  const [expandedModules, setExpandedModules] = useState({});

  const togglePart = (partId) => {
    setExpandedParts(prev => ({ ...prev, [partId]: !prev[partId] }));
  };

  const toggleModule = (moduleId) => {
    setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const syllabus = [
    {
      part: 1,
      title: "Foundation & Building Blocks",
      duration: "Week 1-2 (20 hours)",
      level: "Beginner to Intermediate",
      icon: BookOpen,
      color: "bg-blue-500",
      modules: [
        {
          name: "Module 1.1: Core Networking Concepts",
          depth: "Deep",
          topics: [
            "HTTP/HTTPS protocols (methods, status codes, headers)",
            "REST API design principles & best practices",
            "WebSockets vs HTTP (when to use each)",
            "TCP vs UDP (reliability vs speed trade-offs)",
            "DNS resolution & CDN basics",
            "SSL/TLS handshake flow"
          ],
          practice: [
            "Design RESTful APIs for 5 common use cases",
            "Implement WebSocket chat in Node.js",
            "Trace HTTP request lifecycle with diagrams"
          ],
          mnemonics: "HTTP CRUD = Create Read Update Delete Post Get Put Delete"
        },
        {
          name: "Module 1.2: Database Fundamentals",
          depth: "Deep",
          topics: [
            "SQL vs NoSQL: When to use what (decision tree)",
            "ACID properties (with real-world examples)",
            "Database indexing (B-tree, Hash, Composite)",
            "Normalization vs Denormalization (1NF to 3NF)",
            "SQL joins (INNER, LEFT, RIGHT, FULL)",
            "NoSQL types: Document, Key-Value, Column, Graph"
          ],
          practice: [
            "Design schemas for 10 common scenarios",
            "Write complex SQL queries with multiple joins",
            "Analyze query performance with EXPLAIN",
            "Choose database type for 20 use cases"
          ],
          mnemonics: "ACID = Atomicity Consistency Isolation Durability | NoSQL DKCG = Document KeyValue Column Graph"
        },
        {
          name: "Module 1.3: Caching Strategies",
          depth: "Deep",
          topics: [
            "Cache levels (Client, CDN, Application, Database)",
            "Cache patterns: Cache-Aside, Write-Through, Write-Back, Refresh-Ahead",
            "Eviction policies: LRU, LFU, FIFO (implementations)",
            "Cache invalidation strategies (hardest problem!)",
            "Distributed caching (Redis cluster)",
            "Cache stampede prevention"
          ],
          practice: [
            "Implement LRU cache in JavaScript",
            "Design caching layer for e-commerce product catalog",
            "Calculate cache hit ratio for different scenarios"
          ],
          mnemonics: "Cache Patterns: CART = Cache-Aside, Around, Read-through, Refresh-ahead, Thru-write"
        },
        {
          name: "Module 1.4: Load Balancing",
          depth: "Medium",
          topics: [
            "Layer 4 vs Layer 7 load balancing",
            "Algorithms: Round Robin, Least Connections, IP Hash, Weighted",
            "Health checks & failover mechanisms",
            "Session persistence (sticky sessions)",
            "Tools: Nginx, HAProxy, AWS ELB/ALB"
          ],
          practice: [
            "Configure Nginx as load balancer",
            "Choose LB algorithm for 5 scenarios",
            "Design multi-tier load balancing"
          ],
          mnemonics: "LB Algos: RLWI = RoundRobin, LeastConn, Weighted, IPHash"
        },
        {
          name: "Module 1.5: CAP Theorem Deep Dive",
          depth: "Deep",
          topics: [
            "Understanding Consistency, Availability, Partition Tolerance",
            "Real-world CAP choices (CP vs AP systems)",
            "Eventual consistency patterns",
            "Strong consistency vs Eventual consistency",
            "Quorum reads/writes (R + W > N)",
            "Case studies: Cassandra (AP), MongoDB (CP configurable)"
          ],
          practice: [
            "Identify CAP choice for 15 systems",
            "Design system with tunable consistency",
            "Explain trade-offs in interviews"
          ],
          mnemonics: "CAP = Choose Any 2: Consistency Availability Partition-tolerance | Banking=CP, Social=AP"
        }
      ]
    },
    {
      part: 2,
      title: "Scalability & Performance Patterns",
      duration: "Week 3 (15 hours)",
      level: "Intermediate",
      icon: Zap,
      color: "bg-green-500",
      modules: [
        {
          name: "Module 2.1: Horizontal vs Vertical Scaling",
          depth: "Deep",
          topics: [
            "When to scale vertically vs horizontally",
            "Auto-scaling strategies & triggers",
            "Stateless vs Stateful services",
            "Scaling databases (read replicas, sharding)",
            "Scaling limitations & bottlenecks"
          ],
          practice: [
            "Design auto-scaling policy for web app",
            "Migrate stateful to stateless architecture",
            "Calculate scaling costs"
          ],
          mnemonics: "Horizontal = More machines (Better) | Vertical = Bigger machine (Limits)"
        },
        {
          name: "Module 2.2: Database Sharding & Partitioning",
          depth: "Deep",
          topics: [
            "Horizontal partitioning (sharding)",
            "Vertical partitioning (columnar)",
            "Sharding strategies: Range, Hash, Geographic, Directory-based",
            "Consistent hashing (detailed algorithm)",
            "Resharding & rebalancing challenges",
            "Cross-shard queries & joins"
          ],
          practice: [
            "Design sharding key for 10 systems",
            "Implement consistent hashing in JavaScript",
            "Handle hotspots in sharded database"
          ],
          mnemonics: "Sharding: RHGD = Range, Hash, Geographic, Directory | Consistent Hashing prevents resharding all keys"
        },
        {
          name: "Module 2.3: Database Replication",
          depth: "Deep",
          topics: [
            "Master-Slave replication (async, sync, semi-sync)",
            "Master-Master replication (conflict resolution)",
            "Read replicas for scaling reads",
            "Replication lag & consistency issues",
            "Failover & promotion strategies",
            "Multi-region replication"
          ],
          practice: [
            "Design replication topology for global app",
            "Handle replication lag scenarios",
            "Configure PostgreSQL replication"
          ],
          mnemonics: "Replication: 3S = Single-master, Sync/Async, Slave-read-only"
        },
        {
          name: "Module 2.4: Message Queues & Async Processing",
          depth: "Deep",
          topics: [
            "Queue vs Topic (Point-to-Point vs Pub-Sub)",
            "Message ordering guarantees",
            "Exactly-once vs At-least-once delivery",
            "Dead letter queues",
            "Kafka architecture (partitions, consumer groups)",
            "RabbitMQ vs Kafka vs SQS comparison"
          ],
          practice: [
            "Design event-driven architecture with Kafka",
            "Implement retry logic with exponential backoff",
            "Choose queue system for 10 scenarios"
          ],
          mnemonics: "Kafka: PCO = Partitions, Consumer-groups, Offset-tracking"
        },
        {
          name: "Module 2.5: CDN & Edge Computing",
          depth: "Medium",
          topics: [
            "CDN architecture & PoP (Point of Presence)",
            "Cache invalidation at CDN level",
            "Dynamic content delivery",
            "Edge computing use cases",
            "DNS-based routing",
            "Cost optimization strategies"
          ],
          practice: [
            "Configure CloudFront for media streaming",
            "Design CDN strategy for global SaaS",
            "Calculate bandwidth savings"
          ],
          mnemonics: "CDN Benefits: RLD = Reduced latency, Lower bandwidth, DDoS protection"
        }
      ]
    },
    {
      part: 3,
      title: "System Design Patterns & Architectures",
      duration: "Week 4 (15 hours)",
      level: "Intermediate to Advanced",
      icon: Brain,
      color: "bg-purple-500",
      modules: [
        {
          name: "Module 3.1: Microservices Architecture",
          depth: "Deep",
          topics: [
            "Microservices vs Monolith (when to use each)",
            "Service boundaries & domain-driven design",
            "Inter-service communication (REST, gRPC, events)",
            "Service discovery (Consul, Eureka)",
            "API Gateway pattern (authentication, routing, rate limiting)",
            "Distributed tracing (Jaeger, Zipkin)"
          ],
          practice: [
            "Break monolith into microservices (5 case studies)",
            "Design service mesh architecture",
            "Implement API Gateway in Node.js"
          ],
          mnemonics: "Microservices: SAID = Small, Autonomous, Independent-data, Distributed"
        },
        {
          name: "Module 3.2: Event-Driven Architecture",
          depth: "Deep",
          topics: [
            "Event sourcing pattern",
            "CQRS (Command Query Responsibility Segregation)",
            "Saga pattern for distributed transactions",
            "Event streaming vs messaging",
            "Event schema evolution",
            "Eventual consistency handling"
          ],
          practice: [
            "Design order processing with Saga pattern",
            "Implement CQRS for analytics system",
            "Handle event ordering challenges"
          ],
          mnemonics: "Saga Pattern: CEC = Choreography (events) vs Orchestration (coordinator) with Compensating transactions"
        },
        {
          name: "Module 3.3: API Design Patterns",
          depth: "Medium",
          topics: [
            "RESTful API best practices (versioning, pagination)",
            "GraphQL vs REST (when to use each)",
            "gRPC for internal services",
            "API versioning strategies",
            "Rate limiting & throttling",
            "Idempotency in APIs"
          ],
          practice: [
            "Design RESTful API for 10 resources",
            "Implement pagination, filtering, sorting",
            "Create GraphQL schema for complex queries"
          ],
          mnemonics: "REST Maturity: LRUL = Level 0-1-2-3 Richardson, Uniform-interface, Links, HATEOAS"
        },
        {
          name: "Module 3.4: Authentication & Authorization",
          depth: "Medium",
          topics: [
            "Session-based vs Token-based auth",
            "JWT structure & claims",
            "OAuth 2.0 flows (detailed)",
            "Single Sign-On (SSO)",
            "RBAC vs ABAC (Role vs Attribute based)",
            "API key management"
          ],
          practice: [
            "Implement JWT authentication in Express",
            "Design OAuth flow for third-party apps",
            "Create RBAC system for enterprise app"
          ],
          mnemonics: "OAuth Flows: AICR = Authorization-code, Implicit, Client-credentials, Resource-owner"
        },
        {
          name: "Module 3.5: Data Storage Patterns",
          depth: "Deep",
          topics: [
            "Polyglot persistence (multiple databases)",
            "BLOB storage patterns (S3, Azure Blob)",
            "Time-series databases (InfluxDB, TimescaleDB)",
            "Search engines (Elasticsearch architecture)",
            "Data lake vs Data warehouse",
            "Hot vs Cold storage tiers"
          ],
          practice: [
            "Choose storage for 15 data types",
            "Design multi-database architecture",
            "Implement tiered storage strategy"
          ],
          mnemonics: "Storage Types: RSTB = Relational, Search, Time-series, Blob"
        }
      ]
    },
    {
      part: 4,
      title: "Reliability, Resilience & Observability",
      duration: "Week 5 (12 hours)",
      level: "Advanced",
      icon: Target,
      color: "bg-red-500",
      modules: [
        {
          name: "Module 4.1: Reliability Patterns",
          depth: "Deep",
          topics: [
            "Circuit Breaker pattern (states, thresholds)",
            "Retry logic (exponential backoff, jitter)",
            "Bulkhead pattern (resource isolation)",
            "Timeout strategies",
            "Graceful degradation",
            "Chaos engineering principles"
          ],
          practice: [
            "Implement circuit breaker in TypeScript",
            "Design retry strategy for payment service",
            "Create fallback mechanisms for critical flows"
          ],
          mnemonics: "Circuit Breaker: COH = Closed (working), Open (failing), Half-open (testing)"
        },
        {
          name: "Module 4.2: Monitoring & Alerting",
          depth: "Medium",
          topics: [
            "Metrics: RED (Rate, Errors, Duration) & USE (Utilization, Saturation, Errors)",
            "Logging levels & structured logging",
            "Distributed tracing (correlation IDs)",
            "SLI, SLO, SLA definitions & examples",
            "Alert fatigue prevention",
            "Observability vs Monitoring"
          ],
          practice: [
            "Set up Prometheus + Grafana monitoring",
            "Define SLOs for 5 critical services",
            "Implement distributed tracing"
          ],
          mnemonics: "SLI SLO SLA: Indicator < Objective < Agreement | RED USE for metrics"
        },
        {
          name: "Module 4.3: Rate Limiting & Throttling",
          depth: "Deep",
          topics: [
            "Token Bucket algorithm (detailed)",
            "Leaky Bucket algorithm",
            "Fixed Window Counter",
            "Sliding Window Log & Counter",
            "Distributed rate limiting (Redis-based)",
            "Rate limiting per user vs IP vs API"
          ],
          practice: [
            "Implement all 4 algorithms in JavaScript",
            "Design distributed rate limiter with Redis",
            "Choose algorithm for 5 scenarios"
          ],
          mnemonics: "Rate Limit Algos: TLFS = Token-bucket, Leaky-bucket, Fixed-window, Sliding-window"
        },
        {
          name: "Module 4.4: Security Best Practices",
          depth: "Medium",
          topics: [
            "OWASP Top 10 vulnerabilities",
            "SQL injection prevention",
            "XSS & CSRF protection",
            "Encryption at rest & in transit",
            "Secret management (Vault, AWS Secrets)",
            "DDoS protection strategies"
          ],
          practice: [
            "Audit API for security vulnerabilities",
            "Implement input validation & sanitization",
            "Design secure credential storage"
          ],
          mnemonics: "OWASP Top 3: ISA = Injection, Sensitive-data, Authentication-broken"
        },
        {
          name: "Module 4.5: Disaster Recovery & Backups",
          depth: "Medium",
          topics: [
            "RTO vs RPO (Recovery Time/Point Objective)",
            "Backup strategies (full, incremental, differential)",
            "Multi-region failover",
            "Data replication for DR",
            "Testing DR plans",
            "Point-in-time recovery"
          ],
          practice: [
            "Design DR plan for critical system",
            "Calculate RTO/RPO requirements",
            "Implement automated backup system"
          ],
          mnemonics: "RTO RPO: Time to recover vs Point to recover | 3-2-1 Backup: 3 copies, 2 media, 1 offsite"
        }
      ]
    },
    {
      part: 5,
      title: "System Design Problem-Solving Framework",
      duration: "Week 6-7 (25 hours)",
      level: "Interview-Focused",
      icon: Code,
      color: "bg-yellow-500",
      modules: [
        {
          name: "Module 5.1: Interview Framework Mastery",
          depth: "Deep",
          topics: [
            "RADIO framework: Requirements, Architecture, Data, Interface, Optimize",
            "Clarifying questions checklist (functional, non-functional, scale)",
            "Back-of-envelope calculations (QPS, storage, bandwidth)",
            "Drawing clear architecture diagrams",
            "API design in interviews",
            "Database schema design approach"
          ],
          practice: [
            "Practice framework on 30 problems",
            "Mock interviews with peers",
            "Time-boxed problem solving (45 mins)"
          ],
          mnemonics: "Interview Steps: REACD = Requirements, Estimation, API, Components, Deep-dive"
        },
        {
          name: "Module 5.2: Estimation & Capacity Planning",
          depth: "Deep",
          topics: [
            "Traffic estimation (DAU → QPS conversion)",
            "Storage calculations (per record × records)",
            "Bandwidth estimation (request size × QPS)",
            "Memory calculations for caching",
            "Number of servers needed",
            "Cost estimation"
          ],
          practice: [
            "Calculate for 20 different systems",
            "Memorize conversion factors",
            "Quick mental math techniques"
          ],
          mnemonics: "Powers of 2: 2^10=1K, 2^20=1M, 2^30=1B | 1M users ≈ 10 QPS (20% DAU)"
        },
        {
          name: "Module 5.3: Trade-offs & Decision Making",
          depth: "Deep",
          topics: [
            "SQL vs NoSQL decision tree",
            "Sync vs Async processing",
            "Push vs Pull models",
            "Read-heavy vs Write-heavy optimizations",
            "Consistency vs Availability trade-offs",
            "Cost vs Performance balance"
          ],
          practice: [
            "Justify decisions for 25 scenarios",
            "Present multiple solutions with trade-offs",
            "Defend architectural choices"
          ],
          mnemonics: "Trade-off Questions: SCPR = Scale, Consistency, Performance, Resources"
        },
        {
          name: "Module 5.4: Common Patterns Recognition",
          depth: "Deep",
          topics: [
            "Read-heavy systems (Twitter feed, YouTube)",
            "Write-heavy systems (IoT, logging)",
            "Real-time systems (chat, gaming)",
            "Batch processing systems (analytics)",
            "Geospatial systems (Uber, Airbnb)",
            "Search systems (Google, Elasticsearch)"
          ],
          practice: [
            "Identify pattern in 30 problems",
            "Create pattern-to-solution mapping",
            "Mix patterns for complex systems"
          ],
          mnemonics: "System Types: RRBS = Read-heavy, Real-time, Batch, Search-heavy"
        },
        {
          name: "Module 5.5: Communication & Presentation",
          depth: "Medium",
          topics: [
            "Thinking aloud technique",
            "Structuring explanations (top-down)",
            "Handling interviewer hints",
            "Discussing limitations honestly",
            "Time management in interviews",
            "Asking for feedback gracefully"
          ],
          practice: [
            "Record mock interviews",
            "Practice with whiteboard/drawing",
            "Get feedback on communication style"
          ],
          mnemonics: "Communication: CLEAR = Concise, Logical, Engaging, Adaptive, Reflective"
        }
      ]
    },
    {
      part: 6,
      title: "Practice Problems - Easy to Medium",
      duration: "Week 8-9 (30 hours)",
      level: "Application",
      icon: Code,
      color: "bg-indigo-500",
      modules: [
        {
          name: "Module 6.1: URL & Link Management (5 problems)",
          depth: "Deep",
          topics: [
            "URL Shortener (TinyURL) - Complete design",
            "Pastebin - Text storage service",
            "QR Code Generator - Image generation at scale",
            "Link Tracker - Analytics & click tracking",
            "Bookmark Manager - Organized link storage"
          ],
          practice: [
            "Each problem: 3 iterations (basic → scaled → optimized)",
            "Focus on: ID generation, database choice, caching",
            "Base62 encoding implementation"
          ],
          keyTopics: "Raft consensus, Vector clocks, Gossip protocol, 2PC/3PC, Consistency models"
        },
        {
          name: "Module 8.2: Performance Optimization",
          depth: "Deep",
          topics: [
            "Database query optimization (EXPLAIN, indexes)",
            "N+1 query problem & solutions",
            "Connection pooling strategies",
            "Async/await patterns in Node.js",
            "Memory management & garbage collection",
            "Profiling & benchmarking tools"
          ],
          practice: [
            "Optimize slow queries in PostgreSQL",
            "Implement connection pooling",
            "Profile Node.js application",
            "Reduce memory footprint"
          ],
          keyTopics: "Query optimization, Connection pools, Event loop, Profiling"
        },
        {
          name: "Module 8.3: Data Engineering Concepts",
          depth: "Medium",
          topics: [
            "ETL vs ELT pipelines",
            "Batch processing (MapReduce, Spark)",
            "Stream processing (Kafka Streams, Flink)",
            "Data warehousing concepts",
            "OLTP vs OLAP databases",
            "Lambda vs Kappa architecture"
          ],
          practice: [
            "Design data pipeline for analytics",
            "Compare batch vs stream processing",
            "Understand star schema"
          ],
          keyTopics: "ETL, Batch vs Stream, Data warehouse, Lambda architecture"
        },
        {
          name: "Module 8.4: Specialized Topics",
          depth: "Medium",
          topics: [
            "Machine Learning inference at scale",
            "Real-time bidding systems",
            "Blockchain basics for distributed ledger",
            "IoT data ingestion",
            "Graph algorithms for social networks",
            "Time-series optimization"
          ],
          practice: [
            "Design ML model serving infrastructure",
            "Understand ad auction systems",
            "IoT data pipeline design"
          ],
          keyTopics: "ML serving, Real-time bidding, Graph traversal, Time-series DB"
        },
        {
          name: "Module 8.5: Cutting-Edge Patterns",
          depth: "Medium",
          topics: [
            "Serverless architectures (pros/cons)",
            "Edge computing patterns",
            "Multi-tenancy strategies",
            "Zero-downtime deployments (blue-green, canary)",
            "Feature flags & A/B testing infrastructure",
            "Service mesh (Istio, Linkerd)"
          ],
          practice: [
            "Design serverless application",
            "Implement feature flag system",
            "Plan zero-downtime deployment"
          ],
          keyTopics: "FaaS, Multi-tenancy, Blue-green deployment, Service mesh"
        }
      ]
    }
  ];

  const getDifficultyColor = (level) => {
    if (level.includes('Beginner')) return 'text-green-600';
    if (level.includes('Intermediate')) return 'text-yellow-600';
    if (level.includes('Advanced')) return 'text-red-600';
    return 'text-purple-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8 mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">
            🚀 Complete HLD Mastery Program
          </h1>
          <p className="text-lg text-slate-600 mb-4">
            A comprehensive 14-week journey from beginner to expert in High-Level Design
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">175+ Hours</div>
              <div className="text-sm text-slate-600">Total Learning Time</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">60+ Problems</div>
              <div className="text-sm text-slate-600">Practice Systems</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">8 Parts</div>
              <div className="text-sm text-slate-600">Structured Modules</div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {syllabus.map((part) => {
            const Icon = part.icon;
            const isExpanded = expandedParts[part.part];
            
            return (
              <div key={part.part} className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div
                  className={`${part.color} text-white p-6 cursor-pointer hover:opacity-90 transition-opacity`}
                  onClick={() => togglePart(part.part)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Icon className="w-8 h-8" />
                      <div>
                        <h2 className="text-2xl font-bold">
                          Part {part.part}: {part.title}
                        </h2>
                        <div className="flex items-center space-x-4 mt-2 text-sm">
                          <span>⏱️ {part.duration}</span>
                          <span className="bg-white bg-opacity-20 px-3 py-1 rounded">
                            {part.level}
                          </span>
                          <span>{part.modules.length} Modules</span>
                        </div>
                      </div>
                    </div>
                    {isExpanded ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-6 space-y-4">
                    {part.modules.map((module, idx) => {
                      const moduleKey = `${part.part}-${idx}`;
                      const isModuleExpanded = expandedModules[moduleKey];
                      
                      return (
                        <div key={idx} className="border border-slate-200 rounded-lg overflow-hidden">
                          <div
                            className="bg-slate-50 p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                            onClick={() => toggleModule(moduleKey)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h3 className="text-lg font-semibold text-slate-800">
                                  {module.name}
                                </h3>
                                <div className="flex items-center space-x-3 mt-1">
                                  <span className="text-sm text-slate-600">
                                    📊 Depth: <span className="font-medium">{module.depth}</span>
                                  </span>
                                  <span className="text-sm text-slate-600">
                                    📝 {module.topics.length} Topics
                                  </span>
                                </div>
                              </div>
                              {isModuleExpanded ? <ChevronDown className="w-5 h-5 text-slate-600" /> : <ChevronRight className="w-5 h-5 text-slate-600" />}
                            </div>
                          </div>

                          {isModuleExpanded && (
                            <div className="p-6 bg-white space-y-6">
                              <div>
                                <h4 className="font-semibold text-slate-700 mb-3 flex items-center">
                                  <span className="mr-2">📚</span> Topics Covered
                                </h4>
                                <ul className="space-y-2">
                                  {module.topics.map((topic, topicIdx) => (
                                    <li key={topicIdx} className="flex items-start">
                                      <span className="text-blue-500 mr-2">•</span>
                                      <span className="text-slate-700">{topic}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {module.practice && (
                                <div>
                                  <h4 className="font-semibold text-slate-700 mb-3 flex items-center">
                                    <span className="mr-2">💻</span> Practice Activities
                                  </h4>
                                  <ul className="space-y-2">
                                    {module.practice.map((item, practiceIdx) => (
                                      <li key={practiceIdx} className="flex items-start">
                                        <span className="text-green-500 mr-2">✓</span>
                                        <span className="text-slate-700">{item}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {module.mnemonics && (
                                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                                  <h4 className="font-semibold text-yellow-800 mb-2 flex items-center">
                                    <span className="mr-2">🧠</span> Memory Aid
                                  </h4>
                                  <p className="text-yellow-900 font-mono text-sm">{module.mnemonics}</p>
                                </div>
                              )}

                              {module.keyTopics && (
                                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                                  <h4 className="font-semibold text-blue-800 mb-2 flex items-center">
                                    <span className="mr-2">🎯</span> Key Concepts
                                  </h4>
                                  <p className="text-blue-900 text-sm">{module.keyTopics}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-4">🎯 Learning Path Recommendations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">For Interview Prep (8 weeks):</h3>
              <ul className="space-y-1 text-sm">
                <li>• Parts 1-2: Foundation (3 weeks)</li>
                <li>• Part 5: Interview Framework (1 week)</li>
                <li>• Part 6: Easy-Medium Problems (2 weeks)</li>
                <li>• Part 7: 10 Hard Problems (2 weeks)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">For Complete Mastery (14 weeks):</h3>
              <ul className="space-y-1 text-sm">
                <li>• Follow all 8 parts sequentially</li>
                <li>• Complete all practice problems</li>
                <li>• Build 3-5 real projects</li>
                <li>• Participate in mock interviews weekly</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HLDSyllabus;Topics: "Base62, Distributed ID generation, Read-heavy optimization, TTL management"
        },
        {
          name: "Module 6.2: Notification & Communication (5 problems)",
          depth: "Deep",
          topics: [
            "Notification System (Email, SMS, Push)",
            "Rate Limiter - Token bucket & variants",
            "Task Scheduler - Cron-like distributed system",
            "Webhook System - Event delivery to third-parties",
            "Email Service - SMTP handling & queuing"
          ],
          practice: [
            "Priority queue implementation",
            "Retry with exponential backoff",
            "Third-party API integration patterns",
            "Delivery guarantees (at-least-once, exactly-once)"
          ],
          keyTopics: "Message queues, Priority handling, Idempotency, Delivery tracking"
        },
        {
          name: "Module 6.3: Data Processing (4 problems)",
          depth: "Deep",
          topics: [
            "Web Crawler - Distributed crawling",
            "Metrics Monitoring System - Time-series data",
            "Analytics System - Real-time aggregation",
            "Search Autocomplete - Trie-based suggestions"
          ],
          practice: [
            "Bloom filters for deduplication",
            "Trie data structure implementation",
            "Stream processing concepts",
            "Time-series database patterns"
          ],
          keyTopics: "Distributed queue, Robots.txt, Trie, Aggregation windows, Top-K algorithm"
        },
        {
          name: "Module 6.4: Storage Systems (4 problems)",
          depth: "Deep",
          topics: [
            "Key-Value Store - Distributed hash table",
            "Distributed Cache (Redis-like)",
            "Unique ID Generator - Snowflake algorithm",
            "Configuration Service - Distributed config management"
          ],
          practice: [
            "Consistent hashing implementation",
            "Snowflake ID generation",
            "Gossip protocol basics",
            "Leader election algorithms"
          ],
          keyTopics: "Consistent hashing, Replication, Conflict resolution, Version vectors"
        },
        {
          name: "Module 6.5: User-Facing Services (7 problems)",
          depth: "Medium",
          topics: [
            "News Feed (basic version)",
            "Comment System - Nested comments",
            "Like/Voting System - Reddit-style",
            "Leaderboard - Real-time rankings",
            "Poll/Survey System",
            "File Sharing Service - Small files",
            "Image Upload Service - Thumbnail generation"
          ],
          practice: [
            "Fanout patterns (push vs pull)",
            "Aggregation & ranking algorithms",
            "Image processing pipeline",
            "Nested data structures"
          ],
          keyTopics: "Fanout-on-write/read, Redis sorted sets, Async processing, CDN integration"
        }
      ]
    },
    {
      part: 7,
      title: "Practice Problems - Hard & Complex",
      duration: "Week 10-12 (45 hours)",
      level: "Advanced Application",
      icon: Brain,
      color: "bg-pink-500",
      modules: [
        {
          name: "Module 7.1: Social Media Platforms (6 problems)",
          depth: "Very Deep",
          topics: [
            "Twitter/X - Complete system with feed, search, trends",
            "Instagram - Photo/video sharing, stories, filters",
            "Facebook News Feed - Ranking, recommendations",
            "LinkedIn - Professional network, jobs, feed",
            "TikTok - Short videos, For You Page algorithm",
            "Reddit - Subreddits, voting, comments"
          ],
          practice: [
            "Each requires 2-3 days of deep study",
            "Focus on: Feed generation, Search, Recommendations",
            "Scaling to billions of users",
            "Content moderation strategies"
          ],
          keyTopics: "Fanout hybrid approach, ML ranking, Graph database, Real-time updates, Trending algorithms"
        },
        {
          name: "Module 7.2: Media & Streaming (5 problems)",
          depth: "Very Deep",
          topics: [
            "YouTube - Video upload, streaming, recommendations",
            "Netflix - Video streaming, CDN, personalization",
            "Spotify - Music streaming, playlists, recommendations",
            "Twitch - Live streaming, chat",
            "Zoom - Video conferencing, screen sharing"
          ],
          practice: [
            "Video transcoding pipeline",
            "Adaptive bitrate streaming (HLS/DASH)",
            "WebRTC for real-time communication",
            "Recommendation engines",
            "CDN strategies for media"
          ],
          keyTopics: "Transcoding, Manifest files, SFU/MCU servers, Bandwidth optimization, DRM"
        },
        {
          name: "Module 7.3: E-commerce & Marketplace (5 problems)",
          depth: "Very Deep",
          topics: [
            "Amazon E-commerce - Catalog, cart, orders, payments",
            "Uber/Lyft - Ride matching, pricing, tracking",
            "Airbnb - Property search, booking, calendar",
            "Food Delivery (DoorDash) - Restaurant, orders, delivery",
            "Ticket Booking (BookMyShow) - Seats, concurrency, payments"
          ],
          practice: [
            "Geospatial indexing (QuadTree, Geohash)",
            "Inventory management with locks",
            "Dynamic pricing algorithms",
            "Real-time location tracking",
            "Payment processing & idempotency"
          ],
          keyTopics: "Distributed locks, Two-phase commit, Geospatial search, Event sourcing, Saga pattern"
        },
        {
          name: "Module 7.4: Communication & Collaboration (4 problems)",
          depth: "Very Deep",
          topics: [
            "WhatsApp/Messenger - 1-on-1, group chat, media",
            "Slack - Channels, threads, search, integrations",
            "Google Docs - Collaborative editing, CRDT",
            "Email Service (Gmail) - SMTP, storage, search, spam"
          ],
          practice: [
            "WebSocket connection management",
            "Message delivery guarantees",
            "Operational Transform / CRDT for collaboration",
            "Full-text search implementation",
            "Spam detection ML pipeline"
          ],
          keyTopics: "WebSocket scaling, Message queue, CRDT, Elasticsearch, ML classification"
        },
        {
          name: "Module 7.5: Cloud Storage & Sync (3 problems)",
          depth: "Very Deep",
          topics: [
            "Dropbox/Google Drive - Upload, sync, sharing, versioning",
            "Google Photos - Upload, search, face detection, albums",
            "Cloud Storage (S3-like) - Object storage, versioning, replication"
          ],
          practice: [
            "File chunking & deduplication",
            "Delta sync algorithms",
            "Metadata management",
            "Conflict resolution strategies",
            "Multi-part uploads"
          ],
          keyTopics: "Chunking, Merkle trees, Block-level deduplication, Version control, Eventual consistency"
        },
        {
          name: "Module 7.6: Search & Discovery (4 problems)",
          depth: "Very Deep",
          topics: [
            "Google Search - Crawling, indexing, ranking, autocomplete",
            "Typeahead/Autocomplete - Trie-based, learning",
            "Recommendation System - Collaborative filtering, content-based",
            "Trending Topics - Real-time trend detection"
          ],
          practice: [
            "Inverted index implementation",
            "PageRank algorithm",
            "Trie with frequency",
            "Recommendation algorithms",
            "Heavy hitters problem (Count-Min Sketch)"
          ],
          keyTopics: "Inverted index, TF-IDF, MapReduce, Collaborative filtering, Sliding window top-K"
        },
        {
          name: "Module 7.7: Financial & Trading (3 problems)",
          depth: "Very Deep",
          topics: [
            "Stock Trading Platform - Order book, matching engine",
            "Payment System (Stripe/PayPal) - Transactions, fraud detection",
            "Wallet Service - Balance, transactions, idempotency"
          ],
          practice: [
            "Ultra-low latency design",
            "Order matching algorithms",
            "Double-entry bookkeeping",
            "Idempotency keys",
            "Fraud detection ML"
          ],
          keyTopics: "In-memory databases, Priority queues, ACID transactions, Idempotency, Event sourcing"
        },
        {
          name: "Module 7.8: Infrastructure & Platform (5 problems)",
          depth: "Very Deep",
          topics: [
            "Distributed Message Queue (Kafka-like)",
            "API Gateway - Authentication, rate limiting, routing",
            "Load Balancer - L4/L7, health checks, algorithms",
            "Service Mesh - Sidecar proxy, traffic management",
            "Container Orchestration (K8s-like) - Scheduling, scaling"
          ],
          practice: [
            "Understanding infrastructure components deeply",
            "Consensus algorithms (Raft, Paxos basics)",
            "Service discovery mechanisms",
            "Traffic routing strategies",
            "Auto-scaling policies"
          ],
          keyTopics: "Partitioning, Consumer groups, Sidecar pattern, Consensus, Scheduling algorithms"
        }
      ]
    },
    {
      part: 8,
      title: "Advanced Concepts & Deep Dives",
      duration: "Week 13-14 (20 hours)",
      level: "Expert",
      icon: Zap,
      color: "bg-cyan-500",
      modules: [
        {
          name: "Module 8.1: Distributed Systems Concepts",
          depth: "Very Deep",
          topics: [
            "Consensus algorithms (Raft, Paxos overview)",
            "Vector clocks & conflict resolution",
            "Gossip protocol for membership",
            "Distributed transactions (2PC, 3PC)",
            "Linearizability vs Serializability",
            "Byzantine Fault Tolerance basics"
          ],
          practice: [
            "Study Raft visualization",
            "Implement vector clock in JavaScript",
            "Understand when to use 2PC",
            "Read papers: Raft, Dynamo, Bigtable"
          ],
         
          keyTakeaway: "Distributed systems require careful handling of failures, consensus, and consistency trade-offs. Understanding these fundamentals is crucial for designing reliable large-scale systems."
        },
        {
          name: "Module 8.2: Advanced Caching Strategies",
          depth: "Very Deep",
          topics: [
            "Cache invalidation patterns (TTL, Event-based, Write-through)",
            "Cache warming strategies",
            "Distributed cache coordination",
            "Cache aside vs Read-through vs Write-through",
            "Cache stampede prevention",
            "Multi-level caching hierarchies"
          ],
          practice: [
            "Design cache invalidation for e-commerce product catalog",
            "Implement cache-aside pattern with Redis",
            "Solve cache stampede with locks/probabilistic early expiration",
            "Design 3-tier cache: Browser → CDN → Redis"
          ],
          keyTakeaway: "Effective caching can reduce latency by 10-100x, but requires careful invalidation strategies to maintain data consistency."
        },
        {
          name: "Module 8.3: Advanced Database Patterns",
          depth: "Very Deep",
          topics: [
            "Event Sourcing architecture",
            "CQRS (Command Query Responsibility Segregation)",
            "Change Data Capture (CDC)",
            "Database migration strategies (dual writes, shadow mode)",
            "Polyglot persistence patterns",
            "Time-series database optimization"
          ],
          practice: [
            "Design event-sourced order management system",
            "Implement CQRS for read-heavy analytics dashboard",
            "Plan zero-downtime migration from MySQL to PostgreSQL",
            "Design schema for time-series IoT data"
          ],
          keyTakeaway: "Advanced database patterns enable scalability and flexibility but add complexity. Use them when specific problems justify the trade-offs."
        },
        {
          name: "Module 8.4: Performance Optimization Deep Dive",
          depth: "Very Deep",
          topics: [
            "Performance profiling techniques",
            "Database query optimization (EXPLAIN plans, indexes)",
            "Network optimization (connection pooling, HTTP/2, compression)",
            "Async processing patterns (job queues, streaming)",
            "Resource contention handling",
            "Capacity planning and forecasting"
          ],
          practice: [
            "Optimize slow query from 5s to <100ms using indexes",
            "Reduce API latency with connection pooling",
            "Design async email sending with job queue",
            "Calculate capacity needed for 10x traffic growth"
          ],
          keyTakeaway: "Performance optimization is data-driven. Measure first, optimize bottlenecks, then measure again. Premature optimization wastes time."
        },
        {
          name: "Module 8.5: Security Architecture",
          depth: "Very Deep",
          topics: [
            "Defense in depth strategy",
            "Authentication vs Authorization patterns",
            "OAuth2 and JWT deep dive",
            "API security (rate limiting, API keys, encryption)",
            "Data encryption (at rest, in transit, key management)",
            "Security threat modeling"
          ],
          practice: [
            "Design OAuth2 flow for third-party integrations",
            "Implement JWT with proper expiration and refresh",
            "Design API rate limiting (token bucket algorithm)",
            "Perform threat modeling for payment system"
          ],
          keyTakeaway: "Security must be designed into systems from the start. Every layer should have security controls, and sensitive data requires encryption and access controls."
        },
        {
          name: "Module 8.6: Observability & Monitoring",
          depth: "Very Deep",
          topics: [
            "Three pillars: Metrics, Logs, Traces",
            "Distributed tracing (OpenTelemetry, Jaeger)",
            "SLIs, SLOs, and SLAs",
            "Alerting strategy (what, when, who)",
            "Error budgets and incident response",
            "Performance dashboards design"
          ],
          practice: [
            "Define SLOs for API (99.9% uptime, p95 latency <200ms)",
            "Set up distributed tracing for microservices",
            "Design alerting rules to avoid alert fatigue",
            "Create incident runbook for database failover"
          ],
          keyTakeaway: "You can't fix what you can't see. Comprehensive observability enables quick problem detection and resolution in production systems."
        }
      ],
      milestoneProject: {
        name: "Design Complete E-commerce Platform",
        description: "Apply all advanced concepts to design a production-ready e-commerce system",
        requirements: [
          "Handle 10M daily active users with 100K concurrent shoppers",
          "Design product catalog with 50M products and real-time inventory",
          "Implement event-sourced order processing with CQRS",
          "Design payment processing with strong consistency guarantees",
          "Add distributed tracing and comprehensive monitoring",
          "Plan for multi-region deployment with low latency worldwide",
          "Include security, caching, database optimization strategies",
          "Design disaster recovery and incident response procedures"
        ],
        deliverables: [
          "Complete HLD diagram with all components",
          "Database schema with sharding/partitioning strategy",
          "API documentation with security and rate limiting",
          "Deployment architecture (multi-region, CDN, caching layers)",
          "Observability plan (metrics, logs, traces, SLOs)",
          "Disaster recovery and backup strategy",
          "Capacity planning spreadsheet",
          "Trade-off analysis document"
        ],
        estimatedTime: "15-20 hours",
        successCriteria: "System design can handle peak Black Friday traffic (10x normal), has <200ms p95 latency globally, 99.95% uptime SLO, and graceful degradation under failure"
      }
    }