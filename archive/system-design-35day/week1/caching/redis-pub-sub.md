## **🔥 Day 5: Redis Pub/Sub - Real-time Communication**  

### **📌 What is Redis Pub/Sub?**  
Redis **Publish/Subscribe (Pub/Sub)** is a **real-time messaging system** that allows multiple services to **communicate asynchronously**.

✅ **Efficient** → Minimal overhead, event-driven.  
✅ **Decoupled Services** → Publishers & subscribers don't need direct interaction.  
✅ **Scalable** → Supports multiple clients & microservices.  

---

## **🔹 How Redis Pub/Sub Works?**
1️⃣ **A Publisher** sends messages to a **channel**.  
2️⃣ **Subscribers** listen for messages on that channel.  
3️⃣ When a message is published, **all subscribers receive it instantly**.  

---

## **🔍 Activity: Implement Redis Pub/Sub in Node.js**
We'll build a **real-time notification system** where one service **publishes** messages, and multiple services **subscribe** to receive them.

---

### **🛠 Step 1: Install Redis & Node.js Modules**
Run the following command to install Redis and required dependencies:  
```bash
npm init -y
npm install express redis
```

---

### **🛠 Step 2: Create a Publisher (publisher.js)**
📍 **Create `publisher.js`**
```js
const redis = require("redis");

const publisher = redis.createClient();

publisher.on("error", (err) => console.error("Redis Error:", err));

// Publish a message every 5 seconds
setInterval(() => {
    const message = `Hello at ${new Date().toISOString()}`;
    console.log(`📢 Publishing message: ${message}`);
    publisher.publish("notifications", message);
}, 5000);
```
🔥 **How it works?**  
- Every **5 seconds**, a message is **published** to the `notifications` channel.  
- Any **subscribers** listening to this channel will receive it.

---

### **🛠 Step 3: Create a Subscriber (subscriber.js)**
📍 **Create `subscriber.js`**
```js
const redis = require("redis");

const subscriber = redis.createClient();

subscriber.on("error", (err) => console.error("Redis Error:", err));

subscriber.subscribe("notifications");

subscriber.on("message", (channel, message) => {
    console.log(`📩 Received message on ${channel}: ${message}`);
});
```
🔥 **How it works?**  
- The **subscriber** listens for messages on the `notifications` channel.  
- When a message is **published**, it **prints the received message**.

---

### **🛠 Step 4: Run the Publisher & Subscriber**
1️⃣ **Start Redis Server**  
```bash
redis-server
```
2️⃣ **Run the Subscriber (listener)**  
```bash
node subscriber.js
```
3️⃣ **Run the Publisher (message sender)**  
```bash
node publisher.js
```
📢 **Expected Output in the Subscriber:**  
```
📩 Received message on notifications: Hello at 2025-03-15T12:00:00Z
📩 Received message on notifications: Hello at 2025-03-15T12:00:05Z
```

---

## **🛠 Step 5: Dockerizing Redis Pub/Sub**
📍 **Create `Dockerfile`**
```dockerfile
FROM node:18
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY publisher.js subscriber.js .
CMD ["node", "publisher.js"]
EXPOSE 3000
```

📍 **Create `docker-compose.yml`**
```yaml
version: "3.8"
services:
  redis:
    image: redis:latest
    container_name: redis-pubsub
    ports:
      - "6379:6379"

  publisher:
    build: .
    container_name: publisher
    depends_on:
      - redis

  subscriber:
    build: .
    container_name: subscriber
    depends_on:
      - redis
    command: ["node", "subscriber.js"]
```

🔥 **Run everything using Docker Compose**  
```bash
docker-compose up --build
```

📢 Now, Redis, the publisher, and the subscriber **all run inside containers**!

---

## **🎯 Summary**
✅ **Redis Pub/Sub enables real-time communication**.  
✅ **Publishers send messages, and multiple subscribers receive them instantly**.  
✅ **Dockerized Redis Pub/Sub for scalable microservices**.  

---

### **🔥 Next Step:**  
Do you want to explore **Redis Streams for event-driven architectures** or integrate **Redis with WebSockets** for real-time updates? 🚀