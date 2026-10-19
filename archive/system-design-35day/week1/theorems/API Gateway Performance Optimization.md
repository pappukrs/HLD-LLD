# **📅 Day 16: API Gateway Performance Optimization** 🚀⚡  

API Gateways handle **high traffic** and need **performance tuning** to avoid bottlenecks. Today, we'll learn **optimization techniques** for high-performance API Gateway setups.  

---

## **🔹 1️⃣ Rate Limiting & Throttling** 🚦  
✅ Prevents **API abuse** by limiting requests.  
✅ Protects **backend services** from overload.  

### **🔍 Example: Kong API Gateway - Rate Limiting Plugin**  
📍 **Limit requests to 10 per minute per user**  
```bash
curl -X POST http://localhost:8001/plugins \
     --data "name=rate-limiting" \
     --data "config.minute=10" \
     --data "config.policy=local"
```
✅ Now, users can **only send 10 requests per minute**.  

---

## **🔹 2️⃣ Response Caching** 💾  
✅ Reduces **backend load** by serving cached responses.  
✅ Improves **API speed**.  

### **🔍 Example: Kong API Gateway - Caching Plugin**  
📍 **Cache API responses for 30 seconds**  
```bash
curl -X POST http://localhost:8001/plugins \
     --data "name=proxy-cache" \
     --data "config.strategy=memory" \
     --data "config.response_code=200" \
     --data "config.request_method=GET" \
     --data "config.ttl=30"
```
✅ Now, responses are cached for **30 seconds**.  

---

## **🔹 3️⃣ Load Balancing & Failover** ⚖️  
✅ Distributes **traffic** across multiple servers.  
✅ Ensures **high availability** by redirecting to healthy servers.  

### **🔍 Example: NGINX API Gateway Load Balancing**  
📍 **Configure Load Balancer**  
```nginx
upstream backend_servers {
    server api1.example.com;
    server api2.example.com;
}

server {
    listen 80;
    location /api/ {
        proxy_pass http://backend_servers;
    }
}
```
✅ Now, requests are **evenly distributed** to multiple APIs.  

---

## **🔹 4️⃣ Optimize API Payload & Compression** 🔽  
✅ Reduces **bandwidth usage**.  
✅ Speeds up **API responses**.  

### **🔍 Example: Enable Gzip Compression in NGINX API Gateway**  
📍 **Compress API responses**  
```nginx
server {
    gzip on;
    gzip_types application/json;
}
```
✅ Now, **API responses are compressed**, reducing **network latency**.  

---

## **🔹 5️⃣ Asynchronous & Background Processing** ⏳  
✅ Moves **heavy processing** to the background.  
✅ Improves **API response time**.  

### **🔍 Example: Queue Long-Running Tasks in Node.js**  
📍 **Use RabbitMQ for async job processing**  
```js
const amqp = require('amqplib');

async function sendToQueue(data) {
    const conn = await amqp.connect('amqp://localhost');
    const channel = await conn.createChannel();
    await channel.assertQueue('tasks');
    channel.sendToQueue('tasks', Buffer.from(JSON.stringify(data)));
}

app.post('/process', async (req, res) => {
    await sendToQueue(req.body);
    res.json({ message: "Task received, processing in background" });
});
```
✅ Now, API **immediately responds**, while tasks run in the background.  

---

## **📌 Summary**  
🚦 **Rate Limiting** – Prevent **API abuse**.  
💾 **Response Caching** – Reduce **backend load**.  
⚖️ **Load Balancing** – Distribute **traffic efficiently**.  
🔽 **Compression** – Optimize **API payloads**.  
⏳ **Async Processing** – Speed up **API responses**.  

🚀 **Next Topic: Securing API Gateway?**