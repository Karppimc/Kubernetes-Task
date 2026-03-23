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

> The Kubernetes workloads and services inside the cluster.

```mermaid
graph TD
    User["👤 User\n(Browser)"]

    subgraph pi ["Raspberry Pi 5 — k3s Kubernetes Cluster"]

        subgraph ns_default ["Namespace: default"]
            Ingress["Traefik Ingress\nport 80\nRoutes traffic by URL path"]

            subgraph frontend_group ["Frontend"]
                FE["Frontend Pod\nnginx:alpine\nServes React SPA"]
                FE_SVC["Service\nNodePort :30080"]
            end

            subgraph backend_group ["Backend"]
                BE["Backend Pod\nnode:20-alpine\nExpress.js REST API"]
                BE_SVC["Service\nClusterIP :3010"]
                HPA["HorizontalPodAutoscaler\n1–5 replicas\nCPU target: 50%"]
            end

            subgraph db_group ["Database"]
                DB["PostgreSQL Pod\npostgres:16\nStatefulSet"]
                DB_SVC["Service\nClusterIP :5432"]
                PVC["PersistentVolumeClaim\n1Gi storage"]
            end

            CM_BE["ConfigMap\nbackend-config"]
            CM_DB["ConfigMap\npostgres-init\n(init.sql)"]
            SEC["Secret\npostgres-secret\n(credentials)"]
        end

        subgraph ns_monitoring ["Namespace: monitoring"]
            PROM["Prometheus\nMetrics collection"]
            GRAF["Grafana\nNodePort :32000\nDashboards"]
            KSM["kube-state-metrics\nCluster metrics"]
            NE["node-exporter\nHost metrics (Pi)"]
        end

    end

    User -->|"HTTP :80"| Ingress
    Ingress -->|"path: /"| FE_SVC --> FE
    Ingress -->|"path: /api"| BE_SVC --> BE
    BE --> DB_SVC --> DB
    DB --> PVC
    HPA -.->|"scales"| BE
    CM_BE -.->|"env config"| BE
    CM_DB -.->|"init script"| DB
    SEC -.->|"credentials"| BE
    SEC -.->|"credentials"| DB

    PROM -->|"scrapes metrics"| BE
    PROM -->|"scrapes metrics"| FE
    PROM -->|"scrapes metrics"| DB
    KSM -->|"cluster metrics"| PROM
    NE -->|"host metrics"| PROM
    PROM --> GRAF

    User -->|"HTTP :32000"| GRAF
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
