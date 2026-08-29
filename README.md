# Diabetes Risk Screening Chatbot (Prototype)

An AI-powered, voice-enabled conversational screening tool that helps people — particularly those with limited literacy or tech familiarity — describe their symptoms naturally and receive an early diabetes risk estimate, so they can seek proper medical consultation sooner.

This is **not a diagnostic tool**. It is a screening aid intended to raise awareness and encourage timely doctor visits, especially in underserved rural communities where access to routine health checkups may be limited.

---

## 🎯 Project Motivation

Many people, especially in rural areas, are undiagnosed diabetics simply because they never get tested. Reading a form, understanding medical terminology, or navigating a typical health app can itself be a barrier.

This project explores whether a warm, natural-language, voice-capable conversational agent — one that lets a person just *describe how they feel*, in their own words, in their own language — can lower that barrier while still producing a clinically-informed risk estimate.

---

## ✨ Features

- **Conversational symptom intake** — no rigid forms; users describe symptoms naturally (e.g., "I've been really thirsty and tired lately"), and the system extracts structured data from free-form speech.
- **Multi-symptom extraction** — a single sentence describing several symptoms at once is correctly parsed into multiple fields.
- **Never guesses** — ambiguous answers are left unresolved and re-asked later rather than assumed, to preserve prediction accuracy.
- **Deterministic field prioritization** — the system always knows exactly which piece of information is still missing and asks about it directly, rather than relying on the LLM to self-prioritize (a reliability fix discovered during development).
- **Respectful handling of sensitive questions** — the one sensitive question (genital thrush/infection) is asked gently, near the end, and is explicitly skippable.
- **Confirmation step** — before predicting, the bot summarizes everything it understood and lets the user correct any mistakes.
- **ML-based prediction** — an XGBoost classifier trained on the UCI Early Stage Diabetes Risk Prediction dataset produces the actual risk estimate.
- **Plain-language explanation** — results are explained in warm, simple, non-clinical language, not raw percentages or medical jargon.
- **Voice input & output** — tap-to-record speech-to-text, and automatic text-to-speech playback of every bot message, via the browser's Web Speech API.
- **Bilingual (English / Hindi)**, with an upfront, icon/audio-first language selection screen designed for users who may not be able to read either language label confidently. Architecture supports adding more languages easily.
- **Swappable ML model** — the prediction model sits behind a clean adapter interface, so it can be upgraded/replaced without touching any other code.

---

## 🏗️ Architecture Overview
Browser (Next.js + React)
│  speaks/types symptoms
▼
FastAPI backend
│
├─→ Gemini API (conversation turn: extracts symptoms, decides next
│    question, generates confirmation summaries & result explanations)
│
└─→ XGBoost model (swappable adapter) → risk prediction

The conversation is **not** a free-form chatbot with no guardrails. It follows a strict pattern designed for reliability in a health-adjacent context:

