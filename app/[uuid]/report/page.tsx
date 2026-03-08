"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@stackframe/stack";
import { Streamdown } from "streamdown";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthHeaders } from "@/lib/auth-headers";

export default function ReportPage() {
  const user = useUser({ or: "redirect" });
  const router = useRouter();
  const { uuid } = useParams<{ uuid: string }>();
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const headers = await getAuthHeaders(user);
        const response = await fetch(`/api/session/${uuid}/report`, { headers });
        if (!response.ok) {
          setError("Report not found. Please generate the report first.");
          return;
        }
        const data = await response.json();
        setReport(data.report);
      } catch {
        setError("Failed to load report. Please try again.");
      }
    };

    if (uuid) {
      fetchReport();
    }
  }, [uuid, user]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => router.push(`/${uuid}`)}
          className="mb-6 flex items-center gap-2 text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft size={16} />
          Back to home
        </Button>

        {!report && !error && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="text-center py-24 text-muted-foreground">{error}</div>
        )}

        {report && (
          <div className="prose prose-invert max-w-none">
            <Streamdown>{report}</Streamdown>
          </div>
        )}
      </div>
    </div>
  );
}
