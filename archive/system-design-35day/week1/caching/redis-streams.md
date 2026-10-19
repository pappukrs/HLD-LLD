## **🔥 Redis Streams & WebSockets - Real-time Data Processing 🚀**  

Today, we’ll explore **Redis Streams** for **event-driven architectures** and combine it with **WebSockets** for real-time updates in Node.js.  

---

# **📌 Part 1: Redis Streams - Event-Driven Architecture**
## **🔹 What are Redis Streams?**
Redis Streams is a **message queue** that stores and processes events in order. Unlike Pub/Sub, **messages are stored**, so consumers can **read past messages**.

✅ **Event-Driven** → Ideal for microservices communication.  
✅ **Persistent Messages** → Unlike Pub/Sub, messages stay in the stream.  
✅ **Multiple Consumers** → Supports consumer groups for parallel processing.  

---

## **🛠 Step 1: Install Redis & Node.js Modules**
```bash
npm init -y
npm install express redis
```

---

## **🛠 Step 2: Create a Producer (Event Generator)**
📍 **Create `producer.js`**
```js
const redis = require("redis");

const client = redis.createClient();

client.on("error", (err) => console.error("Redis Error:", err));

async function produceEvent() {
    const event = { message: `Event at ${new Date().toISOString()}` };

    // Add event to Redis Stream
    client.xadd("event_stream", "*", "message", JSON.stringify(event), (err, res) => {
        if (err) {
            console.error("❌ Error adding event:", err);
        } else {
            console.log(`✅ Event added to stream: ${res}`);
        }
    });
}

// Produce an event every 3 seconds
setInterval(produceEvent, 3000);
```
🔥 **How it works?**  
- Every **3 seconds**, an **event** is stored in the Redis stream (`event_stream`).  
- **Consumers** can read events at their own pace.

---

## **🛠 Step 3: Create a Consumer (Event Processor)**
📍 **Create `consumer.js`**
```js
const redis = require("redis");

const client = redis.createClient();

client.on("error", (err) => console.error("Redis Error:", err));

async function consumeEvent() {
    client.xread("BLOCK", 0, "STREAMS", "event_stream", "$", (err, stream) => {
        if (err) {
            console.error("❌ Error consuming event:", err);
            return;
        }
        if (stream) {
            stream[0][1].forEach(event => {
                console.log(`📩 Received Event: ${event[1][1]}`);
            });
        }
        consumeEvent(); // Keep consuming events
    });
}

consumeEvent();
```
🔥 **How it works?**  
- Listens for new events from `event_stream`.  
- When an event is added, it **processes** and **logs** the message.  

---

## **🛠 Step 4: Run the Producer & Consumer**
1️⃣ **Start Redis Server**  
```bash
redis-server
```
2️⃣ **Run the Consumer (listener)**  
```bash
node consumer.js
```
3️⃣ **Run the Producer (event sender)**  
```bash
node producer.js
```
📢 **Expected Output in Consumer:**  
```
📩 Received Event: {"message":"Event at 2025-03-15T12:00:00Z"}
📩 Received Event: {"message":"Event at 2025-03-15T12:00:03Z"}
```

---

# **📌 Part 2: WebSockets + Redis for Real-time Updates**
## **🔹 What are WebSockets?**
WebSockets allow **real-time, bidirectional communication** between clients and servers.

✅ **Persistent Connection** → Unlike HTTP, WebSockets **stay open**.  
✅ **Low Latency** → Ideal for real-time apps (chats, notifications, stock updates).  
✅ **Scalable** → Can be used with Redis for multi-instance communication.  

---

## **🛠 Step 1: Install Required Dependencies**
```bash
npm install ws redis express
```

---

## **🛠 Step 2: Create a WebSocket Server**
📍 **Create `ws-server.js`**
```js
const WebSocket = require("ws");
const redis = require("redis");

const subscriber = redis.createClient();

const wss = new WebSocket.Server({ port: 8080 });

wss.on("connection", (ws) => {
    console.log("🟢 Client Connected");

    subscriber.subscribe("notifications");

    subscriber.on("message", (channel, message) => {
        console.log(`📢 Sending message to client: ${message}`);
        ws.send(message);
    });

    ws.on("close", () => {
        console.log("🔴 Client Disconnected");
        subscriber.unsubscribe();
    });
});

console.log("✅ WebSocket server running on ws://localhost:8080");
```
🔥 **How it works?**  
- **Clients connect via WebSockets** on `ws://localhost:8080`.  
- Listens for messages from Redis **Pub/Sub**.  
- **Pushes messages** to connected WebSocket clients.

---

## **🛠 Step 3: Create a WebSocket Client**
📍 **Create `ws-client.js`**
```js
const WebSocket = require("ws");

const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => {
    console.log("🟢 Connected to WebSocket server");
});

ws.on("message", (message) => {
    console.log(`📩 Received: ${message}`);
});

ws.on("close", () => {
    console.log("🔴 Disconnected from server");
});
```
🔥 **How it works?**  
- Connects to the **WebSocket server**.  
- **Receives real-time messages** when published via Redis Pub/Sub.

---

## **🛠 Step 4: Publish Messages via Redis**
📍 **Create `publisher.js`**
```js
const redis = require("redis");

const publisher = redis.createClient();

setInterval(() => {
    const message = `🔔 Notification at ${new Date().toISOString()}`;
    console.log(`📢 Publishing: ${message}`);
    publisher.publish("notifications", message);
}, 5000);
```
🔥 **How it works?**  
- Every **5 seconds**, a **notification** is published to Redis.  
- WebSocket clients **receive real-time updates**.

---

## **🛠 Step 5: Run Everything**
1️⃣ **Start Redis Server**  
```bash
redis-server
```
2️⃣ **Start WebSocket Server**  
```bash
node ws-server.js
```
3️⃣ **Start WebSocket Client**  
```bash
node ws-client.js
```
4️⃣ **Start Redis Publisher**  
```bash
node publisher.js
```
📢 **Expected Output in Client:**  
```
📩 Received: 🔔 Notification at 2025-03-15T12:00:00Z
📩 Received: 🔔 Notification at 2025-03-15T12:00:05Z
```

---

# **📌 Dockerizing Everything**
📍 **Create `docker-compose.yml`**
```yaml
version: "3.8"
services:
  redis:
    image: redis:latest
    container_name: redis
    ports:
      - "6379:6379"

  publisher:
    build: .
    container_name: publisher
    depends_on:
      - redis
    command: ["node", "publisher.js"]

  ws-server:
    build: .
    container_name: ws-server
    depends_on:
      - redis
    command: ["node", "ws-server.js"]
    ports:
      - "8080:8080"

  ws-client:
    build: .
    container_name: ws-client
    depends_on:
      - ws-server
    command: ["node", "ws-client.js"]
```
🔥 **Run with Docker Compose**  
```bash
docker-compose up --build
```

---

# **🎯 Summary**
✅ **Redis Streams** → Persistent, event-driven messaging.  
✅ **Redis Pub/Sub + WebSockets** → Real-time notifications.  
✅ **Dockerized** → Easily scalable microservices.  

---

### **🚀 Next Steps:**  
Do you want to integrate **GraphQL Subscriptions** with Redis for real-time GraphQL APIs?