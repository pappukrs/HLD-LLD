# H06 hands-on: one Node API behind four gateways

Each folder puts the same tiny Express service (`GET /api/data` on port 3000) behind a different reverse proxy or gateway, using Docker Compose. Run them one at a time and compare how much config each needs for the same result. This backs up **How it works §2 and §3** in the [concept README](../README.md).

| Folder | Front door | Port | What it shows |
|---|---|---|---|
| [app-nginx/](app-nginx/) | Nginx `proxy_pass` | 80 | Plain reverse proxy: one public port, the API has no published port |
| [app-kong/](app-kong/) | Kong (declarative `kong/kong.yml`) | 8000 (proxy), 8001 (admin) | Gateway with services + routes; plugins for key-auth and rate limiting |
| [app-express-gateway/](app-express-gateway/) | Express Gateway (`gateway/gateway.config.yml`) | 8080 | Gateway as config: apiEndpoints → pipelines → policies (`proxy`) |
| [app-aws/](app-aws/) | AWS API Gateway emulated by LocalStack | 4566 | Managed gateway: create a REST API, integrate, deploy a stage |

Background reading in this folder: [doc.md](doc.md) (per-gateway notes) and [flow.md](flow.md) (Kong walkthrough: register a service, add a route, key-auth, upstream load balancing).

## Run

```bash
cd app-nginx                 # or app-kong, app-express-gateway, app-aws
docker compose up --build
curl -i http://localhost/api/data          # nginx
curl -i http://localhost:8000/api/data     # kong
curl -i http://localhost:8080/api/data     # express gateway
docker compose down
```

No `npm install` is needed on the host: each Dockerfile installs inside the image.

## What to observe

1. **The API is not exposed.** `node-api` has no `ports:` entry in any compose file. Only the proxy is reachable. That is "a reverse proxy hides the servers".
2. **Headers added by the proxy.** Log `req.headers` in `server.js` and look for `x-forwarded-for` and `x-real-ip` (add `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` to the Nginx config to see it).
3. **Kong plugins stop requests at the edge.** Follow [flow.md](flow.md): enable `key-auth`, call without the `apikey` header and get `401` from Kong itself. Enable `rate-limiting` with `config.minute=5` and get `429` on the 6th call. The Node service never logs those requests.
4. **Upstream load balancing.** In flow.md, add two targets to a Kong upstream and watch requests alternate.
5. **AWS (LocalStack).** Create the API with `awslocal apigateway create-rest-api --name NodeAPI`, add a resource and an HTTP integration to `node-api`, then `create-deployment --stage-name prod`. Same idea as Kong, but the gateway is a managed service you configure by API.

## Known gotchas in these folders

- `app-kong/docker-compose.yml` sets `KONG_DATABASE: postgres` but mounts a declarative file. Either run `kong migrations bootstrap` first, or switch to DB-less mode: `KONG_DATABASE: "off"` and `KONG_DECLARATIVE_CONFIG: /usr/local/kong/declarative/kong.yml`.
- `app-kong/node-api/` has no `package.json`, so its image build fails. Copy one from `app-nginx/node-api/package.json`.
- `app-aws` only starts LocalStack and the API; the gateway resources must be created with `awslocal` commands (see doc.md, "README for AWS API Gateway").
