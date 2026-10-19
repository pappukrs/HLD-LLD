# **📅 Day 11: JWT Authentication in API Gateway** 🔐  

## **📌 What is JWT Authentication?**
JWT (**JSON Web Token**) is a secure way to authenticate users.  
It allows **stateless authentication**, meaning **no session storage is required** on the server.

✅ **Why use JWT in API Gateway?**  
🔹 Ensures **secure access** to APIs  
🔹 Allows **role-based authentication**  
🔹 Reduces **server load** (no need for session storage)  

---

# **🔹 1️⃣ Implementing JWT Authentication in Kong API Gateway**  
### **Step 1: Install & Start Kong API Gateway**  
(If you haven’t already set up Kong, use this Docker Compose file)

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

### **Step 2: Register an API Service**
📍 **Create a new API Service in Kong**
```bash
curl -i -X POST http://localhost:8001/services \
  --data "name=test-api" \
  --data "url=http://mockbin.org/request"
```

📍 **Create a Route**
```bash
curl -i -X POST http://localhost:8001/routes \
  --data "service.id=test-api" \
  --data "paths[]=/test"
```
✅ Now, API is accessible at `http://localhost:8000/test`

---

### **Step 3: Enable JWT Authentication**
📍 **Enable JWT Plugin**
```bash
curl -i -X POST http://localhost:8001/plugins \
  --data "name=jwt"
```
📍 **Create a Consumer (User)**
```bash
curl -i -X POST http://localhost:8001/consumers \
  --data "username=johndoe"
```

📍 **Generate JWT Credentials**
```bash
curl -i -X POST http://localhost:8001/consumers/johndoe/jwt
```
✅ This returns a `key` and `secret`. Keep them safe!

---

### **Step 4: Generate a JWT Token**
📍 **Use the key and secret to create a JWT token using Node.js**
```javascript
const jwt = require("jsonwebtoken");

const payload = { username: "johndoe" };
const secret = "YOUR_SECRET"; // Use the secret from Kong

const token = jwt.sign(payload, secret, { algorithm: "HS256" });

console.log("JWT Token:", token);
```
✅ This generates a JWT token.

---

### **Step 5: Access the API Using JWT**
📍 **Make an authorized request**
```bash
curl -i -X GET http://localhost:8000/test \
  --header "Authorization: Bearer YOUR_JWT_TOKEN"
```
✅ If the token is valid, API responds successfully.  
❌ If invalid, Kong returns **401 Unauthorized**.  

---

# **🔹 2️⃣ Implementing JWT Authentication in AWS API Gateway**  
### **Step 1: Set Up API Gateway in AWS**
1️⃣ Go to **AWS API Gateway Console**  
2️⃣ Create a **"HTTP API"**  
3️⃣ Add a **Lambda function** or **mock integration**  

---

### **Step 2: Enable JWT Authentication**
1️⃣ Go to **"Authorizers"** in API Gateway  
2️⃣ Choose **"JWT Authorizer"**  
3️⃣ Enter a **Public Key or JWKS URL**  
4️⃣ Attach the authorizer to **your API routes**  

✅ Now, AWS API Gateway will require a **valid JWT** for access.

---

### **Step 3: Test the JWT Authentication**
📍 **Send a request with the JWT Token**
```bash
curl -X GET "https://your-api-id.execute-api.us-east-1.amazonaws.com/test" \
  --header "Authorization: Bearer YOUR_JWT_TOKEN"
```
✅ AWS API Gateway will verify the token and allow or block access.

---

# **🔹 3️⃣ Implementing JWT Authentication in NGINX API Gateway**
📍 **Modify `nginx.conf`**
```nginx
http {
    server {
        listen 80;
        location /test {
            auth_jwt "Access Denied";
            auth_jwt_key_file /etc/nginx/jwt-key.pub;
            proxy_pass http://backend;
        }
    }
}
```

📍 **Restart NGINX**
```bash
docker-compose up -d
```

📍 **Send an API request**
```bash
curl -X GET "http://localhost/test" \
  --header "Authorization: Bearer YOUR_JWT_TOKEN"
```
✅ Requests with a valid JWT are allowed.  

---

# **📌 Summary**
✅ **Kong API Gateway** → Built-in JWT plugin, easy to configure  
✅ **AWS API Gateway** → Fully managed, integrates with AWS Cognito  
✅ **NGINX API Gateway** → Requires custom JWT validation  

🚀 **Next Topic: API Gateway WebSockets Support?**