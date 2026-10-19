## 📅 **Day 5: Auto Scaling in Kubernetes - Scaling Based on Demand** 🚀  

Auto Scaling in Kubernetes ensures **efficient resource utilization** by dynamically adjusting the number of pods based on CPU, memory, or custom metrics.

---

## **🌍 Types of Auto Scaling in Kubernetes**  

1️⃣ **Horizontal Pod Autoscaler (HPA)**  
   - Scales the number of **Pods** based on CPU/Memory utilization.  
   - **Use Case:** Handling **traffic spikes** dynamically.  

2️⃣ **Vertical Pod Autoscaler (VPA)**  
   - Adjusts **CPU/Memory requests & limits** for existing Pods.  
   - **Use Case:** Optimizing **resource allocation** for performance.

3️⃣ **Cluster Autoscaler**  
   - **Adds/Removes worker nodes** based on pending pod demands.  
   - **Use Case:** Scaling **infrastructure** dynamically in the cloud.

---

## **🛠 Step 1: Create a Node.js App with CPU Load**
📍 **Create `server.js`**  
```js
const express = require('express');
const app = express();

// Simulate CPU load
app.get('/load', (req, res) => {
    let sum = 0;
    for (let i = 0; i < 1e7; i++) sum += i;
    res.send(`Processed heavy load!`);
});

app.get('/', (req, res) => {
    res.send('Hello, this is Kubernetes Auto Scaling!');
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

---

## **🛠 Step 2: Create a Dockerfile**
📍 **Create `Dockerfile`**  
```dockerfile
FROM node:18
WORKDIR /app
COPY server.js .
RUN npm install express
CMD ["node", "server.js"]
EXPOSE 3000
```
🔥 **Build and push the image to Docker Hub:**  
```bash
docker build -t my-node-app .
docker tag my-node-app <your-docker-hub-username>/my-node-app
docker push <your-docker-hub-username>/my-node-app
```

---

## **🛠 Step 3: Deploy the App in Kubernetes**
📍 **Create `deployment.yaml`**  
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: node-app
spec:
  replicas: 2
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
        image: <your-docker-hub-username>/my-node-app
        resources:
          requests:
            cpu: "100m"
          limits:
            cpu: "200m"
        ports:
        - containerPort: 3000
```
🔥 **Deploy it:**  
```bash
kubectl apply -f deployment.yaml
```
🛠 **Check pods:**  
```bash
kubectl get pods
```

---

## **🛠 Step 4: Create a Load Balancer Service**
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
🔥 **Expose the service:**  
```bash
kubectl apply -f service.yaml
```
🛠 **Check external IP:**  
```bash
kubectl get svc node-service
```

---

## **🛠 Step 5: Enable Horizontal Pod Autoscaler (HPA)**
📍 **Apply HPA policy**  
```bash
kubectl autoscale deployment node-app --cpu-percent=50 --min=2 --max=5
```
🛠 **Check the HPA status:**  
```bash
kubectl get hpa
```

---

## **🛠 Step 6: Simulate High Traffic & Monitor Scaling**
🔥 **Send multiple requests to overload CPU:**  
```bash
kubectl run -i --tty load-generator --image=busybox --restart=Never -- /bin/sh
```
Inside the BusyBox shell, run:  
```bash
while true; do wget -q -O- http://node-service/load; done
```
🛠 **Watch Pods scaling up dynamically:**  
```bash
kubectl get pods -w
```

---

## **🎯 Summary**
✅ **HPA scales pods based on CPU usage.**  
✅ **Kubernetes automatically adds/removes pods as needed.**  
✅ **Cluster Autoscaler can scale worker nodes for larger loads.**  

---

🔥 **Next Step:** Do you want to explore **Kubernetes Cluster Autoscaler** or **Service Mesh (Istio/Linkerd) for advanced traffic management**? 🚀