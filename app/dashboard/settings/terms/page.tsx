"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Terms() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to settings page - terms are shown via sheet component
    // TODO: This page is kept for future more user friendly implementations
    router.replace("/dashboard/settings");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
    </div>
  );
}
