from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any, List, Dict

from .model_utils import (
    train_sample_classifier,
    train_prophet_model,
    train_anomaly_detector,
    load_sentence_model,
    forecast_prophet,
)

app = FastAPI(title='NeureCore Model Runner')


class FeaturesPayload(BaseModel):
    features: Dict[str, Any]


class ForecastPayload(BaseModel):
    periods: int = 30


class AnomalyPayload(BaseModel):
    vectors: List[List[float]]


class EmbedPayload(BaseModel):
    texts: List[str]


@app.on_event('startup')
async def startup_event():
    # Train/load demo models
    app.state.classifier = train_sample_classifier()
    app.state.prophet = train_prophet_model()
    app.state.anomaly = train_anomaly_detector()
    try:
        app.state.embedder = load_sentence_model()
    except Exception:
        app.state.embedder = None


@app.get('/health')
async def health():
    return {'status': 'ok'}


@app.post('/score')
async def score(payload: FeaturesPayload):
    clf = app.state.classifier
    if not clf:
        raise HTTPException(status_code=503, detail='model-unavailable')
    # Convert dict features to numeric vector deterministically
    vals = list(payload.features.values())
    import numpy as np

    try:
        vec = np.array(vals, dtype=float).reshape(1, -1)
    except Exception:
        raise HTTPException(status_code=400, detail='invalid-features')
    pred = clf.predict_proba(vec)[0, 1]
    return {'score': float(pred)}


@app.post('/forecast')
async def forecast(payload: ForecastPayload):
    m = app.state.prophet
    if m is None:
        raise HTTPException(status_code=503, detail='prophet-unavailable')
    res = forecast_prophet(m, periods=payload.periods)
    return res


@app.post('/anomaly')
async def anomaly(payload: AnomalyPayload):
    detector = app.state.anomaly
    import numpy as np

    X = np.array(payload.vectors, dtype=float)
    if X.ndim != 2:
        raise HTTPException(status_code=400, detail='invalid-vectors')
    preds = detector.predict(X)
    scores = detector.decision_function(X)
    return {'labels': preds.tolist(), 'scores': scores.tolist()}


@app.post('/embed')
async def embed(payload: EmbedPayload):
    emb = app.state.embedder
    if emb is None:
        raise HTTPException(status_code=503, detail='embedder-unavailable')
    vectors = emb.encode(payload.texts, show_progress_bar=False)
    return {'vectors': [v.tolist() for v in vectors]}
