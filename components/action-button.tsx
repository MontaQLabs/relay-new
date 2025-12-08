"use client";

import { useRouter } from "next/navigation";

// Map labels to their corresponding routes
const labelRoutes: Record<string, string> = {
  Send: "/dashboard/wallet/send",
  Receive: "/dashboard/wallet/receive",
  Scan: "/dashboard/wallet/scan",
};

// Action Button Component
export const ActionButton = ({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) => {
  const router = useRouter();

  const handleClick = () => {
    const route = labelRoutes[label];
    if (route) {
      router.push(route);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex-1 flex flex-col items-center gap-1.5 py-2 px-2 rounded-xl hover:bg-white/5 transition-colors"
    >
      <div className="text-white">{icon}</div>
      <span className="text-white/80 text-xs font-medium">{label}</span>
    </button>
  );
};
