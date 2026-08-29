from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from schemas import ChatRequest, ChatResponse, PatientState, REQUIRED_FIELDS
from gemini_client import run_chat_turn, generate_plain_explanation, generate_confirmation_summary 
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
    
def merge_state(current: PatientState, updates) -> PatientState:
    data = current.model_dump()
    update_data = updates.model_dump()
    for k, v in update_data.items():
        if v is not None:
            data[k] = v
    return PatientState(**data)


def all_required_filled(state: PatientState) -> bool:
    data = state.model_dump()
    if any(data.get(f) is None for f in REQUIRED_FIELDS):
        return False
    if data.get("genital_thrush") is None and not data.get("genital_thrush_skipped"):
        return False
    return True


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    result = run_chat_turn(req.history, req.state, req.user_message, req.language)
    merged_state = merge_state(req.state, result.updated_fields)

    phase = result.phase
    reply_text = result.reply_text

    if phase == "gathering" and all_required_filled(merged_state):
        phase = "confirming"

    # Whenever we're in confirming phase (whether just entered, or re-confirming
    # after a correction), always regenerate a guaranteed-accurate summary rather
    # than trusting the model's own reply_text for this turn.
    if phase == "confirming":
        reply_text = generate_confirmation_summary(merged_state, req.language)

    prediction = None
    explanation = None
    if phase == "done":
        record = merged_state.model_dump()
        record["genital_thrush"] = record["genital_thrush"] if record["genital_thrush"] is not None else 0
        del record["genital_thrush_skipped"]

        model = get_active_model()
        prediction = model.predict(record)
        explanation = generate_plain_explanation(merged_state, prediction["risk_level"], req.language)

    return ChatResponse(
        reply_text=reply_text,
        state=merged_state,
        phase=phase,
        prediction=prediction,
        explanation=explanation,
    )