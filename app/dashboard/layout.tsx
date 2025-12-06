"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/dashboard/Header";
import BottomNav from "@/components/dashboard/BottomNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isCommunityPage = pathname?.startsWith("/dashboard/community");

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header showSearch={isCommunityPage} />
      <main className="flex-1 overflow-y-auto pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}

