"use client";

import { useNetworkMode } from "@/app/contexts/NetworkModeContext";
import Link from "next/link";

/**
 * Persistent amber banner shown across all dashboard pages when the app
 * is in testnet mode. Links to settings so users can switch back easily.
 */
export function TestnetBanner() {
  const { isTestnet } = useNetworkMode();

  if (!isTestnet) return null;

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500 text-white text-center text-sm font-medium py-1.5 px-4">
      <span>You are on Testnet</span>
      <span className="mx-1.5">&middot;</span>
      <Link
        href="/dashboard/settings"
        className="underline underline-offset-2 hover:text-white/80 transition-colors"
      >
        Switch to Mainnet
      </Link>
    </div>
  );
}
