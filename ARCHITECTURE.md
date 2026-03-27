# Architecture

## Context

> Who uses the system and how it fits into the world.

```mermaid
graph TD
    User["👤 User\n(Browser)"]
    System["Task Tracker\nRunning on Raspberry Pi 5\nvia k3s Kubernetes"]
    GHCR["GitHub Container Registry\nghcr.io\n(Docker images)"]

    User -->|"HTTP requests\n192.168.1.196"| System
    GHCR -->|"Image pulls\non deploy"| System
```

---

## Container

> The Kubernetes workloads and services inside the cluster, distributed across two nodes.

```mermaid
graph TD
    User["👤 User\n(Browser)"]
    GHCR["GitHub Container Registry\nghcr.io"]

    subgraph cluster["k3s Kubernetes Cluster"]

        subgraph node1["kubepi — Control Plane (192.168.1.196)"]

            Ingress["Traefik Ingress :80\nRoutes traffic by URL path"]

            subgraph db_group["PostgreSQL"]
                DB["StatefulSet\npostgres:16"]
                DB_SVC["Service ClusterIP :5432"]
                PVC["PersistentVolumeClaim 1Gi"]
                CM_DB["ConfigMap: init.sql"]
                SEC["Secret: credentials"]
            end

            subgraph ns_monitoring["Monitoring namespace"]
                PROM["Prometheus\nMetrics scraper"]
                GRAF["Grafana NodePort :32000"]
                KSM["kube-state-metrics"]
                NE["node-exporter"]
            end

        end

        subgraph node2["kubepi2 — Worker (192.168.1.46)"]

            subgraph back_group["Backend"]
                BE["Deployment\nnode:20-alpine\n1–5 pods"]
                BE_SVC["Service ClusterIP :3010"]
                HPA["HorizontalPodAutoscaler\nCPU target 50%"]
                CM_BE["ConfigMap: backend-config"]
            end

            subgraph front_group["Frontend"]
                FE["Deployment\nnginx:alpine\n1 pod"]
                FE_SVC["Service NodePort :80"]
            end

        end

    end

    User -->|":80"| Ingress
    User -->|":32000"| GRAF
    GHCR -->|"image pull"| BE
    GHCR -->|"image pull"| FE
    Ingress -->|"path: /api"| BE_SVC --> BE
    Ingress -->|"path: /"| FE_SVC --> FE
    BE -->|"postgres:5432"| DB_SVC --> DB --> PVC
    HPA -.->|"scales"| BE
    CM_BE -.->|"env config"| BE
    CM_DB -.->|"init script"| DB
    SEC -.->|"credentials"| BE
    SEC -.->|"credentials"| DB
    PROM -->|"scrapes"| BE
    PROM -->|"scrapes"| FE
    PROM -->|"scrapes"| DB
    KSM --> PROM
    NE --> PROM
    PROM --> GRAF
```

---

## Component

> What is inside each container.

### Frontend (React + nginx)

```mermaid
graph TD
    subgraph nginx ["nginx:alpine"]
        subgraph react ["React SPA (compiled)"]
            App["App.jsx\nRouter"]
            TL["TaskList\nView & filter tasks\nDrag & Drop ordering"]
            TM["TaskManagement\nAdd / edit / delete tasks\nManage tags"]
            TS["TimeSummary\nTime spent per task & tag\nCustom date range"]
            TD["TaskDetails\nActivity intervals\nBar chart (daily usage)\nEdit intervals"]
            AB["About\nProject info"]
        end
        Proxy["nginx proxy\n/api/ → backend:3010"]
    end

    App --> TL
    App --> TM
    App --> TS
    App --> TD
    App --> AB
    TL -->|"fetch /api/tasks"| Proxy
    TM -->|"fetch /api/tasks\n/api/tags"| Proxy
    TS -->|"fetch /api/tasks\n/api/intervals"| Proxy
    TD -->|"fetch /api/intervals"| Proxy
```

### Backend (Express.js)

```mermaid
graph TD
    subgraph node ["node:20-alpine"]
        subgraph express ["Express.js server.js"]
            Router["Router\nport 3010"]
            RT["GET  /api/tasks\nPOST /api/tasks\nPUT  /api/tasks/:id\nDEL  /api/tasks/:id"]
            RI["GET  /api/intervals\nPOST /api/intervals\nPUT  /api/intervals/:id\nDEL  /api/intervals/:id"]
            RTG["GET  /api/tags\nPOST /api/tags"]
            PG["pg client\nConnection pool"]
        end
    end

    Router --> RT --> PG
    Router --> RI --> PG
    Router --> RTG --> PG
    PG -->|"TCP :5432"| DB[("PostgreSQL")]
```

### Database (PostgreSQL)

```mermaid
erDiagram
    tasks {
        serial id PK
        text name
        timestamptz created_at
    }
    tags {
        serial id PK
        text name
    }
    task_tags {
        int task_id FK
        int tag_id FK
    }
    intervals {
        serial id PK
        int task_id FK
        timestamptz start_time
        timestamptz end_time
    }

    tasks ||--o{ task_tags : "has"
    tags  ||--o{ task_tags : "assigned to"
    tasks ||--o{ intervals : "has"
```

---

## Kubernetes Resource Summary

| Resource | Name | Namespace | Purpose |
|---|---|---|---|
| Deployment | frontend | default | Runs nginx + React SPA |
| Deployment | backend | default | Runs Express.js API |
| StatefulSet | postgres | default | Runs PostgreSQL with stable storage |
| Service (NodePort) | frontend | default | Exposes app on port 30080 |
| Service (ClusterIP) | backend | default | Internal access to API on port 3010 |
| Service (ClusterIP) | postgres | default | Internal access to DB on port 5432 |
| Ingress | task-tracker-ingress | default | Routes `/api` → backend, `/` → frontend |
| HorizontalPodAutoscaler | backend-hpa | default | Scales backend 1–5 pods at 50% CPU |
| PersistentVolumeClaim | postgres-pvc | default | 1Gi persistent storage for database |
| ConfigMap | backend-config | default | DB host, port, name env vars |
| ConfigMap | postgres-init | default | SQL init script run at DB startup |
| Secret | postgres-secret | default | DB username and password |
| Helm Release | monitoring | monitoring | Prometheus + Grafana stack |
| Service (NodePort) | monitoring-grafana | monitoring | Exposes Grafana on port 32000 |
