from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ml.model_registry import get_active_model

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


class PatientRecord(BaseModel):
    age: int
    gender: int              # 1 = Male, 0 = Female
    polyuria: int
    polydipsia: int
    sudden_weight_loss: int
    weakness: int
    polyphagia: int
    genital_thrush: int
    visual_blurring: int
    itching: int
    irritability: int
    delayed_healing: int
    partial_paresis: int
    muscle_stiffness: int
    alopecia: int
    obesity: int


@app.post("/predict")
def predict(record: PatientRecord):
    try:
        model = get_active_model()
        result = model.predict(record.model_dump())
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))