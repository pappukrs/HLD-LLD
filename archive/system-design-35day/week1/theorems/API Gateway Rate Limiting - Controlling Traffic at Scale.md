# **📅 Day 10: API Gateway Rate Limiting - Controlling Traffic at Scale** 🚀  

## **📌 Part 1: What is API Gateway Rate Limiting?**
API Gateway Rate Limiting **controls the number of requests per user, IP, or API key** at the API gateway level.  

✅ **Why use API Gateway for Rate Limiting?**  
🔹 Centralized rate limiting for **all microservices**  
🔹 Protects APIs from **DDoS attacks**  
🔹 Prevents excessive API usage by a single client  

### **🛠️ We’ll Implement Rate Limiting in:**
1️⃣ **Kong API Gateway** (Open-source, highly scalable)  
2️⃣ **AWS API Gateway** (Managed, cloud-based)  
3️⃣ **NGINX API Gateway** (Lightweight & flexible)  

---

# **🔹 1️⃣ Kong API Gateway Rate Limiting**
### **Step 1: Set Up Kong API Gateway**
📍 **Install Kong via Docker Compose**
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
      - "8000:8000" # Proxy Port
      - "8001:8001" # Admin API Port
```

📍 **Start Kong API Gateway**
```bash
docker-compose up -d
```

---

### **Step 2: Add a Sample API**
📍 **Create a sample API**
```bash
curl -i -X POST http://localhost:8001/services \
  --data "name=test-api" \
  --data "url=http://mockbin.org/request"
```
📍 **Create a route**
```bash
curl -i -X POST http://localhost:8001/routes \
  --data "service.id=test-api" \
  --data "paths[]=/test"
```
✅ Your API is now accessible at `http://localhost:8000/test`  

---

### **Step 3: Enable Rate Limiting Plugin**
📍 **Enable Kong’s Rate Limiting Plugin**
```bash
curl -i -X POST http://localhost:8001/plugins \
  --data "name=rate-limiting" \
  --data "config.minute=5" \
  --data "config.limit_by=consumer" \
  --data "config.policy=local"
```
✅ Limits clients to **5 requests per minute**  

---

### **Step 4: Test Rate Limiting**
Run this **6 times**:
```bash
curl -i http://localhost:8000/test
```
✅ The 6th request gets **blocked** (`429 Too Many Requests`)  

---

# **🔹 2️⃣ AWS API Gateway Rate Limiting**
### **Step 1: Create an API Gateway**
1️⃣ **Go to AWS API Gateway Console**  
2️⃣ Click **"Create API" → "HTTP API"**  
3️⃣ Set up a **mock integration** or attach a Lambda function  

---

### **Step 2: Enable Rate Limiting in AWS API Gateway**
1️⃣ **Go to "Usage Plans"**  
2️⃣ Click **"Create Usage Plan"**  
3️⃣ Set **Rate Limit (e.g., 5 requests per second)**  
4️⃣ Attach an **API Key** and bind it to your API  

---

### **Step 3: Test API Rate Limiting**
📍 **Send 6 requests in a second**
```bash
for i in {1..6}; do curl -X GET "https://your-api-id.execute-api.us-east-1.amazonaws.com/test"; done
```
✅ The 6th request is **blocked with 429 Too Many Requests**  

---

# **🔹 3️⃣ NGINX API Gateway Rate Limiting**
📍 **Modify `nginx.conf`**
```nginx
http {
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=5r/s;

    server {
        listen 80;
        location /test {
            limit_req zone=api_limit burst=10 nodelay;
            proxy_pass http://backend;
        }
    }
}
```

📍 **Restart NGINX**
```bash
docker-compose up -d
```
✅ Requests beyond **5 per second** get blocked.  

---

# **📌 Part 3: Summary**
✅ **Kong API Gateway** → Scalable, easy-to-use, supports plugins  
✅ **AWS API Gateway** → Fully managed, integrates with AWS services  
✅ **NGINX API Gateway** → Lightweight, custom rules  

Would you like to explore **JWT Authentication with API Gateway next?** 🔥