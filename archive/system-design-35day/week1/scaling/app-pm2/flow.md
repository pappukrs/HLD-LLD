### **PM2 Scaling in Node.js** 🚀  
**PM2 (Process Manager 2)** is a process manager for Node.js applications. It allows you to **run, monitor, and scale** your app efficiently in a **production environment**.

One of its powerful features is **clustering**, which allows **horizontal scaling** by utilizing all CPU cores on a machine.

---

## **⚡ Why Use PM2 for Scaling?**
1. **Multi-core utilization**: Runs multiple instances of your app across CPU cores.  
2. **Automatic restarts**: If your app crashes, PM2 restarts it automatically.  
3. **Zero downtime reload**: Updates without stopping traffic flow.  
4. **Logging & Monitoring**: Provides real-time logs, error tracking, and monitoring.

---

## **📌 Step 1: Install PM2**
First, install **PM2 globally**:
```sh
npm install -g pm2
```

Verify installation:
```sh
pm2 -v
```

---

## **📌 Step 2: Create a Simple Express Server**
Create a `server.js` file:

```javascript
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Hello, PM2 Scaling!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## **📌 Step 3: Start Your App with PM2**
Run your Node.js application using PM2:

```sh
pm2 start server.js
```
By default, this runs **one instance**.

---

## **📌 Step 4: Scale Your App with PM2**
To run your app on all available CPU cores (e.g., 4 cores):
```sh
pm2 start server.js -i max
```
or specify the number of instances:
```sh
pm2 start server.js -i 4
```
This will start **4 instances** of `server.js`, making use of 4 CPU cores.

To check running processes:
```sh
pm2 list
```

---

## **📌 Step 5: Load Balancing with PM2**
PM2 automatically balances the load across all running instances using **Round Robin**.

To enable the built-in load balancer, use **cluster mode**:
```sh
pm2 start server.js -i max --name my-app --watch
```
- `-i max` → Runs on all available CPU cores.
- `--name my-app` → Assigns a custom name.
- `--watch` → Restarts on file changes.

---

## **📌 Step 6: Monitor Your App**
PM2 provides real-time monitoring:
```sh
pm2 monit
```
Shows CPU, memory usage, and logs for each instance.

For real-time logs:
```sh
pm2 logs
```

---

## **📌 Step 7: Save & Auto-Start PM2 on System Restart**
To keep PM2 running after system reboots:
```sh
pm2 save
pm2 startup
```
This ensures that your app **automatically starts** on system reboot.

---

## **📌 Step 8: Restart & Stop PM2 Processes**
Restart all instances:
```sh
pm2 restart all
```

Restart a specific app:
```sh
pm2 restart my-app
```

Stop all processes:
```sh
pm2 stop all
```

Delete all processes:
```sh
pm2 delete all
```

---

## **📌 When to Use PM2 Scaling?**
✅ **Best for single-server scaling** (multi-core utilization).  
✅ Works well with **small to medium** applications.  
✅ Great for **production-ready deployments** with **monitoring & auto-restart**.

🚨 **Limitations**:
- PM2 **does not scale across multiple servers**.
- For distributed scaling, **Docker, Kubernetes, or AWS Auto Scaling** is recommended.

---

## **🔥 Summary**
| Feature        | PM2 Scaling |
|---------------|------------|
| **Scales App?** | ✅ Yes (on a single server) |
| **Load Balancing?** | ✅ Yes (built-in) |
| **Multi-Core Support?** | ✅ Yes (Cluster Mode) |
| **Auto-Restart?** | ✅ Yes |
| **Multi-Server Scaling?** | ❌ No (use Kubernetes or AWS) |

If you need **multi-server scaling**, check out **Kubernetes, Docker Swarm, or AWS Auto Scaling**.

Would you like help integrating **PM2 with Nginx or Docker**? 🚀