# 🎯 LLD & HLD - Complete System Design Interview Guide

<div align="center">

![System Design](https://img.shields.io/badge/System%20Design-Complete%20Guide-blue?style=for-the-badge)
![LLD](https://img.shields.io/badge/Low%20Level%20Design-3274%20lines-green?style=for-the-badge)
![HLD](https://img.shields.io/badge/High%20Level%20Design-1985%20lines-orange?style=for-the-badge)
![Language](https://img.shields.io/badge/Language-JavaScript%20%7C%20TypeScript%20%7C%20Python-yellow?style=for-the-badge)

**Master both Low Level Design (LLD) and High Level Design (HLD) for coding interviews**

[📚 LLD Guide](#-low-level-design-lld) • [🏗️ HLD Guide](#️-high-level-design-hld) • [🚀 Quick Start](#-quick-start) • [📖 Study Plan](#-study-plan)

</div>

---

## 📋 What's Inside?

This repository contains **two comprehensive guides** covering everything you need to ace system design interviews:

### 📚 **Low Level Design (LLD)**
Complete guide to object-oriented design, design patterns, and clean code architecture.
- **3,274 lines** of detailed content
- **35 interview problems** with solutions
- **50+ code examples** in JavaScript & TypeScript
- **12+ design patterns** with real-world applications

### 🏗️ **High Level Design (HLD)**  
Complete guide to distributed systems, scalability, and system architecture.
- **1,985 lines** of comprehensive content
- **30 system design problems** with detailed solutions
- **40+ architecture examples** with code
- **8 major sections** covering all fundamentals

---

## 📚 Low Level Design (LLD)

> **Focus:** OOP, Design Patterns, Clean Code, SOLID Principles  
> **Languages:** JavaScript / TypeScript  
> **File:** [`LLD/LLD.md`](LLD/LLD.md)

### 📖 What's Covered

#### Part 1: OOP Fundamentals
- **Four Pillars:** Encapsulation, Abstraction, Inheritance, Polymorphism
- Real-world examples with JavaScript & TypeScript
- Best practices and anti-patterns

#### Part 2: SOLID Principles
- Single Responsibility Principle (SRP)
- Open/Closed Principle (OCP)
- Liskov Substitution Principle (LSP)
- Interface Segregation Principle (ISP)
- Dependency Inversion Principle (DIP)

#### Part 3: Design Patterns (12+)
| Pattern | Use Case |
|---------|----------|
| **Singleton** | Database connections, Configuration |
| **Factory** | Object creation without specifying class |
| **Strategy** | Runtime algorithm selection |
| **Observer** | Event systems, Pub-Sub |
| **Decorator** | Adding features dynamically |
| **Command** | Undo/Redo functionality |
| **State** | Finite state machines |
| **Builder** | Complex object construction |
| **Adapter** | Interface compatibility |
| **Facade** | Simplifying complex subsystems |
| **Prototype** | Cloning objects |
| **Chain of Responsibility** | Request handling pipeline |

#### Part 4: Class Relationships & UML
- Association, Aggregation, Composition, Dependency
- UML diagram notation
- Relationship decision trees

#### Part 5: Problem-Solving Framework
- **6-step approach** for any LLD question
- Complete Parking Lot walkthrough
- Pattern selection guide

#### Part 6: Pattern-to-Problem Mapping
- All 35 blind LLD questions mapped to patterns
- Quick reference tables
- Decision trees

#### Part 7: Common Pitfalls & Best Practices
- Anti-patterns to avoid
- Code quality guidelines
- TypeScript-specific patterns

#### Part 8-13: Interview Preparation
- Interview tips & communication strategies
- Time management (45-min breakdown)
- Red flags vs green flags
- Final checklist

### 🎯 35 LLD Problems Covered

**Level 1 - Fundamentals (10)**
- Parking Lot, Elevator, Library, Movie Booking, ATM, Vending Machine, Car Rental, Restaurant, Hotel, Traffic Signal

**Level 2 - Real-world (15)**
- LRU Cache, Rate Limiter, Logger, File System, URL Shortener, Notification System, Splitwise, Chess, Snake & Ladder, Tic-Tac-Toe, Shopping Cart, Ride Sharing, Chat App, Auction, Food Delivery

**Level 3 - Pattern-heavy (10)**
- Calendar, Meeting Scheduler, Version Control, Pub-Sub, Distributed Cache, Workflow Engine, Payment Gateway, Game Engine, Text Editor, Rule Engine

---

## 🏗️ High Level Design (HLD)

> **Focus:** Distributed Systems, Scalability, System Architecture  
> **Languages:** Python (for algorithms)  
> **File:** [`HLD/HLD.md`](HLD/HLD.md)

### 📖 What's Covered

#### Part 1: Core System Design Principles
- **Scalability:** Vertical vs Horizontal, Auto-scaling
- **CAP Theorem:** CP vs AP vs CA with real examples
- **Latency vs Throughput:** Trade-offs and optimization

#### Part 2: Essential Building Blocks
| Component | Details |
|-----------|---------|
| **Load Balancer** | L4/L7, 5 algorithms, health checks |
| **Caching** | 4 levels, 4 strategies, 4 eviction policies |
| **Databases** | SQL vs NoSQL, 5 types, sharding, replication |
| **Message Queues** | Kafka deep dive, Pub-Sub patterns |
| **CDN** | Global content delivery, caching strategies |
| **API Gateway** | Auth, rate limiting, routing, aggregation |

#### Part 3: System Design Patterns
- Microservices Architecture
- Event-Driven Architecture & Event Sourcing
- CQRS (Command Query Responsibility Segregation)
- Saga Pattern (distributed transactions)
- Circuit Breaker & Bulkhead patterns

#### Part 4: 5-Step Interview Framework
1. **Requirements Clarification** (5-7 min)
2. **Capacity Estimation** (3-5 min) - QPS, storage, bandwidth
3. **High-Level Design** (10-15 min) - Architecture diagrams
4. **Deep Dive** (15-20 min) - Scaling, caching, database strategies
5. **Discussion** (5 min) - Monitoring, security, improvements

#### Part 5-8: Problem Solutions & Interview Tips
- All 30 system design problems with detailed architectures
- Interview communication strategies
- Technology selection matrices
- Estimation formulas & quick references
- 6-week study plan

### 🎯 30 HLD Problems Covered

**Easy/Foundational (5)**
- URL Shortener, Rate Limiter, Web Crawler, Notification System, Pastebin

**Medium (15)**
- YouTube/Netflix, Twitter, Instagram, WhatsApp, Uber/Lyft, Dropbox, Facebook News Feed, Amazon, Ticket Booking, LinkedIn, TikTok, Zoom, Stack Overflow, Airbnb, Food Delivery

**Hard (10)**
- Google Search, Google Maps, Gmail, Stock Trading, Distributed Cache (Redis), Distributed File System (HDFS), Advanced Rate Limiter, News Feed Ranking, Gaming Leaderboard, Ad Click Aggregation

---

## 🚀 Quick Start

### For LLD (Low Level Design)
```bash
# Read the comprehensive guide
cat LLD/LLD.md

# Start with fundamentals
1. Read Part 1-2: OOP & SOLID principles
2. Study Part 3: Design patterns with examples
3. Practice: Solve 2-3 problems from each level
4. Review: Pattern mapping & interview tips
```

**Recommended Path:**
1. **Week 1-2:** OOP pillars + SOLID principles
2. **Week 3:** Learn all 12+ design patterns
3. **Week 4:** Practice Level 1 problems (10 problems)
4. **Week 5:** Practice Level 2 problems (15 problems)
5. **Week 6:** Practice Level 3 + Mock interviews

### For HLD (High Level Design)
```bash
# Read the comprehensive guide
cat HLD/HLD.md

# Start with building blocks
1. Read Part 1-2: Principles & Building blocks
2. Study Part 4: 5-step framework
3. Practice: Capacity estimation
4. Solve: 5 easy + 5 medium problems
```

**Recommended Path:**
1. **Week 1-2:** Scalability, CAP, Load balancers, Caching, Databases
2. **Week 3:** Message queues, CDN, API Gateway, Patterns
3. **Week 4:** 5-step framework + Practice 5 easy problems
4. **Week 5:** Practice 10 medium problems
5. **Week 6:** Practice 3-5 hard problems + Mock interviews

---

## 📖 Study Plan

### Combined 12-Week Plan

| Weeks | Focus | Activities |
|-------|-------|------------|
| **1-3** | **LLD Fundamentals** | OOP, SOLID, Design Patterns |
| **4-6** | **LLD Practice** | Solve 35 problems (10+15+10) |
| **7-8** | **HLD Fundamentals** | Scalability, Building blocks, Patterns |
| **9-10** | **HLD Practice** | Solve easy + medium problems |
| **11** | **HLD Advanced** | Hard problems, complex systems |
| **12** | **Mock Interviews** | LLD + HLD combined practice |

### Daily Routine (2 hours/day)
```
Morning (1 hour):
- Read concepts (30 min)
- Code examples (30 min)

Evening (1 hour):
- Solve 1 problem (45 min)
- Review solution (15 min)
```

---

## 🎯 Interview Preparation

### LLD Interview Checklist
- [ ] Understand all 4 OOP pillars
- [ ] Master SOLID principles
- [ ] Know 12+ design patterns
- [ ] Practice 6-step problem-solving framework
- [ ] Solve 5 problems from each difficulty level
- [ ] Review pattern-to-problem mappings
- [ ] Practice explaining designs verbally

### HLD Interview Checklist
- [ ] Understand CAP theorem trade-offs
- [ ] Master capacity estimation (QPS, storage, bandwidth)
- [ ] Know all building blocks (LB, Cache, DB, Queue, CDN)
- [ ] Practice 5-step framework
- [ ] Solve 5 easy + 10 medium + 3 hard problems
- [ ] Review technology selection matrices
- [ ] Practice drawing architecture diagrams

---

## 📚 Essential Resources

### Books
1. **"Designing Data-Intensive Applications"** - Martin Kleppmann  
   Deep dive into distributed systems, databases

2. **"System Design Interview Vol 1 & 2"** - Alex Xu  
   Visual walkthroughs of common design problems

3. **"Head First Design Patterns"** - Freeman & Robson  
   Easy-to-understand design patterns with examples

### Online Resources
- **ByteByteGo** (YouTube) - Visual system design explanations
- **Grokking the System Design Interview** (Educative.io)
- **SystemDesign.one** - Free diagrams and guides
- **GitHub: system-design-primer** - Comprehensive reference
- **LeetCode Discuss** - System design section

---

## 🤝 Contributing

Found an error or want to improve the guides? Contributions are welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/improvement`)
3. Commit your changes (`git commit -m 'Add improvement'`)
4. Push to the branch (`git push origin feature/improvement`)
5. Open a Pull Request

---

## 📝 What Makes These Guides Special?

### ✨ LLD Guide Features
- ✅ **Complete Coverage:** All OOP concepts + 12+ patterns
- ✅ **Code-First:** 50+ working examples in JS/TS
- ✅ **Interview-Ready:** 35 problems with detailed solutions
- ✅ **Beginner-Friendly:** Builds from basics to advanced
- ✅ **Practical:** Real-world applications and trade-offs

### ✨ HLD Guide Features
- ✅ **Comprehensive:** All system design fundamentals
- ✅ **Battle-Tested:** Real systems (Twitter, YouTube, Uber, Google)
- ✅ **Framework-Based:** 5-step approach for any problem
- ✅ **Production-Ready:** 30 detailed problem solutions
- ✅ **Quick Reference:** Technology matrices, estimation formulas

---

## 🎓 Success Stories

These guides mirror industry-standard interview preparation materials and cover:
- ✅ Everything asked in FAANG interviews
- ✅ Patterns used in production systems
- ✅ Best practices from senior engineers
- ✅ Interview frameworks from top companies

---

## 📊 Repository Stats

```
📁 Repository Structure:
├── LLD/
│   ├── LLD.md (3,274 lines)
│   └── LLD-walkthrough.md
├── HLD/
│   ├── HLD.md (1,985 lines)
│   └── [supporting files]
└── README.md

📚 Total Content:
- 5,259 lines of detailed documentation
- 90+ code examples
- 65 interview problems with solutions
- Complete interview frameworks
```

---

## 💡 Quick Tips

### For LLD
- Start simple, don't over-engineer
- Think in interfaces, not implementations
- Use composition over inheritance
- Always discuss trade-offs

### For HLD
- Clarify requirements FIRST
- Do back-of-envelope calculations
- Draw architecture before coding
- Discuss failure scenarios
- Consider monitoring & alerts

---

## 🌟 Key Mantras

### LLD
> **"Design for change"** - Make code easy to modify  
> **"Communication > Code"** - Explain your thinking  
> **"Patterns solve problems"** - Know when to apply what

### HLD
> **"Start simple, then scale"** - Don't over-engineer  
> **"No perfect solution"** - Always discuss trade-offs  
> **"Communication > Knowledge"** - Explain clearly

---

## 📞 Feedback

Have questions or suggestions? Feel free to:
- Open an issue
- Submit a pull request
- Share your interview success stories!

---

## 📜 License

This project is open source and available for educational purposes.

---

<div align="center">

**⭐ Star this repository if you find it helpful!**

**🚀 Good luck with your interviews!**

*Master the fundamentals, practice systematically, and approach each problem confidently.*

---

Made with ❤️ for interview preparation

[Back to Top](#-lld--hld---complete-system-design-interview-guide)

</div>
