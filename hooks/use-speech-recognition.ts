"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export type SpeechRecognitionState = "idle" | "recording" | "analyzing";

interface UseSpeechRecognitionReturn {
  state: SpeechRecognitionState;
  transcript: string;
  isSupported: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  error: string | null;
}

export function useSpeechRecognition(
  onTranscriptReady: (text: string) => void
): UseSpeechRecognitionReturn {
  const [state, setState] = useState<SpeechRecognitionState>("idle");
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");
  const stateRef = useRef<SpeechRecognitionState>("idle");
  const onTranscriptReadyRef = useRef(onTranscriptReady);

  // Keep callback ref up to date
  useEffect(() => {
    onTranscriptReadyRef.current = onTranscriptReady;
  }, [onTranscriptReady]);

  // Keep state ref in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const startRecording = useCallback(() => {
    if (!isSupported) return;

    setError(null);
    setTranscript("");
    transcriptRef.current = "";

    const SpeechRecognitionConstructor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) return;
    const recognition = new SpeechRecognitionConstructor();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setState("recording");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const combined = (finalTranscript + interimTranscript).trim();
      transcriptRef.current = combined;
      setTranscript(combined);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let message: string;
      switch (event.error) {
        case "not-allowed":
          message =
            "Microphone access denied. Please enable it in your browser settings.";
          break;
        case "no-speech":
          message = "No speech detected. Please try again.";
          break;
        case "network":
          message = "Network error. Please check your connection.";
          break;
        case "aborted":
          // User-initiated abort, no error message needed
          return;
        default:
          message = "Speech recognition error. Please try again.";
      }
      setError(message);
      setState("idle");
      setTranscript("");
      transcriptRef.current = "";
    };

    recognition.onend = () => {
      // Only transition to analyzing if we were recording (user stopped)
      if (stateRef.current === "recording") {
        // Recognition ended unexpectedly (e.g., silence timeout)
        // Just go back to idle
        setState("idle");
        return;
      }

      if (stateRef.current === "analyzing") {
        const finalText = transcriptRef.current;

        setTimeout(() => {
          if (finalText.trim()) {
            onTranscriptReadyRef.current(finalText);
          } else {
            setError("No speech was captured. Please try again.");
          }
          setState("idle");
          setTranscript("");
          transcriptRef.current = "";
        }, 1500);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError("Failed to start speech recognition. Please try again.");
      setState("idle");
    }
  }, [isSupported]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current && stateRef.current === "recording") {
      setState("analyzing");
      recognitionRef.current.stop();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  return {
    state,
    transcript,
    isSupported,
    startRecording,
    stopRecording,
    error,
  };
}
