"use client";

import { useEffect, useRef, useState } from "react";

const BACKEND_URL = "http://127.0.0.1:8000";

// Centralized language config — change this one value later to switch
// languages, or expose it as a toggle in state once we add multi-language support.
const SPEECH_LANG = "en-US";

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

  const hasInitialized = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const lastSpokenIndex = useRef(-1);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    sendMessage("");
  }, []);

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
      utterance.lang = SPEECH_LANG;
      window.speechSynthesis.cancel(); // stop any overlapping speech first
      window.speechSynthesis.speak(utterance);
      lastSpokenIndex.current = lastIndex;
    }
  }, [messages]);

  // Also speak the explanation, once, when it first appears.
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (explanation) {
      const utterance = new SpeechSynthesisUtterance(explanation);
      utterance.lang = SPEECH_LANG;
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

  async function sendMessage(userText: string) {
    if (userText) {
      setMessages((prev) => [...prev, { role: "user", text: userText }]);
    }

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
    recognition.lang = SPEECH_LANG;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
  
    let silenceTimer: ReturnType<typeof setTimeout> | null = null;
    let finalTranscript = "";
  
    const resetSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        recognition.stop();
      }, 1200); // stop 1.2s after the last detected speech
    };
  
    recognition.onstart = () => setIsRecording(true);
  
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }
      resetSilenceTimer();
    };
  
    recognition.onerror = (event: any) => {
      setIsRecording(false);
      if (silenceTimer) clearTimeout(silenceTimer);
      setError(`Voice input error: ${event.error}. Please try again or type instead.`);
    };
  
    recognition.onend = () => {
      setIsRecording(false);
      if (silenceTimer) clearTimeout(silenceTimer);
      const text = finalTranscript.trim();
      if (text && !loading && phase !== "done") {
        sendMessage(text);
      }
    };
  
    recognitionRef.current = recognition;
    recognition.start();
  }
  
  const riskColor =
    prediction?.risk_level === "high"
      ? "bg-red-100 border-red-500 text-red-800"
      : prediction?.risk_level === "moderate"
      ? "bg-yellow-100 border-yellow-500 text-yellow-800"
      : "bg-green-100 border-green-500 text-green-800";

  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4">
      <div className="w-full max-w-xl flex flex-col h-[85vh] bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-blue-600 text-white p-4 font-semibold text-lg">
          Bot — Diabetes Risk Screening
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