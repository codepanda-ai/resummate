"use client";

import { PreviewMessage, ThinkingMessage } from "@/components/message";
import { MultimodalInput } from "@/components/multimodal-input";
import { Overview } from "@/components/overview";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { toast } from "sonner";
import React, { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@stackframe/stack";
import { Spinner } from "@/components/ui/spinner";
import { getAuthHeaders } from "@/lib/auth-headers";
import { useTestMode } from "@/hooks/use-test-mode";

export function Chat() {
  const user = useUser({ or: "redirect" });
  const params = useParams();
  const uuid = params?.uuid as string;
  const chatId = uuid || "001";

  const { isTestMode } = useTestMode();
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [initialSessionStatus, setInitialSessionStatus] = useState<string>("NOT_STARTED");

  useEffect(() => {
    // Use setTimeout to avoid synchronous setState in effect
    const timeoutId = setTimeout(() => {
      setIsLoadingHistory(true);
      setInitialMessages([]);
    }, 0);

    const loadHistory = async () => {
      try {
        const headers = await getAuthHeaders(user);
        const sessionRes = await fetch(`/api/session/${chatId}`, { headers });
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          setInitialSessionStatus(sessionData.status ?? "NOT_STARTED");
        }
        const res = await fetch(`/api/chat/history/${chatId}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch chat history');
        const data = await res.json();
        setInitialMessages(data.messages || []);
        setIsLoadingHistory(false);
      } catch {
        toast.error('Failed to load chat history');
        setIsLoadingHistory(false);
      }
    };

    loadHistory();

    return () => clearTimeout(timeoutId);
  }, [chatId, user]);

  const { messages, setMessages, sendMessage, status, stop } = useChat({
    id: chatId,
    messages: initialMessages,
    onError: (error: Error) => {
      if (error.message.includes("Too many requests")) {
        toast.error(
          "You are sending too many messages. Please try again later."
        );
      }
    },
  });

  useEffect(() => {
    if (!isLoadingHistory && initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages)
    }
  }, [isLoadingHistory, initialMessages, messages.length, setMessages])

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  const [input, setInput] = React.useState("");

  const isLoading = status === "submitted" || status === "streaming";

  // Memoize rendered messages to prevent unnecessary re-renders
  // Only re-compute when messages array or isLoading state changes
  const renderedMessages = useMemo(() => {
    return messages.map((message: UIMessage, index: number) => (
      <PreviewMessage
        key={message.id}
        chatId={chatId}
        message={message}
        isLoading={isLoading && messages.length - 1 === index}
      />
    ));
  }, [messages, isLoading, chatId]);

  const handleSubmit = async (event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();
    if (input.trim()) {
      const headers = await getAuthHeaders(user, { testMode: isTestMode });
      sendMessage(
        { text: input },
        {
          headers: headers as Record<string, string>,
          body: {
            id: chatId,
          },
        }
      );
      setInput("");
    }
  };

  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spinner className="h-8 w-8 mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading chat history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-w-0 h-[calc(100dvh-52px)] bg-background">
      <div
        ref={messagesContainerRef}
        className="flex flex-col min-w-0 gap-6 flex-1 overflow-y-scroll pt-4"
      >

        {messages.length === 0 && <Overview />}

        {renderedMessages}

        {isLoading &&
          messages.length > 0 &&
          messages[messages.length - 1].role === "user" && <ThinkingMessage />}

        <div
          ref={messagesEndRef}
          className="shrink-0 min-w-[24px] min-h-[24px]"
        />
      </div>

      <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
        <MultimodalInput
          chatId={chatId}
          input={input}
          setInput={setInput}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          stop={stop}
          messages={messages}
          setMessages={setMessages}
          sendMessage={sendMessage}
          status={status}
          initialSessionStatus={initialSessionStatus}
        />
      </form>
    </div>
  );
}
