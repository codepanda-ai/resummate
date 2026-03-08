"use client";

import React, { memo } from "react";
import { PaperclipIcon } from "../icons";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import type { UseChatHelpers, UIMessage } from "@ai-sdk/react";

interface AttachmentsButtonProps {
  resumeInputRef: React.MutableRefObject<HTMLInputElement | null>;
  jobDescriptionInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<UIMessage>["status"];
  disabled?: boolean;
}

function PureAttachmentsButton({
  resumeInputRef,
  jobDescriptionInputRef,
  status,
  disabled = false,
}: AttachmentsButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className="rounded-full p-1.5 h-fit absolute bottom-2 left-2 m-0.5 border border-border"
          data-testid="attachments-button"
          disabled={disabled || status !== "ready"}
          variant="ghost"
        >
          <PaperclipIcon size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-screen md:w-auto md:min-w-[160px]">
        <DropdownMenuItem
          onClick={() => {
            resumeInputRef.current?.click();
          }}
          className="w-full h-12 cursor-pointer"
        >
          Resume
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            jobDescriptionInputRef.current?.click();
          }}
          className="w-full h-12 cursor-pointer"
        >
          Job Description
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const AttachmentsButton = memo(PureAttachmentsButton);
