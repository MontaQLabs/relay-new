"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/dashboard/Header";
import BottomNav from "@/components/dashboard/BottomNav";
import { NetworkModeProvider } from "@/app/contexts/NetworkModeContext";
import { TestnetBanner } from "@/components/TestnetBanner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSettingsPage = pathname?.startsWith("/dashboard/settings");

  // Get appropriate title based on current page
  const getHeaderTitle = () => {
    if (isSettingsPage) return "Relayer";
    return "Welcome to Relay";
  };

  return (
    <NetworkModeProvider>
      <div className="min-h-screen bg-white flex flex-col pt-safe">
        <TestnetBanner />
        <Header title={getHeaderTitle()} />
        <main className="flex-1 overflow-y-auto pb-24">{children}</main>
        <BottomNav />
      </div>
    </NetworkModeProvider>
  );
}
