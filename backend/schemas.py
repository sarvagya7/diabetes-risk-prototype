from typing import Optional, Literal
from pydantic import BaseModel
from ml.model_interface import PredictionResult 



class PatientState(BaseModel):
    age: Optional[int] = None
    gender: Optional[int] = None  # 1 = Male, 0 = Female
    polyuria: Optional[int] = None
    polydipsia: Optional[int] = None
    sudden_weight_loss: Optional[int] = None
    weakness: Optional[int] = None
    polyphagia: Optional[int] = None
    genital_thrush: Optional[int] = None
    visual_blurring: Optional[int] = None
    itching: Optional[int] = None
    irritability: Optional[int] = None
    delayed_healing: Optional[int] = None
    partial_paresis: Optional[int] = None
    muscle_stiffness: Optional[int] = None
    alopecia: Optional[int] = None
    obesity: Optional[int] = None
    genital_thrush_skipped: bool = False


# Everything except genital_thrush is mandatory (it's the sensitive, skippable one)
REQUIRED_FIELDS = [
    "age", "gender", "polyuria", "polydipsia", "sudden_weight_loss",
    "weakness", "polyphagia", "visual_blurring", "itching", "irritability",
    "delayed_healing", "partial_paresis", "muscle_stiffness", "alopecia", "obesity",
]


class UpdatedFields(BaseModel):
    """Same shape as PatientState, but every field truly optional (None = 'not mentioned this turn')."""
    age: Optional[int] = None
    gender: Optional[int] = None
    polyuria: Optional[int] = None
    polydipsia: Optional[int] = None
    sudden_weight_loss: Optional[int] = None
    weakness: Optional[int] = None
    polyphagia: Optional[int] = None
    genital_thrush: Optional[int] = None
    visual_blurring: Optional[int] = None
    itching: Optional[int] = None
    irritability: Optional[int] = None
    delayed_healing: Optional[int] = None
    partial_paresis: Optional[int] = None
    muscle_stiffness: Optional[int] = None
    alopecia: Optional[int] = None
    obesity: Optional[int] = None
    genital_thrush_skipped: Optional[bool] = None


class Message(BaseModel):
    role: Literal["user", "bot"]
    text: str


class ChatRequest(BaseModel):
    history: list[Message] = []
    state: PatientState
    user_message: str  # empty string "" signals "start the conversation"


class GeminiTurnOutput(BaseModel):
    updated_fields: UpdatedFields
    reply_text: str
    phase: Literal["gathering", "confirming", "done"]


class ChatResponse(BaseModel):
    reply_text: str
    state: PatientState
    phase: Literal["gathering", "confirming", "done"]

class ChatResponse(BaseModel):
    reply_text: str
    state: PatientState
    phase: Literal["gathering", "confirming", "done"]
    prediction: Optional[PredictionResult] = None
    explanation: Optional[str] = None