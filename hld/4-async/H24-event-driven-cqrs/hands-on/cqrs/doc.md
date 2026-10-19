# **📅 Day 7: CQRS & Event Sourcing - Designing Scalable & Reliable Systems 🚀**  

Today, we’ll dive into **CQRS (Command Query Responsibility Segregation) and Event Sourcing** with **hands-on implementation using Node.js, Kafka, and PostgreSQL.**  

---

## **📌 Part 1: What is CQRS?**
CQRS stands for **Command Query Responsibility Segregation** and separates **read (Query) and write (Command) operations** into different models.  

### **🔹 Why Use CQRS?**
✅ **Scalability** → Read and write operations scale independently  
✅ **Performance** → Optimized database schema for queries vs updates  
✅ **Security** → Restrict write operations while allowing broader read access  

### **🔹 CQRS Architecture**
- **Command Service** → Handles **writes** (Create, Update, Delete)  
- **Query Service** → Handles **reads** (Fetching data)  
- **Event Bus** → Kafka/RabbitMQ sends **changes** from Command → Query  

---

## **📌 Part 2: What is Event Sourcing?**
**Event Sourcing stores every state change as an immutable event, rather than just storing the current state.**  
Instead of "overwriting" data, we **append new events** to a log.  

### **🔹 Why Use Event Sourcing?**
✅ **Auditability** → Complete history of all changes  
✅ **Rebuilding State** → Reconstruct system state by replaying events  
✅ **Fault Tolerance** → Store events safely, recover lost data  

📢 **Example:**
Instead of just storing `{ balance: 100 }`, we store:  
1️⃣ `Deposit $50`  
2️⃣ `Withdraw $30`  
3️⃣ `Deposit $80`  
💡 We can **replay** these events to get `{ balance: 100 }`  

---

# **📌 Part 3: Hands-on CQRS & Event Sourcing with Node.js**
We will create:  
1️⃣ **Command Service** (Handles writes)  
2️⃣ **Query Service** (Handles reads)  
3️⃣ **Kafka Event Bus** (Handles event communication)  
4️⃣ **PostgreSQL Database** (Stores event data)  

---

## **🛠 Step 1: Set Up Kafka & PostgreSQL with Docker**
📍 **Create `docker-compose.yml`**
```yaml
version: '3'
services:
  postgres:
    image: postgres
    container_name: postgres
    restart: always
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: cqrs_db
    ports:
      - "5432:5432"

  kafka:
    image: bitnami/kafka
    container_name: kafka
    ports:
      - "9092:9092"
    environment:
      KAFKA_CFG_ZOOKEEPER_CONNECT: "zookeeper:2181"
      ALLOW_PLAINTEXT_LISTENER: "yes"

  zookeeper:
    image: bitnami/zookeeper
    container_name: zookeeper
    ports:
      - "2181:2181"
    environment:
      ALLOW_ANONYMOUS_LOGIN: "yes"
```

🔥 **Start the containers**
```bash
docker-compose up -d
```

---

## **🛠 Step 2: Install Node.js Dependencies**
```bash
npm init -y
npm install express pg kafka-node
```

---

## **🛠 Step 3: Create the Command Service (Write API)**
📍 **Create `commandService.js`**
```js
const express = require("express");
const kafka = require("kafka-node");

const app = express();
app.use(express.json());

// Kafka Producer Setup
const client = new kafka.KafkaClient({ kafkaHost: "localhost:9092" });
const producer = new kafka.Producer(client);

// Ensure Kafka is ready
producer.on("ready", () => console.log("✅ Kafka Producer is ready"));
producer.on("error", (err) => console.error("Kafka Producer Error:", err));

// Create Order API (Write)
app.post("/order", (req, res) => {
    const order = { orderId: Date.now(), product: req.body.product, quantity: req.body.quantity };
    
    producer.send([{ topic: "order-events", messages: JSON.stringify(order) }], (err, data) => {
        if (err) return res.status(500).send("❌ Kafka Error");
        console.log("📨 Order Created Event Sent:", order);
        res.status(201).send(order);
    });
});

app.listen(4000, () => console.log("🚀 Command Service Running on Port 4000"));
```

---

## **🛠 Step 4: Create the Query Service (Read API)**
📍 **Create `queryService.js`**
```js
const express = require("express");
const { Pool } = require("pg");
const kafka = require("kafka-node");

const app = express();
const pool = new Pool({ user: "user", host: "localhost", database: "cqrs_db", password: "password", port: 5432 });

// Kafka Consumer Setup
const client = new kafka.KafkaClient({ kafkaHost: "localhost:9092" });
const consumer = new kafka.Consumer(client, [{ topic: "order-events", partition: 0 }], { autoCommit: true });

// Store event in DB when received
consumer.on("message", async (message) => {
    const order = JSON.parse(message.value);
    await pool.query("INSERT INTO orders (order_id, product, quantity) VALUES ($1, $2, $3)", 
        [order.orderId, order.product, order.quantity]);
    console.log("📥 Order Event Stored in DB:", order);
});

// Fetch Orders API (Read)
app.get("/orders", async (req, res) => {
    const result = await pool.query("SELECT * FROM orders");
    res.json(result.rows);
});

app.listen(5000, () => console.log("🚀 Query Service Running on Port 5000"));
```

📍 **Create `initDB.sql`**
```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_id BIGINT UNIQUE NOT NULL,
    product TEXT NOT NULL,
    quantity INT NOT NULL
);
```

🔥 **Initialize Database**
```bash
psql -h localhost -U user -d cqrs_db -f initDB.sql
```

---

## **🛠 Step 5: Test the Implementation**
### **📌 Create an Order (Command Service)**
```bash
curl -X POST http://localhost:4000/order -H "Content-Type: application/json" -d '{"product": "Laptop", "quantity": 1}'
```
📢 **Expected Output:**
```
📨 Order Created Event Sent: { orderId: 171234567890, product: "Laptop", quantity: 1 }
```

---

### **📌 Fetch Orders (Query Service)**
```bash
curl -X GET http://localhost:5000/orders
```
📢 **Expected Output:**
```json
[
  { "order_id": 171234567890, "product": "Laptop", "quantity": 1 }
]
```

---

## **📌 Part 4: Summary**
✅ **Command Service** → Sends order events via Kafka  
✅ **Query Service** → Listens for events and stores data in PostgreSQL  
✅ **Kafka** → Acts as an **Event Bus**  
✅ **PostgreSQL** → Stores **read-optimized data**  

---

# **📌 Part 5: Next Steps**
🚀 **Try Scaling Services** → Run multiple instances of `queryService.js`  
🚀 **Implement Event Replay** → Replay events to rebuild state  
🚀 **Next: Distributed Transactions & Sagas**  

Would you like a **hands-on guide for Distributed Transactions & Sagas** next? 🔥