### **📅 Day 4: Load Balancing in Kubernetes - Managing Traffic at Scale**  

---

## **🚀 What is Load Balancing in Kubernetes?**  
In Kubernetes, **Load Balancing** ensures that traffic is evenly distributed among multiple pods, improving **scalability, reliability, and high availability**.  

✅ **Automatically distributes requests**  
✅ **Scales based on demand**  
✅ **Handles pod failures seamlessly**  

---

## **🌍 Load Balancing Approaches in Kubernetes**  

### **1️⃣ Internal Load Balancing (ClusterIP - Default)**
- Traffic is only accessible **inside the cluster**.
- No external access.  
- **Use Case:** Communication between microservices inside Kubernetes.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: internal-service
spec:
  selector:
    app: backend
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
```
🔥 **Access from another pod:**  
```bash
curl http://internal-service
```

---

### **2️⃣ External Load Balancing (LoadBalancer)**
- Allows external traffic to reach Kubernetes services.
- Uses **Cloud Provider Load Balancer** (AWS, GCP, Azure).  
- **Use Case:** Exposing APIs to external users.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-service
spec:
  type: LoadBalancer
  selector:
    app: backend
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
```
🔥 **Access from the internet:**  
```bash
curl http://EXTERNAL-IP
```
🔍 **Check External IP:**  
```bash
kubectl get svc external-service
```

---

### **3️⃣ Ingress Controller (Layer 7 Load Balancing)**
- Routes traffic based on **URLs, hostnames, or paths**.
- Works as an API Gateway with **NGINX, Traefik, Kong**.
- **Use Case:** Routing traffic to different microservices.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
spec:
  rules:
    - host: myapp.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend-service
                port:
                  number: 80
```
🔥 **Access via domain name:**  
```bash
curl http://myapp.com/api
```
🛠 **Install Ingress Controller:**  
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
```

---

## **⚙ Load Balancing in Kubernetes Using NGINX**
### **🛠 Step 1: Create a Node.js App**
📍 **Create `server.js`**  
```js
const express = require('express');
const os = require('os');
const app = express();

app.get('/', (req, res) => {
    res.send(`Hello from ${os.hostname()}`);
});

app.listen(3000, () => console.log(`Server running on 3000`));
```

---

### **🛠 Step 2: Create a Dockerfile**
📍 **Create `Dockerfile`**  
```dockerfile
FROM node:18
WORKDIR /app
COPY server.js .
RUN npm install express
CMD ["node", "server.js"]
EXPOSE 3000
```

---

### **🛠 Step 3: Create a Kubernetes Deployment**
📍 **Create `deployment.yaml`**  
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: node-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: node-app
  template:
    metadata:
      labels:
        app: node-app
    spec:
      containers:
      - name: node-app
        image: my-node-app
        ports:
        - containerPort: 3000
```
🔥 **Deploy the application:**  
```bash
kubectl apply -f deployment.yaml
```
🛠 **Check Pods:**  
```bash
kubectl get pods
```

---

### **🛠 Step 4: Create a LoadBalancer Service**
📍 **Create `service.yaml`**  
```yaml
apiVersion: v1
kind: Service
metadata:
  name: node-service
spec:
  type: LoadBalancer
  selector:
    app: node-app
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
```
🔥 **Expose the application:**  
```bash
kubectl apply -f service.yaml
```
🛠 **Check External IP:**  
```bash
kubectl get svc node-service
```

---

### **🛠 Step 5: Test the Load Balancer**
🔥 **Make requests and see traffic distributed across pods:**  
```bash
curl http://EXTERNAL-IP
```
➡ You’ll see responses from different **Pods (Servers).**  

---

## **🎯 Conclusion**
✅ **ClusterIP** → For internal communication.  
✅ **LoadBalancer** → Expose services externally.  
✅ **Ingress Controller** → Best for **URL-based routing**.  
✅ **NGINX as Load Balancer** → Handles **traffic distribution efficiently**.  

---

🔥 **Next Step:** Do you want to explore **Auto Scaling in Kubernetes** next? 🚀