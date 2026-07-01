from typing import List, Dict, Any
import numpy as np
import pandas as pd

from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

from pyod.models.iforest import IForest

try:
    from prophet import Prophet
except Exception:
    Prophet = None

from sentence_transformers import SentenceTransformer


def train_sample_classifier() -> Pipeline:
    # Minimal deterministic classifier trained on synthetic data
    X = np.random.RandomState(42).randn(200, 5)
    y = (X.sum(axis=1) > 0).astype(int)
    pipe = Pipeline([('scaler', StandardScaler()), ('clf', LogisticRegression())])
    pipe.fit(X, y)
    return pipe


def train_prophet_model() -> Any:
    if Prophet is None:
        return None
    # Synthetic time-series for demo
    rng = pd.date_range(end=pd.Timestamp.now(), periods=100, freq='D')
    y = 100 + np.sin(np.linspace(0, 6.28, len(rng))) * 5 + np.random.RandomState(0).randn(len(rng))
    df = pd.DataFrame({'ds': rng, 'y': y})
    m = Prophet()
    m.fit(df)
    return m


def train_anomaly_detector() -> IForest:
    X = np.random.RandomState(1).randn(300, 4)
    clf = IForest()
    clf.fit(X)
    return clf


def load_sentence_model(name: str = 'all-MiniLM-L6-v2') -> SentenceTransformer:
    return SentenceTransformer(name)


def forecast_prophet(m, periods: int = 30) -> Dict[str, Any]:
    import pandas as pd
    if m is None:
        return {'error': 'prophet-unavailable'}
    future = m.make_future_dataframe(periods=periods)
    fc = m.predict(future)
    return {'forecast': fc[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(periods).to_dict(orient='records')}
