"use client";

import React, { memo } from "react";
import { cn } from "@/lib/utils";
import { MicrophoneIcon } from "../icons";
import { Button } from "./button";
import type { UseChatHelpers, UIMessage } from "@ai-sdk/react";

interface MicrophoneButtonProps {
  isRecording: boolean;
  onClick: () => void;
  status: UseChatHelpers<UIMessage>["status"];
  disabled?: boolean;
}

function PureMicrophoneButton({
  isRecording,
  onClick,
  status,
  disabled,
}: MicrophoneButtonProps) {
  return (
    <Button
      className="rounded-full p-1.5 h-fit absolute bottom-2 right-12 m-0.5 border border-border"
      data-testid="microphone-button"
      disabled={disabled || status !== "ready"}
      onClick={(event) => {
        event.preventDefault();
        onClick();
      }}
      variant={isRecording ? "default" : "ghost"}
    >
      {isRecording && (
        <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
      )}
      <MicrophoneIcon
        size={14}
        className={cn("relative z-10", isRecording && "text-red-500")}
      />
    </Button>
  );
}

export const MicrophoneButton = memo(PureMicrophoneButton);
