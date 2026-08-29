import os
import json
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

from schemas import PatientState, GeminiTurnOutput, Message, REQUIRED_FIELDS

load_dotenv()

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

MODEL_NAME = "gemini-3.5-flash-lite"

PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
SYSTEM_PROMPT = (PROMPTS_DIR / "system_prompt.txt").read_text(encoding="utf-8")


FIELD_QUESTIONS_HINT = {
    "age": "their age",
    "gender": "whether they are male or female",
    "polyuria": "frequent urination",
    "polydipsia": "excessive thirst",
    "sudden_weight_loss": "sudden weight loss",
    "weakness": "general weakness or fatigue",
    "polyphagia": "excessive hunger",
    "visual_blurring": "blurry vision",
    "itching": "itching",
    "irritability": "irritability",
    "delayed_healing": "slow wound healing",
    "partial_paresis": "localized weakness or numbness in a limb",
    "muscle_stiffness": "muscle stiffness",
    "alopecia": "hair loss",
    "obesity": "being overweight",
}


def _format_history(history: list[Message]) -> str:
    lines = []
    for msg in history:
        speaker = "User" if msg.role == "user" else "Bot"
        lines.append(f"{speaker}: {msg.text}")
    return "\n".join(lines) if lines else "(no previous messages)"


def _next_target_field(state: PatientState) -> str | None:
    data = state.model_dump()
    for f in REQUIRED_FIELDS:
        if data.get(f) is None:
            return f
    if data.get("genital_thrush") is None and not data.get("genital_thrush_skipped"):
        return "genital_thrush"
    return None


def run_chat_turn(history: list[Message], state: PatientState, user_message: str, language: str = "English") -> GeminiTurnOutput:
    known_fields = {k: v for k, v in state.model_dump().items() if v is not None}
    target_field = _next_target_field(state)

    if target_field is None:
        target_instruction = (
            "All required fields are now known. Move to the confirming phase: "
            "summarize everything you've learned in simple, warm language, and "
            "ask the user to confirm it's correct or point out any mistakes."
        )
    elif target_field == "genital_thrush":
        target_instruction = (
            "The only remaining field is genital_thrush (sensitive, optional). "
            "Gently ask about it now, and explicitly tell the user they may "
            "decline to answer if they're not comfortable."
        )
    else:
        hint = FIELD_QUESTIONS_HINT[target_field]
        target_instruction = (
            f"Your reply THIS TURN must ask specifically about: {hint} "
            f"(field name: '{target_field}'). Do not ask about any other new "
            f"symptom yet, even if you're tempted to — this exact field takes "
            f"priority over everything else. First briefly acknowledge whatever "
            f"the user just told you, then ask about {hint}."
        )

    context_block = f"""Known information so far (JSON): {json.dumps(known_fields)}

IMPORTANT: Respond ONLY in {language}. Translate your warm, natural tone
appropriately into {language} — do not respond word-for-word literally,
sound natural in that language.

{target_instruction}

Conversation so far:
{_format_history(history)}

Latest user message: "{user_message}"
"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=context_block,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=GeminiTurnOutput,
        ),
    )

    return GeminiTurnOutput.model_validate_json(response.text)

EXPLANATION_PROMPT_TEMPLATE = (PROMPTS_DIR / "explanation_prompt.txt").read_text(encoding="utf-8")

SYMPTOM_LABELS = {
    "polyuria": "frequent urination",
    "polydipsia": "excessive thirst",
    "sudden_weight_loss": "sudden weight loss",
    "weakness": "fatigue/weakness",
    "polyphagia": "excessive hunger",
    "genital_thrush": "genital itching/infection",
    "visual_blurring": "blurry vision",
    "itching": "itching",
    "irritability": "irritability",
    "delayed_healing": "slow wound healing",
    "partial_paresis": "limb weakness/numbness",
    "muscle_stiffness": "muscle stiffness",
    "alopecia": "hair loss",
    "obesity": "being overweight",
}


def generate_plain_explanation(state: PatientState, risk_level: str, language: str = "English") -> str:
    data = state.model_dump()
    symptoms_present = [
        label for field, label in SYMPTOM_LABELS.items() if data.get(field) == 1
    ]
    symptoms_text = ", ".join(symptoms_present) if symptoms_present else "no major symptoms"

    prompt = EXPLANATION_PROMPT_TEMPLATE.format(
        risk_level=risk_level,
        symptoms_present=symptoms_text,
    )
    prompt += f"\n\nIMPORTANT: Write this explanation entirely in {language}."

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )
    return response.text.strip()

CONFIRMATION_PROMPT_TEMPLATE = """You are "Bot", the same warm health assistant.
All required information has now been collected:

{known_fields_json}

Write a warm, simple summary of everything above in {language}, in plain
conversational language (not a bulleted list), then ask the user to
confirm it's all correct or point out anything wrong. Respond with ONLY
the message text, no formatting, no JSON."""


def generate_confirmation_summary(state: PatientState, language: str = "English") -> str:
    known_fields = {k: v for k, v in state.model_dump().items() if v is not None}
    prompt = CONFIRMATION_PROMPT_TEMPLATE.format(
        known_fields_json=json.dumps(known_fields),
        language=language,
    )
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
    )
    return response.text.strip()