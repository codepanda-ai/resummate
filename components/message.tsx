"use client";

import type { UIMessage } from "@ai-sdk/react";
import { motion } from "framer-motion";
import { Streamdown } from "streamdown";
import { memo } from "react";

import { SparklesIcon } from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import { TtsButton } from "./tts-button";
import { cn } from "@/lib/utils";

const PreviewMessageComponent = ({
  message,
}: {
  chatId: string;
  message: UIMessage;
  isLoading: boolean;
}) => {
  const ttsText =
    message.role === "assistant"
      ? (message.parts
          ?.filter((p: unknown) => (p as { type?: string }).type === "text")
          .map((p: unknown) => (p as { text?: string }).text ?? "")
          .join(" ") ?? "")
      : "";

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-role={message.role}
    >
      <div
        className={cn(
          "group-data-[role=user]/message:bg-primary group-data-[role=user]/message:text-primary-foreground flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl"
        )}
      >
        {message.role === "assistant" && (
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="size-8 flex items-center rounded-full justify-center ring-1 ring-border">
              <SparklesIcon size={14} />
            </div>
            {ttsText && <TtsButton text={ttsText} />}
          </div>
        )}

        <div className="flex flex-col gap-2 w-full">
          {message.parts &&
            message.parts.map((part: unknown, index: number) => {
              // Type guard for the part object
              const typedPart = part as { type?: string; text?: string; toolCallId?: string; state?: string; output?: unknown };
              if (typedPart.type === "text") {
                return (
                  <div key={index} className="flex flex-col gap-4">
                    <Streamdown>{typedPart.text}</Streamdown>
                  </div>
                );
              }
              // Handle tool calls - type is "tool-{toolName}" in AI SDK v5
              if (typedPart.type?.startsWith("tool-")) {
                const { toolCallId, state, output } = typedPart;

                if (state === "output-available" && output) {
                  return (
                    <div key={toolCallId}>
                        <pre>{JSON.stringify(output, null, 2)}</pre>
                    </div>
                  );
                }
                // Show loading state while tool is executing
                if (
                  state === "input-streaming" ||
                  state === "input-available"
                ) {
                  return (
                    <div
                      key={toolCallId}
                      className={cn({
                        skeleton: true,
                      })}
                    >
                    </div>
                  );
                }
              }
              if (typedPart.type === "file") {
                return (
                  <PreviewAttachment
                    key={index}
                    attachment={typedPart as never}
                  />
                );
              }
              return null;
            })}
        </div>
      </div>
    </motion.div>
  );
};

// Memoize PreviewMessage to prevent unnecessary re-renders
// Only re-render if message content or isLoading state changes
export const PreviewMessage = memo(
  PreviewMessageComponent,
  (prevProps, nextProps) => {
    // If isLoading changes for this message, re-render
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    
    // If message ID is different, re-render
    if (prevProps.message.id !== nextProps.message.id) {
      return false;
    }
    
    // Deep compare message parts for streaming updates
    const prevParts = JSON.stringify(prevProps.message.parts);
    const nextParts = JSON.stringify(nextProps.message.parts);
    
    if (prevParts !== nextParts) {
      return false;
    }
    
    // Otherwise, skip re-render (return true means "props are equal, skip render")
    return true;
  }
);

PreviewMessage.displayName = "PreviewMessage";

export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cn(
          "flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl",
          {
            "group-data-[role=user]/message:bg-muted": true,
          }
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Thinking...
          </div>
        </div>
      </div>
    </motion.div>
  );
};