1. The backend always knows, deterministically (in Python, not via LLM judgment), which of the 16 required fields is still unknown.
2. Each turn, Gemini is told exactly which single field to focus on next (while still being free to extract *any* other symptoms the user happens to mention in the same message).
3. Once all required fields are known, the bot generates a plain-language summary and asks for confirmation — corrections during this phase trigger a fresh, guaranteed-accurate re-summary (not just trusting the model's own wording).
4. Only after explicit confirmation does the backend call the ML model and generate a plain-language explanation of the result.

This "LLM handles language, deterministic code handles logic/sequencing" split was a deliberate design decision after finding that relying on the LLM alone to prioritize which question to ask next was unreliable in practice.

---

## 🧰 Tech Stack

**Backend**
- Python 3.13, FastAPI, Uvicorn
- `google-genai` SDK (Gemini API) — currently using `gemini-3.5-flash-lite` for its higher free-tier daily quota; the newer `gemini-3.6-flash` model is more capable but limited to ~20 free requests/day, which is too low for active development
- XGBoost (native `save_model`/`load_model` format — **not** pickle/joblib, see "Known Issues" below for why)
- Pydantic for schema validation

**Frontend**
- Next.js (App Router), TypeScript, Tailwind CSS
- Browser-native **Web Speech API** for STT and TTS (no paid speech services used — this is a free-tier-only prototype)

---

## 📁 Project Structure
diabetes-risk-prototype/
├── backend/
│   ├── main.py                  # FastAPI app: /health, /predict, /chat endpoints
│   ├── schemas.py                # Pydantic models: PatientState, ChatRequest/Response, etc.
│   ├── gemini_client.py          # All Gemini API calls: conversation turns,
│   │                              # confirmation summaries, result explanations
│   ├── prompts/
│   │   ├── system_prompt.txt     # Core "Bot" persona + conversation rules
│   │   └── explanation_prompt.txt
│   ├── ml/
│   │   ├── model_interface.py    # Abstract DiabetesModel interface
│   │   ├── xgboost_adapter.py    # Current XGBoost implementation
│   │   └── model_registry.py     # Single point of control for swapping models
│   ├── models/
│   │   ├── xgb_v1.json           # Trained model (native XGBoost format)
│   │   └── feature_order.json    # Exact column order the model expects
│   ├── requirements.txt
│   └── .env                      # GEMINI_API_KEY (not committed)
│
└── frontend/
└── app/
├── page.tsx               # Full chat UI (language selection, chat,
│                          # voice I/O, result display) — currently a
│                          # single file; a component/hook split is
│                          # planned but not yet done, see Roadmap.
└── globals.css

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+ (developed on 3.13)
- Node.js LTS (18+)
- A free Gemini API key from [Google AI Studio](https://aistudio.google.com/)
- **Google Chrome** is strongly recommended for testing — the Web Speech API has inconsistent/partial support in Firefox and Safari.

### Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\Activate.ps1
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
Create a backend/.env file: GEMINI_API_KEY=your_key_here
Run the server: uvicorn main:app --reload

Backend runs at http://127.0.0.1:8000. Interactive API docs (useful for testing endpoints directly): http://127.0.0.1:8000/docs

Frontend Setup
cd frontend
npm install
npm run dev

Frontend runs at http://localhost:3000.

Both servers must be running simultaneously for the app to work.

🧪 How It Works, End to End
User selects a language on the landing screen (audibly confirmed).
Bot greets the user and asks an opening question.
User responds — by typing or by tapping the mic button and speaking.
Backend determines the next missing piece of required information, asks Gemini to extract anything relevant from the message and generate a natural follow-up.
Once everything required is known, the bot summarizes and asks for confirmation (looping back to correct any mistakes if needed).
On confirmation, the backend runs the XGBoost model and generates a plain-language explanation, displayed with a simple risk-level color indicator.
⚠️ Known Issues & Limitations
Model serialization: the XGBoost model must be saved using model.save_model("xgb_v1.json") / model.load_model(...), not joblib.dump/pickle. An earlier version of this project used joblib, which caused a cryptic, hard-to-diagnose "input stream corrupted" error that surfaced identically across multiple unrelated HTTP clients — the actual cause was a corrupted/incompatible pickled model file, silently caught by a generic exception handler. If you retrain the model, use the native format.
Gemini free-tier quota: gemini-3.5-flash-lite is used deliberately for its much higher free daily request limit compared to newer models like gemini-3.6-flash (500/day vs ∼20/day at time of writing). Google's available models and their exact rate limits change over time — check your AI Studio rate limits page if you hit quota errors, and update MODEL_NAME in gemini_client.py accordingly.
Web Speech API browser support varies significantly; this prototype assumes Chrome. A production version would likely need a proper cloud speech API (e.g., Bhashini, Google Cloud Speech) for reliability across devices and better regional language support.
Speech recognition accuracy is inherently limited on the free browser API, especially for accented speech or in noisy environments. The conversation design tolerates this somewhat (ambiguous input is re-asked rather than misused), but transcription errors can still occur.
page.tsx is currently a single large file. A refactor into separate components (LanguageSelectScreen, ChatWindow, MessageBubble, ResultCard, ChatInputBar) and custom hooks (useSpeechRecognition, useTextToSpeech) is planned but not yet done — see Roadmap.
No offline/fallback flow yet. If the Gemini API or network fails mid-conversation, there is currently no deterministic backup question-flow to fall back on (this was part of the original design but hasn't been implemented yet).
This project currently only supports the 16-feature symptom-based dataset (UCI Early Stage Diabetes Risk Prediction dataset) — it does not ask for lab values like glucose/BMI, which was a deliberate choice since target users are unlikely to have recent lab results.
🗺️ Roadmap
 Refactor page.tsx into components + custom hooks
 Deterministic fallback question flow for network/API failures
 Accessibility pass: larger touch targets, icons per symptom, progress indicator, high-contrast theming throughout
 Additional regional languages
 Swap Web Speech API for a more robust speech service (e.g., Bhashini) for production use
 Optional: secondary risk-score model (e.g., Indian Diabetes Risk Score) as an alternative to the ML model for even lighter-weight screening
🧩 Extending / Swapping the ML Model
The prediction logic is intentionally decoupled from the rest of the app:

Implement the DiabetesModel interface in ml/model_interface.py:
  def predict(self, record: dict) -> PredictionResult:
    ...
markdown
# Diabetes Risk Screening Chatbot (Prototype)

An AI-powered, voice-enabled conversational screening tool that helps people — particularly those with limited literacy or tech familiarity — describe their symptoms naturally and receive an early diabetes risk estimate, so they can seek proper medical consultation sooner.

This is **not a diagnostic tool**. It is a screening aid intended to raise awareness and encourage timely doctor visits, especially in underserved rural communities where access to routine health checkups may be limited.

---

## 🎯 Project Motivation

Many people, especially in rural areas, are undiagnosed diabetics simply because they never get tested. Reading a form, understanding medical terminology, or navigating a typical health app can itself be a barrier.

This project explores whether a warm, natural-language, voice-capable conversational agent — one that lets a person just *describe how they feel*, in their own words, in their own language — can lower that barrier while still producing a clinically-informed risk estimate.

---

## ✨ Features

- **Conversational symptom intake** — no rigid forms; users describe symptoms naturally (e.g., "I've been really thirsty and tired lately"), and the system extracts structured data from free-form speech.
- **Multi-symptom extraction** — a single sentence describing several symptoms at once is correctly parsed into multiple fields.
- **Never guesses** — ambiguous answers are left unresolved and re-asked later rather than assumed, to preserve prediction accuracy.
- **Deterministic field prioritization** — the system always knows exactly which piece of information is still missing and asks about it directly, rather than relying on the LLM to self-prioritize (a reliability fix discovered during development).
- **Respectful handling of sensitive questions** — the one sensitive question (genital thrush/infection) is asked gently, near the end, and is explicitly skippable.
- **Confirmation step** — before predicting, the bot summarizes everything it understood and lets the user correct any mistakes.
- **ML-based prediction** — an XGBoost classifier trained on the UCI Early Stage Diabetes Risk Prediction dataset produces the actual risk estimate.
- **Plain-language explanation** — results are explained in warm, simple, non-clinical language, not raw percentages or medical jargon.
- **Voice input & output** — tap-to-record speech-to-text, and automatic text-to-speech playback of every bot message, via the browser's Web Speech API.
- **Bilingual (English / Hindi)**, with an upfront, icon/audio-first language selection screen designed for users who may not be able to read either language label confidently. Architecture supports adding more languages easily.
- **Swappable ML model** — the prediction model sits behind a clean adapter interface, so it can be upgraded/replaced without touching any other code.

---

## 🏗️ Architecture Overview

Browser (Next.js + React)
│  speaks/types symptoms
▼
FastAPI backend
│
├─→ Gemini API (conversation turn: extracts symptoms, decides next
│    question, generates confirmation summaries & result explanations)
│
└─→ XGBoost model (swappable adapter) → risk prediction

vbnet

The conversation is **not** a free-form chatbot with no guardrails. It follows a strict pattern designed for reliability in a health-adjacent context:

1. The backend always knows, deterministically (in Python, not via LLM judgment), which of the 16 required fields is still unknown.
2. Each turn, Gemini is told exactly which single field to focus on next (while still being free to extract *any* other symptoms the user happens to mention in the same message).
3. Once all required fields are known, the bot generates a plain-language summary and asks for confirmation — corrections during this phase trigger a fresh, guaranteed-accurate re-summary (not just trusting the model's own wording).
4. Only after explicit confirmation does the backend call the ML model and generate a plain-language explanation of the result.

This "LLM handles language, deterministic code handles logic/sequencing" split was a deliberate design decision after finding that relying on the LLM alone to prioritize which question to ask next was unreliable in practice.

---

## 🧰 Tech Stack

**Backend**
- Python 3.13, FastAPI, Uvicorn
- `google-genai` SDK (Gemini API) — currently using `gemini-3.5-flash-lite` for its higher free-tier daily quota; the newer `gemini-3.6-flash` model is more capable but limited to ~20 free requests/day, which is too low for active development
- XGBoost (native `save_model`/`load_model` format — **not** pickle/joblib, see "Known Issues" below for why)
- Pydantic for schema validation

**Frontend**
- Next.js (App Router), TypeScript, Tailwind CSS
- Browser-native **Web Speech API** for STT and TTS (no paid speech services used — this is a free-tier-only prototype)

---

## 📁 Project Structure

diabetes-risk-prototype/
├── backend/
│   ├── main.py                  # FastAPI app: /health, /predict, /chat endpoints
│   ├── schemas.py                # Pydantic models: PatientState, ChatRequest/Response, etc.
│   ├── gemini_client.py          # All Gemini API calls: conversation turns,
│   │                              # confirmation summaries, result explanations
│   ├── prompts/
│   │   ├── system_prompt.txt     # Core "Bot" persona + conversation rules
│   │   └── explanation_prompt.txt
│   ├── ml/
│   │   ├── model_interface.py    # Abstract DiabetesModel interface
│   │   ├── xgboost_adapter.py    # Current XGBoost implementation
│   │   └── model_registry.py     # Single point of control for swapping models
│   ├── models/
│   │   ├── xgb_v1.json           # Trained model (native XGBoost format)
│   │   └── feature_order.json    # Exact column order the model expects
│   ├── requirements.txt
│   └── .env                      # GEMINI_API_KEY (not committed)
│
└── frontend/
└── app/
├── page.tsx               # Full chat UI (language selection, chat,
│                          # voice I/O, result display) — currently a
│                          # single file; a component/hook split is
│                          # planned but not yet done, see Roadmap.
└── globals.css

yaml

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+ (developed on 3.13)
- Node.js LTS (18+)
- A free Gemini API key from [Google AI Studio](https://aistudio.google.com/)
- **Google Chrome** is strongly recommended for testing — the Web Speech API has inconsistent/partial support in Firefox and Safari.

### Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\Activate.ps1
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
Create a backend/.env file:

makefile
GEMINI_API_KEY=your_key_here
Run the server:

bash
uvicorn main:app --reload
Backend runs at http://127.0.0.1:8000. Interactive API docs (useful for testing endpoints directly): http://127.0.0.1:8000/docs

Frontend Setup
bash
cd frontend
npm install
npm run dev
Frontend runs at http://localhost:3000.

Both servers must be running simultaneously for the app to work.

🧪 How It Works, End to End
User selects a language on the landing screen (audibly confirmed).
Bot greets the user and asks an opening question.
User responds — by typing or by tapping the mic button and speaking.
Backend determines the next missing piece of required information, asks Gemini to extract anything relevant from the message and generate a natural follow-up.
Once everything required is known, the bot summarizes and asks for confirmation (looping back to correct any mistakes if needed).
On confirmation, the backend runs the XGBoost model and generates a plain-language explanation, displayed with a simple risk-level color indicator.
⚠️ Known Issues & Limitations
Model serialization: the XGBoost model must be saved using model.save_model("xgb_v1.json") / model.load_model(...), not joblib.dump/pickle. An earlier version of this project used joblib, which caused a cryptic, hard-to-diagnose "input stream corrupted" error that surfaced identically across multiple unrelated HTTP clients — the actual cause was a corrupted/incompatible pickled model file, silently caught by a generic exception handler. If you retrain the model, use the native format.
Gemini free-tier quota: gemini-3.5-flash-lite is used deliberately for its much higher free daily request limit compared to newer models like gemini-3.6-flash (500/day vs ∼20/day at time of writing). Google's available models and their exact rate limits change over time — check your AI Studio rate limits page if you hit quota errors, and update MODEL_NAME in gemini_client.py accordingly.
Web Speech API browser support varies significantly; this prototype assumes Chrome. A production version would likely need a proper cloud speech API (e.g., Bhashini, Google Cloud Speech) for reliability across devices and better regional language support.
Speech recognition accuracy is inherently limited on the free browser API, especially for accented speech or in noisy environments. The conversation design tolerates this somewhat (ambiguous input is re-asked rather than misused), but transcription errors can still occur.
page.tsx is currently a single large file. A refactor into separate components (LanguageSelectScreen, ChatWindow, MessageBubble, ResultCard, ChatInputBar) and custom hooks (useSpeechRecognition, useTextToSpeech) is planned but not yet done — see Roadmap.
No offline/fallback flow yet. If the Gemini API or network fails mid-conversation, there is currently no deterministic backup question-flow to fall back on (this was part of the original design but hasn't been implemented yet).
This project currently only supports the 16-feature symptom-based dataset (UCI Early Stage Diabetes Risk Prediction dataset) — it does not ask for lab values like glucose/BMI, which was a deliberate choice since target users are unlikely to have recent lab results.
🗺️ Roadmap
 Refactor page.tsx into components + custom hooks
 Deterministic fallback question flow for network/API failures
 Accessibility pass: larger touch targets, icons per symptom, progress indicator, high-contrast theming throughout
 Additional regional languages
 Swap Web Speech API for a more robust speech service (e.g., Bhashini) for production use
 Optional: secondary risk-score model (e.g., Indian Diabetes Risk Score) as an alternative to the ML model for even lighter-weight screening
🧩 Extending / Swapping the ML Model
The prediction logic is intentionally decoupled from the rest of the app:

Implement the DiabetesModel interface in ml/model_interface.py:
python
def predict(self, record: dict) -> PredictionResult:
    ...
Point ml/model_registry.py's get_active_model() at your new adapter.
No other file needs to change — the /predict and /chat endpoints call get_active_model() without knowing or caring what's underneath.

🤝 Contributing
This is an early-stage academic/prototype project. Forks and pull requests are welcome. If you're picking this up:

Read through gemini_client.py and system_prompt.txt together — the conversation design relies on a specific split of responsibility between the deterministic Python logic and the LLM, explained in "Architecture Overview" above. Please preserve that separation when extending it.
Please test any prompt changes across multiple conversation paths (clear answers, ambiguous answers, denials, multi-symptom sentences) before committing — this project went through significant iteration to get extraction reliability right.
Keep .env out of commits (already gitignored) — never commit API keys.
📄 Disclaimer
This tool provides a screening estimate only and is not a medical diagnosis. Anyone using this tool should be encouraged to consult a qualified healthcare professional for proper testing and diagnosis, regardless of the result shown.
