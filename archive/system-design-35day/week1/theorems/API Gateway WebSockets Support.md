# **📅 Day 12: API Gateway WebSockets Support** 🌐🔄  

## **📌 What is WebSockets?**  
WebSockets provide **real-time, bidirectional communication** between **clients and servers**.  
Unlike REST APIs, WebSockets **keep the connection open**, reducing latency.  

✅ **Why use WebSockets in API Gateways?**  
🔹 Efficient **real-time** updates  
🔹 **Lower latency** than HTTP polling  
🔹 Supports **event-driven applications** (chat, stock prices, live notifications)  

---

# **🔹 1️⃣ Implementing WebSockets in Kong API Gateway**  
### **Step 1: Setup Kong with WebSockets**
📍 **Create `docker-compose.yml`**
```yaml
version: "3.8"
services:
  kong-database:
    image: postgres:13
    container_name: kong-db
    environment:
      POSTGRES_USER: kong
      POSTGRES_DB: kong
      POSTGRES_PASSWORD: kong
    ports:
      - "5432:5432"

  kong:
    image: kong:latest
    container_name: kong
    environment:
      KONG_DATABASE: "postgres"
      KONG_PG_HOST: kong-database
      KONG_ADMIN_LISTEN: "0.0.0.0:8001"
    depends_on:
      - kong-database
    ports:
      - "8000:8000" # API Proxy Port
      - "8001:8001" # Admin API Port
```
📍 **Start Kong**
```bash
docker-compose up -d
```

---

### **Step 2: Register WebSocket API**
📍 **Create WebSocket service**
```bash
curl -i -X POST http://localhost:8001/services \
  --data "name=ws-service" \
  --data "url=ws://backend:3000"
```

📍 **Create a route**
```bash
curl -i -X POST http://localhost:8001/routes \
  --data "service.id=ws-service" \
  --data "paths[]=/ws"
```
✅ Now WebSockets are routed via `ws://localhost:8000/ws`

---

### **Step 3: Create a WebSocket Server in Node.js**
📍 **Create `server.js`**
```javascript
const WebSocket = require("ws");

const server = new WebSocket.Server({ port: 3000 });

server.on("connection", (ws) => {
    console.log("Client connected");

    ws.on("message", (message) => {
        console.log("Received:", message);
        ws.send(`Echo: ${message}`);
    });

    ws.on("close", () => console.log("Client disconnected"));
});

console.log("WebSocket server running on ws://localhost:3000");
```

📍 **Run WebSocket server**
```bash
node server.js
```

📍 **Test WebSocket**
```bash
wscat -c ws://localhost:8000/ws
```
✅ Kong now proxies WebSocket requests to the backend.

---

# **🔹 2️⃣ Implementing WebSockets in AWS API Gateway**
### **Step 1: Create WebSocket API**
1️⃣ Go to **AWS API Gateway**  
2️⃣ Choose **"WebSocket API"**  
3️⃣ Define **routes**:  
   - `$connect` → When a client connects  
   - `$disconnect` → When a client disconnects  
   - `sendMessage` → Custom route  

---

### **Step 2: Create a WebSocket Backend**
📍 **Deploy a WebSocket Lambda function**
```javascript
exports.handler = async (event) => {
    console.log("Event:", JSON.stringify(event));
    
    const { requestContext, body } = event;
    
    return { statusCode: 200, body: `Received: ${body}` };
};
```
✅ AWS API Gateway now routes WebSocket events to Lambda.

---

### **Step 3: Test WebSocket API**
📍 **Connect to WebSocket**
```bash
wscat -c wss://your-api-id.execute-api.us-east-1.amazonaws.com/production
```
📍 **Send message**
```bash
> { "action": "sendMessage", "data": "Hello, WebSocket!" }
```
✅ AWS API Gateway sends the message to Lambda.

---

# **🔹 3️⃣ Implementing WebSockets in NGINX API Gateway**
📍 **Modify `nginx.conf`**
```nginx
http {
    upstream websocket_backend {
        server backend:3000;
    }

    server {
        listen 80;
        location /ws {
            proxy_pass http://websocket_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "Upgrade";
        }
    }
}
```

📍 **Restart NGINX**
```bash
docker-compose up -d
```

📍 **Connect to WebSocket**
```bash
wscat -c ws://localhost/ws
```
✅ Requests are proxied to the backend WebSocket server.

---

# **📌 Summary**
✅ **Kong API Gateway** → Built-in WebSocket support  
✅ **AWS API Gateway** → Fully managed WebSocket routing  
✅ **NGINX API Gateway** → Requires manual WebSocket setup  

🚀 **Next Topic: API Gateway Service Discovery?**