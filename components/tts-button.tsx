"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SpeakerLoudIcon } from "@radix-ui/react-icons";
import { Button } from "./ui/button";
import { StopIcon } from "./icons";
import { cn } from "@/lib/utils";

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs, "$1")
    .replace(/`{3}[\s\S]*?`{3}/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/\n{2,}/g, " ")
    .trim();
}

function selectMaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const enVoices = voices.filter((v) => v.lang.startsWith("en"));
  const maleKeywords = [
    "google uk english male",
    "microsoft david",
    "microsoft mark",
    "alex",
    "tom",
    "daniel",
    "fred",
    "guy",
    "male",
  ];
  for (const keyword of maleKeywords) {
    const match = enVoices.find((v) => v.name.toLowerCase().includes(keyword));
    if (match) return match;
  }
  return enVoices.find((v) => v.lang === "en-US") ?? enVoices[0] ?? null;
}

interface TtsButtonProps {
  text: string;
  className?: string;
}

export function TtsButton({ text, className }: TtsButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) setVoices(available);
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  const handleClick = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const plainText = stripMarkdown(text);
    if (!plainText) return;

    const utterance = new SpeechSynthesisUtterance(plainText);
    const voice = selectMaleVoice(voices);
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    utterance.pitch = 0.9;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSpeaking, text, voices]);

  // Cancel on unmount
  useEffect(() => {
    return () => {
      if (isSpeaking) window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (typeof window === "undefined" || !window.speechSynthesis) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-7 w-7 text-muted-foreground hover:text-foreground",
        isSpeaking && "text-primary",
        className
      )}
      onClick={handleClick}
      title={isSpeaking ? "Stop speaking" : "Read aloud"}
    >
      {isSpeaking ? <StopIcon size={13} /> : <SpeakerLoudIcon className="size-4" />}
    </Button>
  );
}
