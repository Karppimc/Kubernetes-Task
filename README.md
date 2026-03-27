# Task Tracker — Kubernetes Edition

A **Task Tracker** web application deployed on a 2-node Kubernetes cluster running on Raspberry Pi 5 hardware. Originally a traditional fullstack project, migrated to a fully containerized Kubernetes environment as part of a thesis project.

## Stack

- **Frontend**: React + Vite, served via nginx
- **Backend**: Express.js (Node.js)
- **Database**: PostgreSQL 16
- **Orchestration**: Kubernetes (k3s)
- **Monitoring**: Prometheus + Grafana

## Cluster

| Node | Role | Workloads |
|---|---|---|
| `kubepi` (192.168.1.196) | Control Plane | PostgreSQL, Monitoring |
| `kubepi2` (192.168.1.46) | Worker | Frontend, Backend |

## Features

### Task List
- Start/Stop/Delete tasks
- Filter tasks with tags
- Drag & Drop ordering
  ![image](https://github.com/user-attachments/assets/9082ee28-1529-4f47-bde9-ea0163a76401)

### Task Management
- Add tasks with tags
- Edit/Delete existing tasks
- Filter tasks with tags
  ![image](https://github.com/user-attachments/assets/d9f19f7b-c03d-4b43-ab7d-6ae616a91fba)

### Time Summary
- Time spent per task and tag
- Custom date range filter
  ![image](https://github.com/user-attachments/assets/a85e52a7-fc2e-43dd-bc2a-c6c0400305e6)

### Task Details
- View and edit activity intervals
- Highlight overlapping intervals
- Daily active time bar chart
  ![image](https://github.com/user-attachments/assets/c6837fed-c72e-4153-b926-6b1a8fc7aa52)

## Kubernetes Resources

| Resource | Purpose |
|---|---|
| Deployment (frontend, backend) | Pod lifecycle, rolling updates, self-healing |
| StatefulSet (postgres) | Stable identity and persistent storage for database |
| PersistentVolumeClaim (1Gi) | Database storage that survives pod restarts |
| HorizontalPodAutoscaler | Scales backend 1–5 pods at 50% CPU threshold |
| Ingress (Traefik) | Routes `/api` → backend, `/` → frontend |
| ConfigMap | Non-sensitive configuration |
| Secret | Database credentials (gitignored) |

## Deployment

**Build and push images** (from development machine):
```bash
docker buildx build --platform linux/arm64 \
  -t ghcr.io/karppimc/kubernetes-task/backend:latest --push ./Backend

docker buildx build --platform linux/arm64 \
  -t ghcr.io/karppimc/kubernetes-task/frontend:latest --push ./Frontend
```

**Apply manifests** (on kubepi):
```bash
kubectl apply -f Database/manifests/
kubectl apply -f Backend/manifests/
kubectl apply -f Frontend/manifests/
kubectl apply -f manifests/
```

**Secrets** — copy the template and fill in credentials:
```bash
cp Database/manifests/secret.example.yaml Database/manifests/secret.yaml
```

## Monitoring

Grafana available at `http://192.168.1.196:32000`

Key dashboards:
- Kubernetes / Compute Resources / Namespace (Pods)
- Kubernetes / Compute Resources / Node (Pods)
- Node Exporter / Nodes
