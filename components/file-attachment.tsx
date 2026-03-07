"use client"

import { FileText, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface FileAttachmentProps {
  fileName: string
  fileType: string
  onRemove?: () => void
  isLoading?: boolean
}

export function FileAttachment({ fileName, fileType, onRemove, isLoading }: FileAttachmentProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5 pr-2 w-full min-w-0">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted-foreground/10">
          <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>

        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="h-4 w-24 rounded bg-muted-foreground/20 animate-pulse" />
          <div className="h-3 w-12 rounded bg-muted-foreground/20 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5 pr-2 w-full min-w-0">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-red-400 to-orange-500">
        <FileText className="h-7 w-7 text-white" strokeWidth={2} />
      </div>

      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground leading-tight truncate">{fileName}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{fileType}</p>
      </div>

      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="ml-auto h-8 w-8 shrink-0 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground"
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
