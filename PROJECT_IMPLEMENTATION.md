# Project Implementation: From Fullstack App to Kubernetes

## Overview

This document describes the process of transforming a traditional fullstack web application
into a containerized, orchestrated application running on Kubernetes (k3s) on a Raspberry Pi 5.

---

## 1. Starting Point — Traditional Fullstack Application

The original project was a Task Tracker web application built with:

- **Frontend**: React (Vite), runs on `localhost:5173`
- **Backend**: Express.js (Node.js), provided by teacher, runs on `localhost:3010`
- **Database**: SQLite — a file-based database embedded in the backend process

### Problems with this setup

- Everything runs on one machine as plain processes
- SQLite is tied to the backend process — impossible to scale or persist properly in containers
- No isolation between components
- No fault tolerance — if the process crashes, it stays down until manually restarted
- "Works on my machine" problem — no guaranteed consistency across environments

---

## 2. Step 1 — Database Migration: SQLite to PostgreSQL

Before containerizing, the database had to be replaced.

**Why**: SQLite stores data as a file inside the same process. In Kubernetes, pods are ephemeral —
they can be killed and replaced at any time. A file-based database inside a container would lose
all data on every restart. PostgreSQL runs as a separate networked service, which allows:

- The backend to be stateless (it only reads/writes over the network)
- The database to have its own persistent storage
- Independent scaling and lifecycle management

**Changes made**:
- Backend dependencies updated: `sqlite3` replaced with `pg` (node-postgres)
- SQL queries updated for PostgreSQL syntax
- Database schema defined in an init script (`init.sql`) that runs on first startup
- Connection configured via environment variables (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)

---

## 3. Step 2 — Containerization with Docker

Both the frontend and backend were packaged into Docker container images.

### Backend Dockerfile

Single-stage build using `node:20-alpine`:

```
node:20-alpine
  └── npm install --only=production
  └── COPY server.js
  └── EXPOSE 3010
```

Alpine Linux was chosen to keep the image small (~50MB).

### Frontend Dockerfile

Multi-stage build:

```
Stage 1: node:20-alpine (build)
  └── npm ci
  └── npm run build  →  produces /app/dist (static files)

Stage 2: nginx:alpine (serve)
  └── COPY dist/ → /usr/share/nginx/html
  └── COPY nginx.conf
  └── EXPOSE 80
```

Multi-stage builds are important here: the final image contains only nginx and the compiled
static files, not Node.js, npm, or source code. This keeps the image small and the attack
surface minimal.

### nginx.conf

The nginx configuration proxies `/api/` requests to the backend service:

```nginx
location /api/ {
    proxy_pass http://backend:3010;
}
```

This means the browser only needs to talk to one host — nginx handles routing.

### Images

Images are built natively on the Raspberry Pi 5 (ARM64 architecture) and pushed to
GitHub Container Registry (ghcr.io):

```
ghcr.io/karppimc/kubernetes-task/backend:latest
ghcr.io/karppimc/kubernetes-task/frontend:latest
```

Building natively on ARM64 avoids slow QEMU cross-compilation that would be needed
if building on a standard x86 machine.

---

## 4. Step 3 — Kubernetes on Raspberry Pi 5 (k3s)

### Infrastructure

- **Hardware**: Raspberry Pi 5
- **OS**: Raspberry Pi OS (64-bit, Debian-based)
- **Kubernetes distribution**: k3s — a lightweight, single-binary Kubernetes designed for
  edge computing, IoT, and resource-constrained environments
- **Container runtime**: containerd (built into k3s)
- **Ingress controller**: Traefik (built into k3s)

### Pi Setup Notes

k3s requires cgroup memory support, which is not enabled by default on Raspberry Pi OS.
Fix applied to `/boot/firmware/cmdline.txt`:

```
cgroup_memory=1 cgroup_enable=memory
```

Without this, k3s fails with: `failed to find memory cgroup (v2)`

### Kubernetes Architecture

```
Internet / Local Network
        │
        ▼
  Traefik Ingress (port 80)
  192.168.1.196
        │
        ├── /api  ──────────► backend Service (ClusterIP :3010)
        │                            │
        │                            ▼
        │                     backend Deployment
        │                     (1-5 pods, HPA managed)
        │                            │
        │                            ▼
        │                     postgres Service (ClusterIP :5432)
        │                            │
        │                            ▼
        │                     postgres StatefulSet (1 pod)
        │                            │
        │                            ▼
        │                     PersistentVolumeClaim (1Gi)
        │
        └── /     ──────────► frontend Service (NodePort :80)
                                      │
                                      ▼
                               frontend Deployment
                               (1 pod, nginx)
```

### Kubernetes Components Explained

