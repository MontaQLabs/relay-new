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
  showNotification = true,
  notificationCount = 0,
  showSearch = false,
  onSearchClick,
}: HeaderProps) {
  return (
    <header className="flex items-start justify-between px-5 pt-4 pb-3">
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

        {showNotification && (
          <button
            className="relative w-11 h-11 rounded-full border border-border bg-background flex items-center justify-center transition-all duration-200 hover:bg-muted active:scale-95"
            aria-label="Notifications"
          >
            <NotificationBellIcon className="w-5 h-5 text-foreground" />
            {notificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              </span>
            )}
            {/* Red dot indicator */}
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
          </button>
        )}
      </div>
    </header>
  );
}

function NotificationBellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

