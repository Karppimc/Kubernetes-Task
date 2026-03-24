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

Images are built on the development machine (Windows x86_64) using Docker Buildx with
cross-compilation targeting `linux/arm64`, then pushed to GitHub Container Registry (ghcr.io):

```bash
docker buildx build --platform linux/arm64 \
  -t ghcr.io/karppimc/kubernetes-task/backend:latest --push ./Backend

docker buildx build --platform linux/arm64 \
  -t ghcr.io/karppimc/kubernetes-task/frontend:latest --push ./Frontend
```

```
ghcr.io/karppimc/kubernetes-task/backend:latest
ghcr.io/karppimc/kubernetes-task/frontend:latest
```

Docker Buildx uses QEMU emulation to cross-compile ARM64 images on an x86 host. The backend
build completes in ~33 seconds. The frontend takes ~77 seconds due to the `npm ci` step running
under emulation. The Pi nodes pull the final ARM64 images directly from ghcr.io at deploy time.

---

## 4. Step 3 — Kubernetes Cluster on Raspberry Pi 5 (k3s)

### Infrastructure

The cluster consists of two Raspberry Pi 5 nodes:

| Node | IP | Role | Workloads |
|---|---|---|---|
| `kubepi` | 192.168.1.196 | Control plane | PostgreSQL (StatefulSet) |
| `kubepi2` | 192.168.1.46 | Worker | Backend, Frontend |

- **Hardware**: 2× Raspberry Pi 5 (ARM64, 8 GiB RAM each)
- **OS**: Raspberry Pi OS 64-bit (Debian-based)
- **Kubernetes distribution**: k3s — a lightweight, single-binary Kubernetes designed for
  edge computing, IoT, and resource-constrained environments
- **Container runtime**: containerd (built into k3s)
- **Ingress controller**: Traefik (built into k3s)

### Node Setup

k3s requires cgroup memory support, which is not enabled by default on Raspberry Pi OS.
Required fix on **both nodes** before installing k3s — applied to `/boot/firmware/cmdline.txt`:

```
cgroup_memory=1 cgroup_enable=memory
```

Without this, k3s fails to start with: `failed to find memory cgroup (v2)`

**Control plane (kubepi):** k3s server installed normally:
```bash
curl -sfL https://get.k3s.io | sh -
```

**Worker node (kubepi2):** k3s agent joined to the cluster using a node token from the control plane:
```bash
curl -sfL https://get.k3s.io | \
  K3S_URL=https://192.168.1.196:6443 \
  K3S_TOKEN=<node-token> sh -
```

### Node Scheduling — Node Selectors

Workloads are pinned to specific nodes using `nodeSelector` in each manifest.
This demonstrates intentional workload placement — a key Kubernetes concept:

```yaml
# Database stays on control plane node (stable, persistent)
spec:
  nodeSelector:
    kubernetes.io/hostname: kubepi

# Application pods run on the worker node
spec:
  nodeSelector:
    kubernetes.io/hostname: kubepi2
```

Result verified with `kubectl get pods -o wide`:
```
NAME                       NODE
backend-79664b5565-sh68c   kubepi2
frontend-f44ff6c45-jks4f   kubepi2
postgres-0                 kubepi
```

### Kubernetes Architecture

```
Local Network
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│  kubepi (192.168.1.196) — Control Plane                         │
│                                                                  │
│  Traefik Ingress (:80)                                           │
│       ├── /api ──► backend Service (ClusterIP :3010) ──────────►│──┐
│       └── /    ──► frontend Service (NodePort :80)  ──────────►│──┤
│                                                                  │  │
│  postgres Service (ClusterIP :5432)                              │  │
│       └── postgres StatefulSet (pod)                            │  │
│              └── PersistentVolumeClaim (1Gi)                    │  │
└─────────────────────────────────────────────────────────────────┘  │
                                                                      │
┌─────────────────────────────────────────────────────────────────┐  │
│  kubepi2 (192.168.1.46) — Worker Node                           │◄─┘
│                                                                  │
│  backend Deployment (1–5 pods, HPA managed)                     │
│       └── pulls image: ghcr.io/.../backend:latest               │
│                                                                  │
│  frontend Deployment (1 pod, nginx)                             │
│       └── pulls image: ghcr.io/.../frontend:latest              │
└─────────────────────────────────────────────────────────────────┘
```

### Kubernetes Components Explained

