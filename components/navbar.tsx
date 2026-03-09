"use client";

import { UserButton } from '@stackframe/stack';

export function Navbar() {
  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-14 px-4 flex items-center justify-between bg-background border-b border-border">
      {/* Brand */}
      <span className="text-sm font-semibold tracking-wide text-foreground select-none">
        Resummate
      </span>

      {/* User avatar — keep left of sidebar on desktop */}
      <div className="pr-[270px] hidden sm:flex">
        <UserButton />
      </div>

      {/* Mobile: user avatar on right (sidebar toggle sits here too) */}
      <div className="flex sm:hidden">
        <UserButton />
      </div>
    </div>
  );
};
