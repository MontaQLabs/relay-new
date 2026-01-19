"use client";

import { ChevronLeft } from "lucide-react";

interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  rightContent?: React.ReactNode;
  className?: string;
  variant?: "default" | "dark" | "transparent";
}

/**
 * Reusable page header with back button and centered title
 */
export function PageHeader({
  title,
  onBack,
  rightContent,
  className = "",
  variant = "default",
}: PageHeaderProps) {
  const variantStyles = {
    default: {
      bg: "",
      text: "text-black",
      button: "hover:bg-gray-100",
    },
    dark: {
      bg: "bg-black",
      text: "text-white",
      button: "hover:bg-white/10",
    },
    transparent: {
      bg: "bg-transparent",
      text: "text-black",
      button: "hover:bg-white/50",
    },
  };

  const styles = variantStyles[variant];

  return (
    <header
      className={`flex items-center justify-between px-4 py-4 relative ${styles.bg} ${className}`}
    >
      {onBack ? (
        <button
          onClick={onBack}
          className={`p-2 -ml-2 rounded-full transition-colors ${styles.button}`}
          aria-label="Go back"
        >
          <ChevronLeft className={`w-6 h-6 ${styles.text}`} />
        </button>
      ) : (
        <div className="w-10" />
      )}
      <h1
        className={`absolute left-1/2 -translate-x-1/2 text-lg font-semibold ${styles.text}`}
      >
        {title}
      </h1>
      {rightContent || <div className="w-10" />}
    </header>
  );
}
