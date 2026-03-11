"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@stackframe/stack";
import { Streamdown } from "streamdown";
import { ArrowLeft, Loader2, MoreHorizontal, Download, Share2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

  const handleDownload = () => {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview-report-${uuid}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShareLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard!");
  };

  const handleCopy = async () => {
    if (!report) return;
    await navigator.clipboard.writeText(report);
    toast.success("Report copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/${uuid}`)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft size={16} />
            Back to home
          </Button>

          {report && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                  <MoreHorizontal size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleDownload}>
                  <Download size={14} className="mr-2" />
                  Download report
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShareLink}>
                  <Share2 size={14} className="mr-2" />
                  Share link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopy}>
                  <Copy size={14} className="mr-2" />
                  Copy
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {!report && !error && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="text-center py-24 text-muted-foreground">{error}</div>
        )}

        {report && (
          <div className="prose prose-invert max-w-none" data-testid="report-content">
            <Streamdown>{report}</Streamdown>
          </div>
        )}
      </div>
    </div>
  );
}
