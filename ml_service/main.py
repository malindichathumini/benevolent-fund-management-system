"""
FastAPI prediction service for the Impact_Level classifier (Thesis Section
4.6 / 4.8). Loads the trained Random Forest + XGBoost bundle from
ml/impact_model_v2.joblib and exposes POST /predict, as specified in the
Technology Selection table (Section 4.8): "Established, interpretable
ensemble classifiers ... served via FastAPI endpoint (POST /predict)."

v2 (2026-10-18): points at impact_model_v2.joblib - retrained on the new
4-category organization_type taxonomy (Local NGO / Government-Affiliated
Fund / Religious-Faith-Based Organization / Community-Based Organization),
replacing the old Local NGO / International NGO split the original
91-org NGOSEC-trained impact_model.joblib used. See
demo_dataset/v2/train_new_model.py for how this bundle was trained, and
ml/impact_model.joblib (kept alongside, untouched) for the original.

Always returns BOTH models' predictions (model_comparison), with the
top-level fields mirroring whichever model the bundle names as
selected_model (Random Forest, by cross-validated accuracy) - this is
what backend/src/services/mlService.ts and routes/disbursements.ts
already expect back from this endpoint.

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Then POST to http://localhost:8000/predict, e.g.:
    {
      "organization_type": "Local NGO",
      "sector": "Child welfare",
      "cost_inflow_lkr": 5000000,
      "beneficiaries_estimate": 150
    }
"""
from pathlib import Path
from typing import Literal

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

MODEL_PATH = Path(__file__).resolve().parent.parent / "ml" / "impact_model_v2.joblib"

bundle = joblib.load(MODEL_PATH)
MODELS = bundle["models"]  # {"Random Forest": pipeline, "XGBoost": pipeline}
SELECTED_MODEL = bundle["selected_model"]  # "Random Forest" - the one used for live decisions
CLASSES = bundle["classes"]
VALID_SECTORS = [
    "Child welfare", "Education", "Emergency relief", "Environment",
    "Governance / human rights", "Health", "Livelihoods",
    "Multi-sector relief & welfare", "Peacebuilding", "Poverty alleviation",
    "Religious / community welfare", "WASH / infrastructure",
]
VALID_ORG_TYPES = [
    "Local NGO",
    "Government-Affiliated Fund",
    "Religious / Faith-Based Organization",
    "Community-Based Organization (CBO)",
]

app = FastAPI(
    title="Benevolent Fund Impact Classifier",
    description="Predicts the likely Impact_Level (Low/Medium/High) of a "
                 "disbursement. Trained (v2) on a synthetic corpus matching "
                 "the project's current 4-category organization_type "
                 "taxonomy (Thesis Section 4.7, pending rewrite).",
    version="0.2.0",
)

# The Node/Express backend runs on a different origin during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to the real frontend/backend origin before production use
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class DisbursementRequest(BaseModel):
    organization_type: Literal[
        "Local NGO",
        "Government-Affiliated Fund",
        "Religious / Faith-Based Organization",
        "Community-Based Organization (CBO)",
    ]
    sector: str = Field(..., description=f"One of: {', '.join(VALID_SECTORS)}")
    cost_inflow_lkr: float = Field(..., gt=0, description="Disbursement / fund inflow amount in LKR")
    beneficiaries_estimate: float = Field(..., gt=0, description="Estimated number of beneficiaries for this disbursement")


class ModelPrediction(BaseModel):
    predicted_impact_level: str
    class_probabilities: dict[str, float]


class PredictionResponse(BaseModel):
    # Top-level fields always reflect the SELECTED model (Random Forest),
    # kept for callers that only read these rather than model_comparison.
    predicted_impact_level: str
    class_probabilities: dict[str, float]
    beneficiaries_per_lkr: float
    selected_model: str
    model_comparison: dict[str, ModelPrediction]


@app.get("/health")
def health():
    return {"status": "ok"}


def _predict_one(name: str, row: pd.DataFrame) -> ModelPrediction:
    pipeline = MODELS[name]
    pred = pipeline.predict(row)[0]
    proba = pipeline.predict_proba(row)[0]
    class_order = pipeline.named_steps["clf"].classes_
    # XGBoost's classes_/predictions are integer codes (0/1/2) matched to
    # CLASSES order; Random Forest's are already the string labels.
    is_coded = not isinstance(class_order[0], str)
    labels = [CLASSES[int(c)] for c in class_order] if is_coded else list(class_order)
    pred_label = CLASSES[int(pred)] if is_coded else pred
    return ModelPrediction(
        predicted_impact_level=pred_label,
        class_probabilities={c: round(float(p), 4) for c, p in zip(labels, proba)},
    )


@app.post("/predict", response_model=PredictionResponse)
def predict(req: DisbursementRequest):
    if req.sector not in VALID_SECTORS:
        raise HTTPException(status_code=422, detail=f"Unknown sector. Must be one of: {VALID_SECTORS}")

    beneficiaries_per_lkr = req.beneficiaries_estimate / req.cost_inflow_lkr
    row = pd.DataFrame([{
        "organization_type": req.organization_type,
        "sector": req.sector,
        "cost_inflow_lkr": req.cost_inflow_lkr,
        "beneficiaries_per_lkr": beneficiaries_per_lkr,
    }])

    comparison = {name: _predict_one(name, row) for name in MODELS}
    selected = comparison[SELECTED_MODEL]

    return PredictionResponse(
        predicted_impact_level=selected.predicted_impact_level,
        class_probabilities=selected.class_probabilities,
        beneficiaries_per_lkr=round(beneficiaries_per_lkr, 8),
        selected_model=SELECTED_MODEL,
        model_comparison=comparison,
    )