| Component | Resource | Purpose |
|---|---|---|
| `Deployment` | backend, frontend | Manages pod lifecycle, rolling updates, desired replica count |
| `StatefulSet` | postgres | Stable network identity and persistent storage for the database |
| `PersistentVolumeClaim` | postgres-pvc | Reserves 1Gi of disk — data survives pod restarts |
| `Service` (ClusterIP) | backend, postgres | Internal DNS-based routing between pods |
| `Service` (NodePort) | frontend | Exposes the app on port 30080 externally |
| `Ingress` | task-tracker-ingress | Single entry point; routes `/api` to backend, `/` to frontend |
| `ConfigMap` | backend-config, postgres-init | Non-sensitive configuration (DB host, port, init SQL) |
| `Secret` | postgres-secret | Database credentials stored as base64-encoded Kubernetes secret |
| `HorizontalPodAutoscaler` | backend-hpa | Scales backend pods (1–5) based on CPU utilization (target: 50%) |
| `metrics-server` | kube-system | Provides CPU/RAM metrics to the HPA controller |

### Secrets Handling

Database credentials are stored in a Kubernetes Secret, not in source code or ConfigMaps.
The `secret.yaml` file is gitignored — a `secret.example.yaml` template is committed instead.
Pods reference secret values via `secretKeyRef`:

```yaml
env:
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: postgres-secret
        key: POSTGRES_PASSWORD
```

---

## 5. Step 4 — Monitoring with Prometheus and Grafana

Monitoring was added using the `kube-prometheus-stack` Helm chart, which installs:

- **Prometheus** — scrapes metrics from all pods and Kubernetes components automatically
- **Grafana** — visualizes metrics with pre-built Kubernetes dashboards
- **kube-state-metrics** — exposes cluster-level metrics (pod status, resource requests/limits)
- **node-exporter** — exposes host-level metrics (Pi CPU, RAM, disk, temperature)

### Deployment

Installed via Helm into a dedicated `monitoring` namespace (isolated from the application):

```bash
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace \
  --set alertmanager.enabled=false \
  --set nodeExporter.enabled=true
```

Grafana is exposed permanently via NodePort on port `32000`:

```
http://192.168.1.196:32000
```

### Key Dashboards

- **Kubernetes / Compute Resources / Namespace (Pods)** — CPU and memory per pod in real time
- **Kubernetes / Compute Resources / Node** — Raspberry Pi host resource usage
- **Kubernetes / Networking** — network traffic between pods

---

## 6. Deployment Workflow

Since the repository is public and self-hosted GitHub Actions runners pose a security risk
with public repos, a simple manual workflow is used:

**On development machine (code changes):**
```bash
git add .
git commit -m "description"
git push
```

**On Raspberry Pi (deploy):**
```bash
cd ~/Kubernetes-Task
git pull

# If frontend/backend code changed, rebuild and push the image:
docker build -t ghcr.io/karppimc/kubernetes-task/frontend:latest ./Frontend
docker push ghcr.io/karppimc/kubernetes-task/frontend:latest
kubectl rollout restart deployment/frontend

# If only Kubernetes manifests changed:
kubectl apply -f manifests/
```

---

## 7. Challenges Encountered

| Challenge | Root Cause | Solution |
|---|---|---|
| k3s failed to start | cgroup memory not enabled in Pi OS boot config | Added `cgroup_memory=1 cgroup_enable=memory` to `/boot/firmware/cmdline.txt` |
| GitHub Actions build took 30+ minutes | QEMU emulation for ARM64 cross-compilation | Built Docker images natively on the Pi instead |
| CI/CD abandoned | Self-hosted runners are a security risk on public repos | Manual deploy workflow via git pull + docker build |
| Backend couldn't connect to database | PostgreSQL Service manifest was not applied | Applied `Database/manifests/service.yaml` |
| kubectl using system config instead of user config | k3s sets `/etc/rancher/k3s/k3s.yaml` as default | Set `KUBECONFIG=~/.kube/config` in `.bashrc` |

---

## 8. Key Kubernetes Concepts Demonstrated

- **Self-healing**: Kubernetes automatically restarts crashed pods (Deployment controller)
- **Horizontal scaling**: HPA scales backend pods 1→5 based on CPU load
- **Persistent storage**: PostgreSQL data survives pod restarts via PersistentVolumeClaim
- **Service discovery**: Pods communicate by service name (e.g. `postgres`, `backend`) via cluster DNS
- **Configuration separation**: App config in ConfigMaps, secrets in Secrets — nothing hardcoded
- **Rolling updates**: `kubectl rollout restart` updates pods one at a time with zero downtime
- **Namespace isolation**: Monitoring stack in `monitoring` namespace, app in `default`
- **Resource management**: CPU/memory requests and limits defined for all containers
- **Ingress routing**: Single IP handles routing to multiple services based on URL path
