"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@stackframe/stack";
import { getAuthHeaders } from "@/lib/auth-headers";
import { MessageIcon, PlusIcon, CrossIcon, MenuIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

interface SessionItem {
  id: string;
  status: string;
  created_at: string;
}

function formatSessionDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

function StatusDot({ status }: { status: string }) {
  const colorClass =
    status === "IN_PROGRESS"
      ? "bg-green-400"
      : status === "FINISHED"
      ? "bg-blue-400"
      : "bg-muted-foreground";

  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0 mt-0.5", colorClass)}
      aria-hidden="true"
    />
  );
}

export function SessionSidebar() {
  const user = useUser({ or: "redirect" });
  const router = useRouter();
  const params = useParams();
  const activeId = params?.uuid as string | undefined;

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const headers = await getAuthHeaders(user);
      const res = await fetch("/api/session", { headers });
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      // silently fail — sidebar is non-critical
    }
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions, activeId]);

  const handleNewSession = useCallback(() => {
    const uuid = crypto.randomUUID();
    router.push(`/${uuid}`);
    setIsOpen(false);
  }, [router]);

  const handleSelectSession = useCallback(
    (id: string) => {
      router.push(`/${id}`);
      setIsOpen(false);
    },
    [router]
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="fixed top-3 right-14 z-50 flex sm:hidden items-center justify-center h-8 w-8 rounded-md text-foreground hover:bg-accent transition-colors"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Close session history" : "Open session history"}
      >
        {isOpen ? <CrossIcon size={16} /> : <MenuIcon size={16} />}
      </button>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 sm:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          // Base layout — fixed on the right
          "fixed top-0 right-0 z-40 h-full w-[270px] flex flex-col",
          "border-l border-border bg-sidebar",
          // Mobile: slide in/out
          "transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
          // Desktop: always visible
          "sm:translate-x-0"
        )}
        aria-label="Session history"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border shrink-0">
          <span className="text-sm font-semibold text-foreground tracking-wide">
            Sessions
          </span>
          <button
            onClick={handleNewSession}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            aria-label="New session"
          >
            <PlusIcon size={12} />
            New
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <MessageIcon size={20} />
              <p className="text-xs text-muted-foreground leading-relaxed">
                No sessions yet.
                <br />
                Start a new interview session to get going.
              </p>
            </div>
          ) : (
            <ul role="list">
              {sessions.map((session) => {
                const isActive = session.id === activeId;
                return (
                  <li key={session.id}>
                    <button
                      onClick={() => handleSelectSession(session.id)}
                      className={cn(
                        "w-full flex items-start gap-2.5 px-4 py-2.5 text-left transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/60 text-foreground"
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <StatusDot status={session.status} />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium truncate leading-snug">
                          {formatSessionDate(session.created_at)}
                        </span>
                        <span className="text-[11px] text-muted-foreground capitalize leading-snug mt-0.5">
                          {session.status.replace("_", " ").toLowerCase()}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
