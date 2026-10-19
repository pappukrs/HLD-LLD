### **📅 Day 3: Load Balancing - Distributing Traffic Efficiently**  

---

## **🚀 What is Load Balancing?**  
Load balancing is a technique used to distribute incoming network traffic across multiple servers, ensuring no single server is overwhelmed. It improves:  

✅ **Scalability** - Handles increasing traffic smoothly  
✅ **High Availability** - Prevents server crashes due to overload  
✅ **Performance Optimization** - Distributes traffic efficiently  

---

## **🌍 Types of Load Balancers**  

### **1️⃣ DNS Load Balancing**
- Distributes traffic at the **DNS level** by returning different server IPs based on geographic proximity or round-robin logic.
- Example: **AWS Route 53, Cloudflare Load Balancer**  

**🛠 How It Works?**  
- User requests `myapp.com` → DNS rotates IPs → Requests are distributed  

**⚠️ Limitation:**  
- Cannot dynamically adjust based on server health.  

---

### **2️⃣ Software Load Balancers**
These are installed on a server and used for routing traffic between multiple backend servers.  

🔹 **Popular Software Load Balancers:**  
- **NGINX** (Reverse Proxy + Load Balancer)  
- **HAProxy** (High-performance Load Balancer)  

**✅ Advantages:**  
✔ Customizable configurations  
✔ Supports different load balancing algorithms  
✔ Monitors server health  

---

### **3️⃣ Hardware Load Balancers**
- **Dedicated network appliances** for traffic distribution.  
- Used by **large enterprises** with high traffic demands.  

🔹 **Examples:**  
- **F5 Big-IP**, **Citrix NetScaler**, **Cisco Load Balancers**  

✅ **Advantages:**  
✔ Super fast and low latency  
✔ Built-in DDoS protection  

❌ **Downside:** Expensive & requires specialized hardware.  

---

## **⚙ Load Balancing Algorithms**
Load balancers use different **algorithms** to decide where to send requests.  

### **1️⃣ Round Robin** (Default)
- **How it Works?**  
  - Distributes requests **sequentially** to all available servers.  
  - Example:  
    ```
    Request 1 → Server A  
    Request 2 → Server B  
    Request 3 → Server C  
    Request 4 → Server A  
    ```
✅ **Good for:** Balanced loads where all servers are equal.  
❌ **Bad for:** Unequal load servers (e.g., one is slower).  

---

### **2️⃣ Least Connections**
- **How it Works?**  
  - Sends traffic to the server with **fewer active connections.**  
✅ **Good for:** Long-lived connections like WebSockets.  
❌ **Bad for:** Short, quick HTTP requests (less useful).  

---

### **3️⃣ IP Hashing**
- **How it Works?**  
  - Routes requests based on the client’s **IP address**.  
  - Ensures the **same user always** hits the same server.  

✅ **Good for:** Sticky sessions & consistent user experience.  
❌ **Bad for:** Load imbalances if one user sends too many requests.  

---

## **🔍 Activity: Set Up an NGINX Load Balancer**  

### **🛠 Step 1: Create Multiple Node.js Servers**  
📍 **Create `server1.js`**  
```js
const express = require('express');
const app = express();
app.get('/', (req, res) => {
    res.send('Hello from Server 1');
});
app.listen(3001, () => console.log('Server 1 running on port 3001'));
```

📍 **Create `server2.js`**  
```js
const express = require('express');
const app = express();
app.get('/', (req, res) => {
    res.send('Hello from Server 2');
});
app.listen(3002, () => console.log('Server 2 running on port 3002'));
```

📍 **Create `server3.js`**  
```js
const express = require('express');
const app = express();
app.get('/', (req, res) => {
    res.send('Hello from Server 3');
});
app.listen(3003, () => console.log('Server 3 running on port 3003'));
```

---

### **🛠 Step 2: Create an NGINX Load Balancer Configuration**
📍 **Create `nginx.conf`**  
```nginx
events {}

http {
    upstream backend_servers {
        server server1:3001;
        server server2:3002;
        server server3:3003;
    }

    server {
        listen 80;

        location / {
            proxy_pass http://backend_servers;
        }
    }
}
```

---

### **🛠 Step 3: Create a Docker Compose File**
📍 **Create `docker-compose.yml`**  
```yaml
version: '3'

services:
  server1:
    build: ./server1
    ports:
      - "3001:3001"

  server2:
    build: ./server2
    ports:
      - "3002:3002"

  server3:
    build: ./server3
    ports:
      - "3003:3003"

  nginx:
    image: nginx:latest
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
    depends_on:
      - server1
      - server2
      - server3
```

---

### **🛠 Step 4: Run Everything**
1️⃣ **Start the services:**  
```bash
docker-compose up -d
```

2️⃣ **Test Load Balancer:**  
```bash
curl http://localhost
```
➡ You’ll see responses like:  
```
Hello from Server 1
Hello from Server 2
Hello from Server 3
```
🎯 **NGINX is now distributing traffic!**  

---

## **🚀 Conclusion**
✅ **Round Robin is the default algorithm** (works best when servers are equal).  
✅ **Least Connections** is best for **long-lived connections** like WebSockets.  
✅ **IP Hashing** ensures **users always hit the same server** (good for sessions).  

**🛠 Next Steps:**  
🔹 Try different **load balancing algorithms** in `nginx.conf`  
🔹 Set up **Health Checks** to remove failed servers  

---

🔥 **Question:** Want to explore **Load Balancing in Kubernetes** next? 🚀