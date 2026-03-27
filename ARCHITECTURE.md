# Architecture


<img width="706" height="536" alt="Screenshot 2026-03-27 140731" src="https://github.com/user-attachments/assets/2a6a91ab-32aa-4065-9b86-047c78be8413" />

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

