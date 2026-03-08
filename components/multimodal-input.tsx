"use client";

import { motion } from "framer-motion";
import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { toast } from "sonner";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { useUser } from "@stackframe/stack";

import { cn, sanitizeUIMessages } from "@/lib/utils";
import { getAuthHeadersForFormData, getAuthHeaders } from "@/lib/auth-headers";
import { useTestMode } from "@/hooks/use-test-mode";

import { ArrowUpIcon, StopIcon } from "./icons";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { FileAttachment as FileAttachmentComponent } from "./file-attachment";
import { AttachmentsButton } from "./ui/attachments-button";
import { MicrophoneButton } from "./ui/microphone-button";
import { SpeechRecordingOverlay } from "./speech-recording-overlay";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

import type { UIMessage, UseChatHelpers } from "@ai-sdk/react";

type ChatRequestOptions = {
  headers?: Record<string, string> | Headers;
  body?: object;
  data?: unknown;
};

const START_INTERVIEW_MESSAGE =
  "Start an interview session with the user based on the uploaded resume and job description";
const END_INTERVIEW_MESSAGE =
  "Generate a markdown evaluation report of the user's interview performance with a score out of 100, and an offer/no offer decision. List strengths and areas for improvement";

export function MultimodalInput({
  chatId,
  input,
  setInput,
  isLoading,
  stop,
  messages,
  setMessages,
  sendMessage,
  handleSubmit,
  status,
  className,
}: {
  chatId: string;
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  stop: () => void;
  messages: Array<UIMessage>;
  setMessages: Dispatch<SetStateAction<Array<UIMessage>>>;
  sendMessage: UseChatHelpers<UIMessage>['sendMessage']
  handleSubmit: (
    event?: {
      preventDefault?: () => void;
    },
    chatRequestOptions?: ChatRequestOptions
  ) => void;
  status: UseChatHelpers<UIMessage>["status"];
  className?: string;
}) {
  const user = useUser({ or: "redirect" });
  const { isTestMode } = useTestMode();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jobDescriptionInputRef = useRef<HTMLInputElement>(null);
  const [isResumeLoading, setIsResumeLoading] = useState<boolean>(false);
  const [isJobDescriptionLoading, setIsJobDescriptionLoading] = useState<boolean>(false);
  const [attachedResume, setAttachedResume] = useState<{ name: string; type: string } | null>(null);
  const [attachedJobDescription, setAttachedJobDescription] = useState<{ name: string; type: string } | null>(null);
  const [interviewEnded, setInterviewEnded] = useState(false);

  const interviewStarted = messages.length > 0;
  const canStartInterview = !!attachedResume && !!attachedJobDescription;

  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleTranscriptReady = useCallback(
    async (text: string) => {
      const headers = await getAuthHeaders(user, { testMode: isTestMode });
      sendMessage(
        {
          role: "user",
          parts: [{ type: "text", text }],
        },
        {
          headers: headers as Record<string, string>,
          body: { id: chatId },
        }
      );
    },
    [user, isTestMode, sendMessage, chatId]
  );

  const {
    state: speechState,
    transcript: speechTranscript,
    isSupported: isSpeechSupported,
    startRecording,
    stopRecording,
    error: speechError,
  } = useSpeechRecognition(handleTranscriptReady);

  useEffect(() => {
    if (speechError) {
      toast.error(speechError);
    }
  }, [speechError]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
    adjustHeight();
  };

  const uploadResume = useCallback(async (file: File, chatId: string) => {
    setIsResumeLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("uuid", chatId);

    // Store the attached file info
    const fileType = file.type.split('/')[1]?.toUpperCase() || 'PDF';
    setAttachedResume({
      name: file.name,
      type: fileType,
    });

    try {
      const headers = await getAuthHeadersForFormData(user);
      const response = await fetch("/api/resume/upload", {
        method: "POST",
        headers: headers,
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(file.name + " uploaded successfully!");

        return {
          url: data.url,
          name: data.pathname,
          contentType: data.contentType,
        };
      } else {
        toast.error("Failed to upload resume, please try again!");
      }
    } catch {
      toast.error("Failed to upload resume, please try again!");
    } finally {
      setIsResumeLoading(false);
    }
  }, [user]);

  const submitForm = useCallback(() => {
    handleSubmit(undefined, {});
    setLocalStorageInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [handleSubmit, setLocalStorageInput, width]);

  const handleStartInterview = useCallback(async () => {
    const headers = await getAuthHeaders(user, { testMode: isTestMode });
    sendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: START_INTERVIEW_MESSAGE }],
      },
      {
        headers: headers as Record<string, string>,
        body: { id: chatId },
      }
    );
  }, [user, isTestMode, sendMessage, chatId]);

  const handleEndInterview = useCallback(async () => {
    const headers = await getAuthHeaders(user, { testMode: isTestMode });
    sendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: END_INTERVIEW_MESSAGE }],
      },
      {
        headers: headers as Record<string, string>,
        body: { id: chatId },
      }
    );
    setInterviewEnded(true);
  }, [user, isTestMode, sendMessage, chatId]);

  const removeResume = useCallback(async (chatId: string) => {
    setAttachedResume(null);
    try {
      const headers = await getAuthHeaders(user);
      const response = await fetch(`/api/resume/${chatId}`, {
        method: "DELETE",
        headers: headers,
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
      } else {
        toast.error("Failed to delete resume, please try again!");
      }
    } catch (error) {
      console.error(error);
    }
  }, [user]);

  const uploadJobDescription = useCallback(async (file: File, chatId: string) => {
    setIsJobDescriptionLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("uuid", chatId);
    formData.append("type", "job-description");

    const fileType = file.type.split('/')[1]?.toUpperCase() || 'PDF';
    setAttachedJobDescription({
      name: file.name,
      type: fileType,
    });

    try {
      const headers = await getAuthHeadersForFormData(user);
      const response = await fetch("/api/job-description/upload", {
        method: "POST",
        headers: headers,
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(file.name + " uploaded successfully!");

        return {
          url: data.url,
          name: data.pathname,
          contentType: data.contentType,
        };
      } else {
        toast.error("Failed to upload job description, please try again!");
      }
    } catch {
      toast.error("Failed to upload job description, please try again!");
    } finally {
      setIsJobDescriptionLoading(false);
    }
  }, [user]);

  const removeJobDescription = useCallback(async (chatId: string) => {
    setAttachedJobDescription(null);
    try {
      const headers = await getAuthHeaders(user);
      const response = await fetch(`/api/job-description/${chatId}`, {
        method: "DELETE",
        headers: headers,
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
      } else {
        toast.error("Failed to delete job description, please try again!");
      }
    } catch (error) {
      console.error(error);
    }
  }, [user]);

  // Load both resume and job description in parallel with abort controller
  useEffect(() => {
    const abortController = new AbortController();
    const { signal } = abortController;

    const loadFiles = async () => {
      try {
        const headers = await getAuthHeaders(user);
        await Promise.all([
          fetch(`/api/resume/${chatId}`, { method: "GET", headers: headers, signal })
            .then(async (response) => {
              if (response.ok) {
                const data = await response.json();
                const fileType = data.contentType.split('/')[1]?.toUpperCase() || 'PDF';
                setAttachedResume({
                  name: data.name,
                  type: fileType,
                });
              } else {
                setAttachedResume(null);
              }
            })
            .catch((error) => {
              if (error.name !== 'AbortError') {
                console.error(error);
                setAttachedResume(null);
              }
            }),
          fetch(`/api/job-description/${chatId}`, { method: "GET", headers: headers, signal })
            .then(async (response) => {
              if (response.ok) {
                const data = await response.json();
                const fileType = data.contentType.split('/')[1]?.toUpperCase() || 'PDF';
                setAttachedJobDescription({
                  name: data.name,
                  type: fileType,
                });
              } else {
                setAttachedJobDescription(null);
              }
            })
            .catch((error) => {
              if (error.name !== 'AbortError') {
                console.error(error);
                setAttachedJobDescription(null);
              }
            })
        ]);
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Error loading files:', error);
        }
      }
    };

    loadFiles();

    // Cleanup: abort ongoing requests when chatId changes or component unmounts
    return () => {
      abortController.abort();
    };
  }, [chatId, user]);

  return (
    <div className="relative w-full flex flex-col gap-4">
      {!interviewEnded && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 }}
          className="w-full"
        >
          {interviewStarted ? (
            <Button
              variant="destructive"
              onClick={handleEndInterview}
              disabled={isLoading}
              className="w-full rounded-xl px-4 py-3.5 text-sm h-auto"
            >
              End interview session
            </Button>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-full">
                    <Button
                      variant="default"
                      onClick={handleStartInterview}
                      disabled={!canStartInterview || isLoading}
                      className="w-full rounded-xl px-4 py-3.5 text-sm h-auto"
                    >
                      Start interview session
                    </Button>
                  </span>
                </TooltipTrigger>
                {!canStartInterview && (
                  <TooltipContent side="top">
                    <p>Upload both a resume and job description to start</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </motion.div>
      )}

      {/* File Attachments */}
      {(attachedResume || isResumeLoading || attachedJobDescription || isJobDescriptionLoading) && (
        <div className="grid grid-cols-2 gap-2 w-full">
          {(attachedResume || isResumeLoading) && (
            <FileAttachmentComponent
              fileName={attachedResume?.name || "Resume"}
              fileType={attachedResume?.type || "PDF"}
              onRemove={() => removeResume(chatId)}
              isLoading={isResumeLoading}
            />
          )}
          {(attachedJobDescription || isJobDescriptionLoading) && (
            <FileAttachmentComponent
              fileName={attachedJobDescription?.name || "Job Description"}
              fileType={attachedJobDescription?.type || "PDF"}
              onRemove={() => removeJobDescription(chatId)}
              isLoading={isJobDescriptionLoading}
            />
          )}
        </div>
      )}

      <Textarea
        ref={textareaRef}
        placeholder={canStartInterview ? "Send a message..." : "Upload a resume and job description to begin"}
        value={input || ""}
        onChange={handleInput}
        disabled={!canStartInterview}
        className={cn(
          "min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-xl !text-base bg-muted",
          className
        )}
        rows={3}
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();

            if (isLoading) {
              toast.error("Please wait for the model to finish its response!");
            } else {
              submitForm();
            }
          }
        }}
      />

      <input
        ref={resumeInputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            uploadResume(file, chatId);
          }
        }}
        accept="application/pdf"
      />

      <input
        ref={jobDescriptionInputRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            uploadJobDescription(file, chatId);
          }
        }}
        accept="application/pdf"
      />

      <AttachmentsButton
        resumeInputRef={resumeInputRef}
        jobDescriptionInputRef={jobDescriptionInputRef}
        status={status}
      />

      {isSpeechSupported && !isLoading && (
        <MicrophoneButton
          isRecording={speechState === "recording"}
          onClick={startRecording}
          status={status}
          disabled={!canStartInterview}
        />
      )}

      {isLoading ? (
        <Button
          className="rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 border border-border"
          onClick={(event) => {
            event.preventDefault();
            stop();
            setMessages((messages) => sanitizeUIMessages(messages));
          }}
        >
          <StopIcon size={14} />
        </Button>
      ) : (
        <Button
          className="rounded-full p-1.5 h-fit absolute bottom-2 right-2 m-0.5 border border-border"
          onClick={(event) => {
            event.preventDefault();
            submitForm();
          }}
          disabled={!canStartInterview || !input || input.length === 0}
        >
          <ArrowUpIcon size={14} />
        </Button>
      )}

      <SpeechRecordingOverlay
        state={speechState}
        transcript={speechTranscript}
        onStopRecording={stopRecording}
      />
    </div>
  );
}