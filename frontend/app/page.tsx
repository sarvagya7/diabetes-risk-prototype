"use client";

import { useEffect, useRef, useState } from "react";

const BACKEND_URL = "http://127.0.0.1:8000";

interface LanguageOption {
  code: string;        // BCP-47 code for Web Speech API
  label: string;       // shown in dropdown
  geminiName: string;  // sent to backend, told to Gemini
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: "en-US", label: "English", geminiName: "English" },
  { code: "hi-IN", label: "हिंदी (Hindi)", geminiName: "Hindi" },
];

interface PatientState {
  age: number | null;
  gender: number | null;
  polyuria: number | null;
  polydipsia: number | null;
  sudden_weight_loss: number | null;
  weakness: number | null;
  polyphagia: number | null;
  genital_thrush: number | null;
  visual_blurring: number | null;
  itching: number | null;
  irritability: number | null;
  delayed_healing: number | null;
  partial_paresis: number | null;
  muscle_stiffness: number | null;
  alopecia: number | null;
  obesity: number | null;
  genital_thrush_skipped: boolean;
}

interface Message {
  role: "user" | "bot";
  text: string;
}

interface Prediction {
  label: string;
  probability: number;
  risk_level: "low" | "moderate" | "high";
}

interface ChatResponse {
  reply_text: string;
  state: PatientState;
  phase: "gathering" | "confirming" | "done";
  prediction: Prediction | null;
  explanation: string | null;
}

