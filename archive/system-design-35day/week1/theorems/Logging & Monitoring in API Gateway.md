# **📅 Day 15: Logging & Monitoring in API Gateway** 📊🔍  

API Gateway **logs** and **monitors** API traffic to detect errors, security threats, and performance issues.  

---

## **📌 Why is Logging & Monitoring Important?**  
✅ Detects **API failures** and **bottlenecks**.  
✅ Helps in **debugging** and **troubleshooting**.  
✅ Ensures **compliance** and **security auditing**.  

---

## **🔹 1️⃣ Access Logs & Request Tracing** 📝  
✅ Logs every API request with details like **IP, latency, status code, user-agent**.  
✅ Useful for **troubleshooting and analytics**.  

### **🔍 Example: Enable Access Logs in Kong API Gateway**  
📍 **Enable Logging Plugin**  
```bash
curl -X POST http://localhost:8001/plugins \
     --data "name=file-log" \
     --data "config.path=/var/log/kong/access.log"
```
✅ Now, **all requests** are logged in `/var/log/kong/access.log`.  

---

## **🔹 2️⃣ Error Tracking & Alerts** 🚨  
✅ Detects **API failures (5xx errors)**.  
✅ Sends **alerts** to **Slack, PagerDuty, or Email**.  

### **🔍 Example: AWS API Gateway with CloudWatch Logs**  
📍 **Enable Logging**  
```bash
aws apigateway update-stage --rest-api-id abc123 --stage-name prod \
    --patch-operations op="replace",path="/logging/loglevel",value="INFO"
```
📍 **Enable CloudWatch Metrics**  
```bash
aws apigateway update-account --patch-operations op="replace",path="/cloudwatchRoleArn",value="arn:aws:iam::123456789012:role/APIGatewayCloudWatchLogsRole"
```
✅ Now, **all API errors** appear in **AWS CloudWatch**.

---

## **🔹 3️⃣ Real-time Monitoring & Dashboards** 📊  
✅ Provides **live metrics** like **API latency, error rates, traffic spikes**.  
✅ Tools: **Prometheus, Grafana, AWS CloudWatch, Datadog**.  

### **🔍 Example: API Metrics with Prometheus & Grafana**  
📍 **Expose Metrics in Kong API Gateway**  
```bash
curl -X POST http://localhost:8001/plugins \
     --data "name=prometheus"
```
📍 **Visualize Metrics in Grafana**  
1️⃣ Add **Prometheus** as a data source in **Grafana**.  
2️⃣ Create **API traffic and latency dashboards**.  
✅ Now, you can **monitor API health in real time**!  

---

## **🔹 4️⃣ Distributed Tracing with Jaeger & OpenTelemetry** 🔬  
✅ Traces **API requests across microservices**.  
✅ Helps **identify slow APIs** and **bottlenecks**.  

### **🔍 Example: Enable Tracing in NGINX API Gateway**  
📍 **Enable OpenTracing with Jaeger**  
```nginx
load_module modules/ngx_http_opentracing_module.so;

http {
    opentracing on;
    opentracing_trace_locations on;
    opentracing_tag "gateway" "nginx";
}
```
✅ Now, **API requests are traced** in **Jaeger UI**.  

---

## **📌 Summary**  
📝 **Access Logs** – Track **every API request**.  
🚨 **Error Alerts** – Detect **failures & notify teams**.  
📊 **Real-time Monitoring** – Use **Prometheus, Grafana, CloudWatch**.  
🔬 **Distributed Tracing** – Debug **latency issues with Jaeger**.  

🚀 **Next Topic: API Gateway Performance Optimization?**