| Component | Resource | Purpose |
|---|---|---|
| `Deployment` | backend, frontend | Manages pod lifecycle, rolling updates, desired replica count |
| `StatefulSet` | postgres | Stable network identity and persistent storage for the database |
| `PersistentVolumeClaim` | postgres-pvc | Reserves 1Gi of disk — data survives pod restarts |
| `Service` (ClusterIP) | backend, postgres | Internal DNS-based routing between pods |
| `Service` (NodePort) | frontend | Exposes the app externally |
| `Ingress` | task-tracker-ingress | Single entry point; routes `/api` to backend, `/` to frontend |
| `ConfigMap` | backend-config, postgres-init | Non-sensitive configuration (DB host, port, init SQL) |
| `Secret` | postgres-secret | Database credentials — never stored in source code or git |
| `HorizontalPodAutoscaler` | backend-hpa | Scales backend pods (1–5) based on CPU utilization (target: 50%) |
| `metrics-server` | kube-system | Provides CPU/RAM metrics to the HPA controller |
| `nodeSelector` | all workloads | Pins each workload to the correct node |

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

GitHub Actions CI/CD with a self-hosted runner was initially planned but abandoned —
self-hosted runners on public repositories are a security risk (forks can run arbitrary
code on the runner). A manual workflow is used instead:

**If application code changed — build on development machine:**
```bash
# Cross-compile for ARM64 and push to registry
docker buildx build --platform linux/arm64 \
  -t ghcr.io/karppimc/kubernetes-task/backend:latest --push ./Backend

docker buildx build --platform linux/arm64 \
  -t ghcr.io/karppimc/kubernetes-task/frontend:latest --push ./Frontend
```

**Push manifest/config changes:**
```bash
git add .
git commit -m "description"
git push
```

**Apply on the cluster (Pi 1):**
```bash
cd ~/Kubernetes-Task && git pull

# Restart deployments to pull new images
kubectl rollout restart deployment/backend deployment/frontend

# Or apply updated manifests
kubectl apply -f Backend/manifests/
kubectl apply -f Frontend/manifests/
```

---

## 7. Challenges Encountered

| Challenge | Root Cause | Solution |
|---|---|---|
| k3s failed to start on both nodes | cgroup memory not enabled in Pi OS boot config | Added `cgroup_memory=1 cgroup_enable=memory` to `/boot/firmware/cmdline.txt` on each Pi before installing k3s |
| GitHub Actions build took 30+ minutes | QEMU emulation for ARM64 cross-compilation on hosted runners | Switched to Docker Buildx on development machine — cross-compiles in ~33–77 seconds |
| CI/CD abandoned | Self-hosted runners are a security risk on public GitHub repositories | Manual deploy workflow: build locally, push to ghcr.io, apply on cluster |
| Backend couldn't connect to database after initial deploy | PostgreSQL Service manifest was accidentally skipped during apply | Applied `Database/manifests/service.yaml` — backend could then resolve `postgres` hostname via cluster DNS |
| kubectl using system config instead of user config | k3s sets `/etc/rancher/k3s/k3s.yaml` as default, requires root | Set `KUBECONFIG=~/.kube/config` in `.bashrc`, copied config with correct ownership |
| Worker node SSH access | SSH key not configured on Pi 2, Windows username mismatch | Used `ssh-copy-id`, added `User karppi` to `~/.ssh/config` |

---

## 8. Key Kubernetes Concepts Demonstrated

- **Multi-node cluster**: Two physical nodes (control plane + worker) with workloads distributed across them
- **Node scheduling**: `nodeSelector` pins specific workloads to specific nodes — stateful DB on control plane, stateless app on worker
- **Self-healing**: Kubernetes automatically restarts crashed pods (Deployment controller)
- **Horizontal scaling**: HPA scales backend pods 1→5 based on CPU load
- **Persistent storage**: PostgreSQL data survives pod restarts via PersistentVolumeClaim
- **Service discovery**: Pods communicate by service name (e.g. `postgres`, `backend`) via cluster DNS — works across nodes transparently
- **Configuration separation**: App config in ConfigMaps, secrets in Secrets — nothing hardcoded
- **Rolling updates**: `kubectl rollout restart` updates pods one at a time with zero downtime
- **Namespace isolation**: Monitoring stack in `monitoring` namespace, app in `default`
- **Resource management**: CPU/memory requests and limits defined for all containers
- **Ingress routing**: Single IP handles routing to multiple services based on URL path
