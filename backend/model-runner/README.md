# Model Runner (Phase 4 — Analytics)

This service runs in-house analytics models and exposes lightweight endpoints for scoring, forecasting, anomaly detection, and embeddings. It uses scikit-learn, Prophet, pyod and sentence-transformers.

Run locally (recommended inside virtualenv):

```bash
cd backend/model-runner
python -m venv .venv
source .venv/bin/activate    # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

Docker build & run:

```bash
cd backend/model-runner
docker build -t neurecore-model-runner:local .
docker run -p 8080:8080 neurecore-model-runner:local
```

Endpoints:
- `GET /health` — health check
- `POST /score` — accepts JSON features -> returns model score
- `POST /forecast` — accepts timeseries JSON -> returns forecast
- `POST /anomaly` — detect anomalies on numeric vectors
- `POST /embed` — returns sentence-transformers embeddings for supplied texts
