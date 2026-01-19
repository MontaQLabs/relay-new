"use client";

interface TabButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  variant?: "underline" | "pill";
  activeColor?: string;
}

/**
 * Reusable tab button component
 * Supports underline and pill variants
 */
export function TabButton({
  label,
  isActive,
  onClick,
  variant = "underline",
  activeColor = "violet",
}: TabButtonProps) {
  if (variant === "pill") {
    return (
      <button
        onClick={onClick}
        className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
          isActive
            ? "bg-black text-white"
            : "text-gray-600 hover:text-black"
        }`}
      >
        {label}
      </button>
    );
  }

  // Underline variant (default)
  const underlineColor = activeColor === "violet" ? "bg-violet-500" : "bg-black";

  return (
    <button
      onClick={onClick}
      className={`relative py-3 font-medium transition-colors ${
        isActive ? "text-black" : "text-muted-foreground hover:text-gray-600"
      }`}
    >
      {label}
      {isActive && (
        <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${underlineColor} rounded-full`} />
      )}
    </button>
  );
}

interface TabGroupProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  variant?: "underline" | "pill";
  className?: string;
}

/**
 * Tab group component for rendering multiple tabs
 */
export function TabGroup({
  tabs,
  activeTab,
  onTabChange,
  variant = "underline",
  className = "",
}: TabGroupProps) {
  if (variant === "pill") {
    return (
      <div className={`flex items-center bg-gray-100 rounded-full p-0.5 ${className}`}>
        {tabs.map((tab) => (
          <TabButton
            key={tab}
            label={tab}
            isActive={activeTab === tab}
            onClick={() => onTabChange(tab)}
            variant="pill"
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-6 ${className}`}>
      {tabs.map((tab) => (
        <TabButton
          key={tab}
          label={tab}
          isActive={activeTab === tab}
          onClick={() => onTabChange(tab)}
          variant="underline"
        />
      ))}
    </div>
  );
}
