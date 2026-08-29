import json
import numpy as np
import xgboost as xgb

from .model_interface import DiabetesModel, PredictionResult


class XGBoostAdapter(DiabetesModel):
    def __init__(self, model_path: str, feature_order_path: str):
        self.model = xgb.XGBClassifier()
        self.model.load_model(model_path)
        with open(feature_order_path) as f:
            self.feature_order = json.load(f)

    def predict(self, record: dict) -> PredictionResult:
        missing = [f for f in self.feature_order if f not in record]
        if missing:
            raise ValueError(f"Missing required fields for prediction: {missing}")

        vector = np.array([[record[col] for col in self.feature_order]])
        prob = float(self.model.predict_proba(vector)[0][1])
        label = "Positive" if prob >= 0.5 else "Negative"

        if prob >= 0.66:
            risk_level = "high"
        elif prob >= 0.33:
            risk_level = "moderate"
        else:
            risk_level = "low"

        return {"label": label, "probability": prob, "risk_level": risk_level}