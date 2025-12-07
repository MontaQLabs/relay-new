"use client";

import { Search } from "lucide-react";

interface HeaderProps {
  greeting?: string;
  title?: string;
  showNotification?: boolean;
  notificationCount?: number;
  showSearch?: boolean;
  onSearchClick?: () => void;
}

export default function Header({
  greeting = "Hello,",
  title = "Welcome to Relay",
  showSearch = false,
  onSearchClick,
}: HeaderProps) {
  return (
    <header className="flex items-start justify-between px-6 pt-4 pb-3">
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground font-medium">
          {greeting}
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-black">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {showSearch && (
          <button
            onClick={onSearchClick}
            className="relative w-11 h-11 rounded-full border border-border bg-background flex items-center justify-center transition-all duration-200 hover:bg-muted active:scale-95"
            aria-label="Search"
          >
            <Search className="w-5 h-5 text-foreground" />
          </button>
        )}
      </div>
    </header>
  );
}
