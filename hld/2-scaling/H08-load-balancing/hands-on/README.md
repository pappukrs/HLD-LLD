# H08 hands-on: load balancers you can run

These folders back up **How it works §2 (algorithms), §3 (health checks) and §6 (Kubernetes)** in the [concept README](../README.md). Some of the old files are notes with the code inside them rather than finished apps; the table says which.

| Path | What it is | State |
|---|---|---|
| [proxy-reverse-proxy-load-balancer/](proxy-reverse-proxy-load-balancer/flow.md) | Three tiny Express apps: a forward proxy (`proxy-server/proxy.js`), a path-based reverse proxy (`reverse-proxy/reverse-proxy.js` with `server1/`, `server2/`), and a hand-written round-robin balancer (`load-balancer/load-balancer.js`) | Runnable (the reverse-proxy backends exist; `backend-servers/*.js` are empty, reuse `reverse-proxy/server1` and `server2`) |
| [load-balancer-demo/](load-balancer-demo/implementation.md) | Nginx `upstream` with 3 Node servers, plus `k8s/` Deployment and `LoadBalancer` Service | Skeleton: `nginx/nginx.conf` and `k8s/*.yaml` are filled, the server files and `docker-compose.yml` are empty. Copy the code from [flow.md](flow.md) "Activity: Set Up an NGINX Load Balancer" |
| [flow.md](flow.md) | DNS vs software vs hardware LBs, round robin / least-conn / IP hash, and the Nginx + Docker Compose activity | Notes with full code |
| [kubernets-load-balacing.md](kubernets-load-balacing.md) | ClusterIP, `type: LoadBalancer`, Ingress (L7) | Notes |
| [auto-scaling-kubernets.md](auto-scaling-kubernets.md) | HPA on CPU with a CPU-burning Node app and a load generator | Notes with full code |
| [Combine.md](Combine.md) | flow.md + both Kubernetes notes in one file | Notes |
| [load-balancer-demo/aws-gcp-deployment.md](load-balancer-demo/aws-gcp-deployment.md) | The Kubernetes setup on AWS EKS or Google GKE | Notes |

## Run: the hand-written round-robin balancer (no Docker)

```bash
cd proxy-reverse-proxy-load-balancer/reverse-proxy
npm install express http-proxy-middleware   # package.json does not list them
node server1/server1.js &   # :5001
node server2/server2.js &   # :5002
cd ../load-balancer && npm install express && node load-balancer.js   # :3000
for i in 1 2 3 4; do curl -s localhost:3000; echo; done       # alternates server 1 / server 2
```

Observe: requests alternate. Kill `server2` and call again: round robin still picks it every second time and you get `500`. That is why real balancers need **health checks** (§3). Add a `GET /health` probe every 5 s that removes a dead server, as an exercise.

## Run: Nginx in front of three servers (Docker)

Create `server1/server1.js` ... `server3/server3.js`, the Dockerfiles and `docker-compose.yml` from flow.md, then:

```bash
cd load-balancer-demo
docker compose up --build
for i in $(seq 6); do curl -s localhost; echo; done
```

Observe:

1. With the default `upstream`, responses rotate 1, 2, 3 (round robin).
2. `nginx/nginx.conf` uses `ip_hash;` (the comment in it wrongly says least connections). With `ip_hash` every curl from your machine lands on the **same** server: sticky routing.
3. Change it to `least_conn;`, add a `setTimeout` of 3 s to one server, fire 20 parallel requests (`seq 20 | xargs -P20 -I{} curl -s localhost`) and see the slow server get fewer.
4. `docker compose stop server2` and keep curling: Nginx's passive check (`max_fails`, `fail_timeout`) skips it after a failure.

## Run: Kubernetes

Follow [auto-scaling-kubernets.md](auto-scaling-kubernets.md) with minikube or kind: apply the Deployment and the `LoadBalancer` Service, enable `metrics-server`, create the HPA (`kubectl autoscale deployment ... --cpu-percent=50 --min=2 --max=10`), then run the load generator and `kubectl get hpa -w`. You will see replicas climb as CPU passes the target, and fall a few minutes after the load stops.
