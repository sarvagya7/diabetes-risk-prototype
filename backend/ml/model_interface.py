from abc import ABC, abstractmethod
from typing import TypedDict


class PredictionResult(TypedDict):
    label: str
    probability: float
    risk_level: str


class DiabetesModel(ABC):
    @abstractmethod
    def predict(self, record: dict) -> PredictionResult:
        ...