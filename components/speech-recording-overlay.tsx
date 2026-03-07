"use client";

import { motion } from "framer-motion";
import { MicrophoneIcon } from "./icons";
import { Spinner } from "./ui/spinner";
import type { SpeechRecognitionState } from "@/hooks/use-speech-recognition";

interface SpeechRecordingOverlayProps {
  state: SpeechRecognitionState;
  transcript: string;
  onStopRecording: () => void;
}

const barVariants = {
  recording: (i: number) => ({
    scaleY: [1, 2.5, 1],
    transition: {
      repeat: Infinity,
      duration: 0.8,
      delay: i * 0.12,
      ease: "easeInOut",
    },
  }),
};

export function SpeechRecordingOverlay({
  state,
  transcript,
  onStopRecording,
}: SpeechRecordingOverlayProps) {
  if (state === "idle") return null;

  const isRecording = state === "recording";

  return (
    <motion.div
      key="speech-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={isRecording ? onStopRecording : undefined}
      style={{ cursor: isRecording ? "pointer" : "default" }}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Wave bars (recording only) */}
        {isRecording && (
          <div className="flex items-center gap-1.5 h-12">
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="w-1.5 h-6 rounded-full bg-indigo-500 origin-center"
                custom={i}
                variants={barVariants}
                animate="recording"
              />
            ))}
          </div>
        )}

        {/* Microphone circle */}
        {isRecording ? (
          <div className="relative">
            {/* Pulsing ring */}
            <motion.div
              className="absolute inset-0 rounded-full bg-red-500/20"
              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
              transition={{
                repeat: Infinity,
                duration: 2,
                ease: "easeInOut",
              }}
              style={{ borderRadius: "50%" }}
            />
            <div className="relative w-24 h-24 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
              <MicrophoneIcon size={40} className="text-white" />
            </div>
          </div>
        ) : (
          <div className="w-24 h-24 rounded-full bg-muted/20 flex items-center justify-center">
            <Spinner className="h-10 w-10 text-indigo-400" />
          </div>
        )}

        {/* Status text */}
        <motion.p
          className="text-white text-lg font-medium"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        >
          {isRecording ? "Recording..." : "Analyzing your response..."}
        </motion.p>

        {/* Live transcript preview */}
        {isRecording && transcript && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-white/70 text-sm max-w-md text-center px-4 line-clamp-3"
          >
            {transcript}
          </motion.p>
        )}

        {/* Tap hint */}
        {isRecording && (
          <p className="text-white/40 text-sm">Tap anywhere to stop</p>
        )}
      </div>
    </motion.div>
  );
}