const initialState: PatientState = {
  age: null,
  gender: null,
  polyuria: null,
  polydipsia: null,
  sudden_weight_loss: null,
  weakness: null,
  polyphagia: null,
  genital_thrush: null,
  visual_blurring: null,
  itching: null,
  irritability: null,
  delayed_healing: null,
  partial_paresis: null,
  muscle_stiffness: null,
  alopecia: null,
  obesity: null,
  genital_thrush_skipped: false,
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [patientState, setPatientState] = useState<PatientState>(initialState);
  const [phase, setPhase] = useState<"gathering" | "confirming" | "done">("gathering");
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(LANGUAGE_OPTIONS[0]);
  const [languageConfirmed, setLanguageConfirmed] = useState(false);

  const hasInitialized = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const lastSpokenIndex = useRef(-1);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!loading && phase !== "done") {
      inputRef.current?.focus();
    }
  }, [loading, phase]);

  // Text-to-speech: speak each new bot message aloud, exactly once.
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const lastIndex = messages.length - 1;
    if (lastIndex < 0 || lastIndex <= lastSpokenIndex.current) return;

    const lastMsg = messages[lastIndex];
    if (lastMsg.role === "bot") {
      const utterance = new SpeechSynthesisUtterance(lastMsg.text);
      utterance.lang = selectedLanguage.code;
      window.speechSynthesis.cancel(); // stop any overlapping speech first
      window.speechSynthesis.speak(utterance);
      lastSpokenIndex.current = lastIndex;
    }
  }, [messages, selectedLanguage]);

  // Also speak the explanation, once, when it first appears.
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (explanation) {
      const utterance = new SpeechSynthesisUtterance(explanation);
      utterance.lang = selectedLanguage.code;
      window.speechSynthesis.speak(utterance);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explanation]);

  // Feature-detect speech recognition support once, on mount.
  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setSpeechSupported(false);
    }
  }, []);

  async function sendMessage(userText: string, languageOverride?: LanguageOption) {
    if (userText) {
      setMessages((prev) => [...prev, { role: "user", text: userText }]);
    }
  
    const languageToUse = languageOverride ?? selectedLanguage;
  
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          history: messages,
          state: patientState,
          user_message: userText,
          language: languageToUse.geminiName,
        }),
      });
  
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Server error ${res.status}: ${errBody}`);
      }
  
      const data: ChatResponse = await res.json();
  
      setMessages((prev) => [...prev, { role: "bot", text: data.reply_text }]);
      setPatientState(data.state);
      setPhase(data.phase);
      if (data.prediction) setPrediction(data.prediction);
      if (data.explanation) setExplanation(data.explanation);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong reaching the server.");
    } finally {
      setLoading(false);
    }
  }

  function handleSend() {
    const text = inputText.trim();
    if (!text || loading || phase === "done") return;
    setInputText("");
    sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSend();
  }

  function handleMicClick() {
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }
  
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setError("Voice input isn't supported in this browser. Please type instead.");
      return;
    }
  
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = selectedLanguage.code;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
  
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let noSpeechTimer: ReturnType<typeof setTimeout> | null = null;
    let latestTranscript = "";
    let hasHeardAnything = false;
  
    const resetSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        recognition.stop();
      }, 1500);
    };
  
    recognition.onstart = () => {
      setIsRecording(true);
      noSpeechTimer = setTimeout(() => {
        if (!hasHeardAnything) {
          recognition.stop();
        }
      }, 3500);
    };
  
    recognition.onresult = (event: any) => {
      hasHeardAnything = true;
      if (noSpeechTimer) clearTimeout(noSpeechTimer);
  
      // Rebuild the full transcript from ALL results every time, regardless
      // of isFinal — Chrome's continuous mode is unreliable about ever
      // marking results final, so we can't depend on that flag at all.
      let combined = "";
      for (let i = 0; i < event.results.length; i++) {
        combined += event.results[i][0].transcript;
      }
      latestTranscript = combined;
  
      resetSilenceTimer();
    };
  
    recognition.onerror = (event: any) => {
      setIsRecording(false);
      if (silenceTimer) clearTimeout(silenceTimer);
      if (noSpeechTimer) clearTimeout(noSpeechTimer);
      if (event.error !== "no-speech") {
        setError(`Voice input error: ${event.error}. Please try again or type instead.`);
      }
    };
  
    recognition.onend = () => {
      setIsRecording(false);
      if (silenceTimer) clearTimeout(silenceTimer);
      if (noSpeechTimer) clearTimeout(noSpeechTimer);
      const text = latestTranscript.trim();
      if (text && !loading && phase !== "done") {
        sendMessage(text);
      } else if (!text) {
        setError("I didn't catch that. Please try again.");
      }
    };
  
    recognitionRef.current = recognition;
    recognition.start();
  }

  function handleLanguageSelect(lang: LanguageOption) {
    setSelectedLanguage(lang);
    setLanguageConfirmed(true);
  
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const confirmText =
        lang.geminiName === "Hindi"
          ? "आपने हिंदी चुनी है। अब हम शुरू करते हैं।"
          : "You have selected English. Let's begin.";
      const utterance = new SpeechSynthesisUtterance(confirmText);
      utterance.lang = lang.code;
      window.speechSynthesis.speak(utterance);
    }
  
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      sendMessage("", lang);  // pass lang explicitly, don't rely on state timing
    }
  }

  const riskColor =
    prediction?.risk_level === "high"
      ? "bg-red-100 border-red-500 text-red-800"
      : prediction?.risk_level === "moderate"
      ? "bg-yellow-100 border-yellow-500 text-yellow-800"
      : "bg-green-100 border-green-500 text-green-800";

      if (!languageConfirmed) {
        return (
          <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
            <div className="w-full max-w-md text-center">
              <div className="text-6xl mb-4">🩺</div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                Bot — Diabetes Risk Screening
              </h1>
              <p className="text-lg text-gray-600 mb-10">
                Please choose your language
                <br />
                <span lang="hi">कृपया अपनी भाषा चुनें</span>
              </p>
      
              <div className="grid grid-cols-1 gap-5">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleLanguageSelect(lang)}
                    className="flex items-center justify-center gap-4 bg-white border-2 border-blue-200 hover:border-blue-500 hover:bg-blue-50 rounded-2xl py-6 px-6 shadow-md transition-all active:scale-95"
                  >
                    <span className="text-2xl font-bold text-blue-500 bg-blue-50 rounded-full w-12 h-12 flex items-center justify-center">
                      {lang.geminiName === "Hindi" ? "अ" : "A"}
                    </span>
                    <span className="text-3xl font-semibold text-gray-800">
                      {lang.label}
                    </span>
                  </button>
                ))}
              </div>
      
              <p className="text-sm text-gray-400 mt-10">
                🔊 Tap a language to hear it confirmed aloud
              </p>
            </div>
          </main>
        );
      }
      
      return (
        <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4">
          <div className="w-full max-w-xl flex flex-col h-[85vh] bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-blue-600 text-white p-4 font-semibold text-lg flex justify-between items-center">
              <span>Bot — Diabetes Risk Screening</span>
              <select
                value={selectedLanguage.code}
                onChange={(e) => {
                  const chosen = LANGUAGE_OPTIONS.find((l) => l.code === e.target.value);
                  if (chosen) setSelectedLanguage(chosen);
                }}
                className="text-sm text-gray-900 bg-white rounded px-2 py-1"
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
      
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] px-4 py-2 rounded-lg text-sm ${
                      msg.role === "user"
                        ? "bg-blue-500 text-white rounded-br-none"
                        : "bg-gray-200 text-gray-900 rounded-bl-none"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
      
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-200 text-gray-500 px-4 py-2 rounded-lg text-sm italic">
                    Bot is typing...
                  </div>
                </div>
              )}
      
              {error && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}
      
              {prediction && (
                <div className={`border-2 rounded-lg p-4 text-sm ${riskColor}`}>
                  <div className="font-semibold mb-2">Your Screening Result</div>
                  {explanation && <div className="mb-3">{explanation}</div>}
                  <div className="text-xs opacity-75 border-t pt-2 mt-2">
                    Technical details — Result: {prediction.label}, Risk level: {prediction.risk_level.toUpperCase()}
                  </div>
                </div>
              )}
      
              <div ref={bottomRef} />
            </div>
      
            <div className="border-t p-3 flex gap-2">
              <button
                onClick={handleMicClick}
                disabled={loading || phase === "done" || !speechSupported}
                title={speechSupported ? "Tap to speak" : "Voice input not supported in this browser"}
                className={`px-3 py-2 rounded-lg text-sm disabled:opacity-50 ${
                  isRecording
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {isRecording ? "● Recording..." : "🎤"}
              </button>
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading || phase === "done"}
                placeholder={
                  phase === "done" ? "Conversation complete" : "Type or tap mic to speak..."
                }
                className="flex-1 border rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white disabled:bg-gray-100"
              />
              <button
                onClick={handleSend}
                disabled={loading || phase === "done" || !inputText.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </main>
      );
}