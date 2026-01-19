"use client";

import { ReactNode } from "react";

interface SlideInPageProps {
  children: ReactNode;
  isExiting?: boolean;
  className?: string;
  variant?: "light" | "dark";
}

/**
 * Wrapper component for slide-in/slide-out page animations
 * Used for pages that slide in from the right
 */
export function SlideInPage({
  children,
  isExiting = false,
  className = "",
  variant = "light",
}: SlideInPageProps) {
  const bgColor = variant === "dark" ? "bg-black" : "bg-white";
  const animation = isExiting ? "animate-slide-out-right" : "animate-slide-in-right";

  return (
    <div
      className={`fixed inset-0 z-50 ${bgColor} flex flex-col ${animation} ${className}`}
    >
      {children}
    </div>
  );
}
