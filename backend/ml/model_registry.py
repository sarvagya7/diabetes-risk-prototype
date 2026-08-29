from pathlib import Path
from .xgboost_adapter import XGBoostAdapter

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"

_active_model = None


def get_active_model():
    global _active_model
    if _active_model is None:
        _active_model = XGBoostAdapter(
            model_path=str(MODELS_DIR / "xgb_v1.json"),
            feature_order_path=str(MODELS_DIR / "feature_order.json"),
        )
    return _active_model