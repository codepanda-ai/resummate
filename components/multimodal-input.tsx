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
import { useRouter } from "next/navigation";

import { cn, sanitizeUIMessages } from "@/lib/utils";
import { getAuthHeaders } from "@/lib/auth-headers";
import { useTestMode } from "@/hooks/use-test-mode";
import { useDocuments } from "@/hooks/use-documents";

import { Play, StopCircle, Sparkles, Loader2, ArrowRight } from "lucide-react";

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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";

import type { UIMessage, UseChatHelpers } from "@ai-sdk/react";

type ChatRequestOptions = {
  headers?: Record<string, string> | Headers;
  body?: object;
  data?: unknown;
};

const START_INTERVIEW_MESSAGE =
  "Start an interview session. I've attached my resume and the job description — please review them carefully, then greet me, briefly explain the interview format, and open with your first question tailored to a specific project, skill, or experience from my resume that directly aligns with the role.";

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
  initialSessionStatus = "NOT_STARTED",
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
  initialSessionStatus?: string;
  className?: string;
}) {
  const user = useUser({ or: "redirect" });
  const { isTestMode } = useTestMode();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jobDescriptionInputRef = useRef<HTMLInputElement>(null);
  const {
    attachedResume,
    attachedJobDescription,
    isResumeLoading,
    isJobDescriptionLoading,
    uploadResume,
    uploadJobDescription,
    removeResume,
    removeJobDescription,
  } = useDocuments(chatId, user);
  const [sessionStatus, setSessionStatus] = useState(initialSessionStatus);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isStartingInterview, setIsStartingInterview] = useState(false);
  const [isEndingInterview, setIsEndingInterview] = useState(false);

  useEffect(() => {
    setSessionStatus(initialSessionStatus);
  }, [initialSessionStatus]);

  const isNotStarted = sessionStatus === "NOT_STARTED";
  const isInProgress = sessionStatus === "IN_PROGRESS";
  const isEnded = sessionStatus === "ENDED";
  const interviewStarted = !isNotStarted || messages.length > 0;
  const interviewEnded = isEnded;
  const canStartInterview =
    !!attachedResume &&
    !!attachedJobDescription &&
    !isResumeLoading &&
    !isJobDescriptionLoading;

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

  const submitForm = useCallback(() => {
    handleSubmit(undefined, {});
    setLocalStorageInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [handleSubmit, setLocalStorageInput, width]);

  const handleStartInterview = useCallback(async () => {
    setIsStartingInterview(true);
    try {
      const headers = await getAuthHeaders(user, { testMode: isTestMode });
      await fetch(`/api/session/${chatId}/start`, { method: "PATCH", headers });
      setSessionStatus("IN_PROGRESS");
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
    } finally {
      setIsStartingInterview(false);
    }
  }, [user, isTestMode, sendMessage, chatId]);

  const handleEndInterview = useCallback(async () => {
    setIsEndingInterview(true);
    try {
      const headers = await getAuthHeaders(user, { testMode: isTestMode });
      await fetch(`/api/session/${chatId}/end`, { method: "PATCH", headers });
      setSessionStatus("ENDED");
    } finally {
      setIsEndingInterview(false);
    }
  }, [user, isTestMode, chatId]);

  const handleGenerateFeedback = useCallback(async () => {
    setIsGeneratingReport(true);
    try {
      const headers = await getAuthHeaders(user, { testMode: isTestMode });
      // If a report already exists, navigate directly without regenerating
      const existing = await fetch(`/api/session/${chatId}/report`, { headers });
      if (existing.ok) {
        router.push(`/${chatId}/report`);
        return;
      }
      const response = await fetch(`/api/session/${chatId}/report`, {
        method: "POST",
        headers,
      });
      if (!response.ok) {
        throw new Error("Failed to generate report");
      }
      router.push(`/${chatId}/report`);
    } catch {
      toast.error("Failed to generate feedback report, please try again!");
      setIsGeneratingReport(false);
    }
  }, [user, isTestMode, chatId, router]);

  return (
    <div className="relative w-full flex flex-col gap-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.05 }}
        className="w-full"
      >
        {interviewEnded ? (
          <Button
            onClick={handleGenerateFeedback}
            disabled={isGeneratingReport}
            data-testid="view-report-btn"
            className="w-full rounded-xl px-4 py-3.5 text-sm h-auto bg-blue-900 hover:bg-blue-950 text-white opacity-100 flex items-center justify-start gap-2"
          >
            {isGeneratingReport ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating feedback...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                View feedback report
                <ArrowRight size={16} className="ml-auto" />
              </>
            )}
          </Button>
        ) : interviewStarted ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="destructive"
                disabled={isLoading || isEndingInterview}
                data-testid="end-interview-btn"
                className="w-full rounded-xl px-4 py-3.5 text-sm h-auto flex items-center gap-2"
              >
                {isEndingInterview ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Ending interview...
                  </>
                ) : (
                  <>
                    <StopCircle size={16} />
                    End interview session
                  </>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>End interview session?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will stop the interview and you won&apos;t be able to
                  continue answering questions. You can still view your feedback
                  report afterwards.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleEndInterview}
                  data-testid="end-interview-confirm-btn"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  End interview
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-full">
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleStartInterview}
                    disabled={!canStartInterview || isLoading || isStartingInterview}
                    data-testid="start-interview-btn"
                    className="w-full rounded-xl px-4 py-3.5 text-sm h-auto flex items-center gap-2"
                  >
                    {isStartingInterview ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Starting interview...
                      </>
                    ) : (
                      <>
                        <Play size={16} />
                        Start interview session
                      </>
                    )}
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

      {/* File Attachments */}
      {(attachedResume || isResumeLoading || attachedJobDescription || isJobDescriptionLoading) && (
        <div className="grid grid-cols-2 gap-2 w-full">
          {(attachedResume || isResumeLoading) && (
            <FileAttachmentComponent
              fileName={attachedResume?.name || "Resume"}
              fileType={attachedResume?.type || "PDF"}
              onRemove={isInProgress || isEnded ? undefined : () => removeResume(chatId)}
              isLoading={isResumeLoading}
            />
          )}
          {(attachedJobDescription || isJobDescriptionLoading) && (
            <FileAttachmentComponent
              fileName={attachedJobDescription?.name || "Job Description"}
              fileType={attachedJobDescription?.type || "PDF"}
              onRemove={isInProgress || isEnded ? undefined : () => removeJobDescription(chatId)}
              isLoading={isJobDescriptionLoading}
            />
          )}
        </div>
      )}

      <Textarea
        ref={textareaRef}
        placeholder={isEnded ? "Interview session ended" : isNotStarted ? (canStartInterview ? "Start the interview to begin" : "Upload a resume and job description to begin") : "Send a message..."}
        value={input || ""}
        onChange={handleInput}
        disabled={isNotStarted || isEnded}
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
        data-testid="resume-file-input"
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
        data-testid="job-description-file-input"
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
        disabled={isInProgress || isEnded}
      />

      {isSpeechSupported && !isLoading && (
        <MicrophoneButton
          isRecording={speechState === "recording"}
          onClick={startRecording}
          status={status}
          disabled={isNotStarted || isEnded}
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
          disabled={isNotStarted || isEnded || !input || input.length === 0}
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