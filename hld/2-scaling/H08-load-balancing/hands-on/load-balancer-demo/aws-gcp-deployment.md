### **🚀 Deploy Load Balancer with Auto Scaling on AWS/GCP using Kubernetes**
Now, let’s **deploy the system** on a **cloud platform (AWS/GCP) using Kubernetes**.

---

## **📌 Step 1: Set Up Kubernetes Cluster on AWS/GCP**
We'll use **AWS EKS (Elastic Kubernetes Service)** or **Google Kubernetes Engine (GKE)**.

### **🛠 1️⃣ AWS EKS Setup**
#### **(A) Install AWS CLI and eksctl**
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Install eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin
```

#### **(B) Create an EKS Cluster**
```bash
eksctl create cluster --name load-balancer-cluster --region us-east-1 --nodes 3
```
✅ This **creates a 3-node cluster** on AWS.

### **🛠 2️⃣ Google Kubernetes Engine (GKE) Setup**
#### **(A) Install Google Cloud CLI**
```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
```

#### **(B) Create a GKE Cluster**
```bash
gcloud container clusters create load-balancer-cluster --num-nodes=3 --zone=us-central1-a
```
✅ This **creates a 3-node cluster** on GCP.

---

## **📌 Step 2: Deploy Load Balancer & Backend**
### **1️⃣ Apply the Deployment and Service to the Cluster**
Run these commands:
```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

### **2️⃣ Verify if Pods are Running**
```bash
kubectl get pods
```
Expected Output:
```
NAME                                READY   STATUS    RESTARTS   AGE
backend-deployment-xxxxxx           1/1     Running   0          10s
backend-deployment-yyyyyy           1/1     Running   0          10s
backend-deployment-zzzzzz           1/1     Running   0          10s
```

---

## **📌 Step 3: Enable Auto Scaling**
Run this command:
```bash
kubectl autoscale deployment backend-deployment --cpu-percent=50 --min=3 --max=10
```
✅ Now, if the CPU usage exceeds **50%**, Kubernetes will **automatically scale** the backend servers.

### **Check Auto Scaling**
```bash
kubectl get hpa
```
Expected Output:
```
NAME               REFERENCE                     TARGETS   MINPODS   MAXPODS   REPLICAS   AGE
backend-deployment  Deployment/backend-deployment   10%       3        10         3        5m
```

---

## **📌 Step 4: Expose the Load Balancer**
### **1️⃣ Get the Load Balancer External IP**
```bash
kubectl get service backend-service
```
Expected Output:
```
NAME             TYPE           CLUSTER-IP      EXTERNAL-IP      PORT(S)        AGE
backend-service  LoadBalancer   10.12.3.45      34.201.123.45    80:32345/TCP   10m
```
✅ Your **Load Balancer is now accessible at** `http://34.201.123.45`

---

## **📌 Step 5: Test the System**
Run:
```bash
curl http://34.201.123.45
```
Expected Output:
```
Hello from Server 1 - abc123
Hello from Server 2 - xyz456
Hello from Server 3 - pqr789
```
✅ Requests are now **distributed across multiple backend servers**.

---

## **🔥 Next Steps**
✅ You now have a **Load Balancer with Auto Scaling on AWS/GCP**.  
🎯 Next, we can:
- **Monitor performance** with Prometheus & Grafana.  
- **Enable HTTPS** using Let's Encrypt.  
- **Deploy with Terraform for Infrastructure-as-Code.**

🚀 **Let me know what you want next!** 🔥