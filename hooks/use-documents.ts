"use client";

import { useState, useEffect, useCallback } from "react";
import type { CurrentUser } from "@stackframe/stack";
import { getAuthHeaders, getAuthHeadersForFormData } from "@/lib/auth-headers";
import { toast } from "sonner";

interface DocumentInfo {
  name: string;
  type: string;
}

export interface UseDocumentsReturn {
  attachedResume: DocumentInfo | null;
  attachedJobDescription: DocumentInfo | null;
  isResumeLoading: boolean;
  isJobDescriptionLoading: boolean;
  uploadResume: (file: File, chatId: string) => Promise<void>;
  uploadJobDescription: (file: File, chatId: string) => Promise<void>;
  removeResume: (chatId: string) => Promise<void>;
  removeJobDescription: (chatId: string) => Promise<void>;
}

// --- Cache helpers ---

function resumeCacheKey(chatId: string) {
  return `resummate-resume-${chatId}`;
}

function jdCacheKey(chatId: string) {
  return `resummate-jd-${chatId}`;
}

function readCache(key: string): DocumentInfo | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as DocumentInfo;
  } catch {
    return null;
  }
}

function writeCache(key: string, doc: DocumentInfo | null): void {
  try {
    if (doc === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(doc));
    }
  } catch {
    // Silent: quota exceeded or private browsing
  }
}

function contentTypeToDisplayType(contentType: string): string {
  return contentType.split("/")[1]?.toUpperCase() ?? "PDF";
}

// --- Hook ---

export function useDocuments(
  chatId: string,
  user: CurrentUser
): UseDocumentsReturn {
  // Lazy initializers read from localStorage synchronously on first render,
  // so the component never flickers to empty state on page refresh.
  const [attachedResume, setAttachedResume] = useState<DocumentInfo | null>(
    () => {
      if (typeof window === "undefined") return null;
      return readCache(resumeCacheKey(chatId));
    }
  );

  const [attachedJobDescription, setAttachedJobDescription] =
    useState<DocumentInfo | null>(() => {
      if (typeof window === "undefined") return null;
      return readCache(jdCacheKey(chatId));
    });

  const [isResumeLoading, setIsResumeLoading] = useState(false);
  const [isJobDescriptionLoading, setIsJobDescriptionLoading] = useState(false);

  // Background revalidation: runs after paint to validate cached data against
  // the server. On chatId change, syncs state to the new session's cache first.
  useEffect(() => {
    setAttachedResume(readCache(resumeCacheKey(chatId)));
    setAttachedJobDescription(readCache(jdCacheKey(chatId)));

    const abortController = new AbortController();
    const { signal } = abortController;

    const revalidate = async () => {
      try {
        const headers = await getAuthHeaders(user);

        const [resumeResult, jdResult] = await Promise.allSettled([
          fetch(`/api/resume/${chatId}`, {
            method: "GET",
            headers,
            signal,
          }).then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              return {
                name: data.name,
                type: contentTypeToDisplayType(data.contentType),
              };
            }
            return null;
          }),
          fetch(`/api/job-description/${chatId}`, {
            method: "GET",
            headers,
            signal,
          }).then(async (res) => {
            if (res.ok) {
              const data = await res.json();
              return {
                name: data.name,
                type: contentTypeToDisplayType(data.contentType),
              };
            }
            return null;
          }),
        ]);

        if (signal.aborted) return;

        if (resumeResult.status === "fulfilled") {
          setAttachedResume(resumeResult.value);
          writeCache(resumeCacheKey(chatId), resumeResult.value);
        }

        if (jdResult.status === "fulfilled") {
          setAttachedJobDescription(jdResult.value);
          writeCache(jdCacheKey(chatId), jdResult.value);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        // Network failure: keep stale cache in place, degrade silently
        console.error("Document revalidation failed:", error);
      }
    };

    revalidate();

    return () => {
      abortController.abort();
    };
  }, [chatId, user]);

  const uploadResume = useCallback(
    async (file: File, chatId: string) => {
      setIsResumeLoading(true);
      const doc: DocumentInfo = {
        name: file.name,
        type: contentTypeToDisplayType(file.type),
      };
      setAttachedResume(doc);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("uuid", chatId);
        const headers = await getAuthHeadersForFormData(user);
        const response = await fetch("/api/resume/upload", {
          method: "POST",
          headers,
          body: formData,
        });

        if (response.ok) {
          toast.success(`${file.name} uploaded successfully!`);
          writeCache(resumeCacheKey(chatId), doc);
        } else {
          toast.error("Failed to upload resume, please try again!");
          setAttachedResume(readCache(resumeCacheKey(chatId)));
        }
      } catch {
        toast.error("Failed to upload resume, please try again!");
        setAttachedResume(readCache(resumeCacheKey(chatId)));
      } finally {
        setIsResumeLoading(false);
      }
    },
    [user]
  );

  const uploadJobDescription = useCallback(
    async (file: File, chatId: string) => {
      setIsJobDescriptionLoading(true);
      const doc: DocumentInfo = {
        name: file.name,
        type: contentTypeToDisplayType(file.type),
      };
      setAttachedJobDescription(doc);

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("uuid", chatId);
        formData.append("type", "job-description");
        const headers = await getAuthHeadersForFormData(user);
        const response = await fetch("/api/job-description/upload", {
          method: "POST",
          headers,
          body: formData,
        });

        if (response.ok) {
          toast.success(`${file.name} uploaded successfully!`);
          writeCache(jdCacheKey(chatId), doc);
        } else {
          toast.error("Failed to upload job description, please try again!");
          setAttachedJobDescription(readCache(jdCacheKey(chatId)));
        }
      } catch {
        toast.error("Failed to upload job description, please try again!");
        setAttachedJobDescription(readCache(jdCacheKey(chatId)));
      } finally {
        setIsJobDescriptionLoading(false);
      }
    },
    [user]
  );

  const removeResume = useCallback(
    async (chatId: string) => {
      setAttachedResume(null);
      try {
        const headers = await getAuthHeaders(user);
        const response = await fetch(`/api/resume/${chatId}`, {
          method: "DELETE",
          headers,
        });
        if (response.ok) {
          const data = await response.json();
          toast.success(data.message);
          writeCache(resumeCacheKey(chatId), null);
        } else {
          toast.error("Failed to delete resume, please try again!");
        }
      } catch (error) {
        console.error(error);
      }
    },
    [user]
  );

  const removeJobDescription = useCallback(
    async (chatId: string) => {
      setAttachedJobDescription(null);
      try {
        const headers = await getAuthHeaders(user);
        const response = await fetch(`/api/job-description/${chatId}`, {
          method: "DELETE",
          headers,
        });
        if (response.ok) {
          const data = await response.json();
          toast.success(data.message);
          writeCache(jdCacheKey(chatId), null);
        } else {
          toast.error("Failed to delete job description, please try again!");
        }
      } catch (error) {
        console.error(error);
      }
    },
    [user]
  );

  return {
    attachedResume,
    attachedJobDescription,
    isResumeLoading,
    isJobDescriptionLoading,
    uploadResume,
    uploadJobDescription,
    removeResume,
    removeJobDescription,
  };
}
