"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  Download,
  ArrowRight,
  Hexagon,
  Users,
  Shield,
  Sparkles,
  Scan,
} from "lucide-react";
import { exists } from "./utils/wallet";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Safe client-side mounting check
function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export default function LandingPage() {
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const mounted = useIsMounted();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleStart = () => {
    if (exists()) {
      router.push("/login");
    } else {
      router.push("/welcome");
    }
  };

  const handleDownload = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setIsInstallable(false);
      }
    } else {
      // Fallback: show instructions for manual installation
      alert(
        "To install: tap the share button in your browser and select 'Add to Home Screen'"
      );
    }
  };

  if (!mounted) return null;

  return (
    <div className="relative min-h-[100dvh] w-full overflow-hidden bg-black">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Floating geometric shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="animate-float absolute left-[10%] top-[15%] opacity-10">
          <Hexagon className="h-24 w-24 text-white" strokeWidth={0.5} />
        </div>
        <div
          className="animate-float absolute right-[15%] top-[25%] opacity-10"
          style={{ animationDelay: "2s" }}
        >
          <Hexagon className="h-16 w-16 text-white" strokeWidth={0.5} />
        </div>
        <div
          className="animate-float absolute bottom-[30%] left-[20%] opacity-10"
          style={{ animationDelay: "4s" }}
        >
          <Hexagon className="h-20 w-20 text-white" strokeWidth={0.5} />
        </div>
        <div
          className="animate-float absolute bottom-[20%] right-[10%] opacity-5"
          style={{ animationDelay: "1s" }}
        >
          <Hexagon className="h-32 w-32 text-white" strokeWidth={0.5} />
        </div>
      </div>

      {/* Gradient orbs */}
      <div className="animate-pulse-glow absolute -left-32 -top-32 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
      <div
        className="animate-pulse-glow absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-white/5 blur-3xl"
        style={{ animationDelay: "1.5s" }}
      />

      {/* Main content */}
      <main className="relative z-10 flex min-h-[100dvh] flex-col items-center justify-between px-6 py-12 pb-safe">
        {/* Header */}
        <header className="animate-slide-up flex w-full items-center justify-center opacity-0 animation-delay-100">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Wallet className="h-8 w-8 text-white" strokeWidth={1.5} />
              <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-black bg-white" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-white">
              Relay
            </span>
          </div>
        </header>

        {/* Hero section */}
        <section className="flex flex-1 flex-col items-center justify-center py-8">
          <h1 className="animate-slide-up mb-4 max-w-xs text-center text-4xl font-bold leading-tight tracking-tight text-white opacity-0 animation-delay-300">
            <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Build Communities
            </span>
          </h1>

          <p className="animate-slide-up mb-10 max-w-xs text-center text-base leading-relaxed text-gray-400 opacity-0 animation-delay-400">
            Find interesting things in the cryptoverse
          </p>

          {/* Feature pills */}
          <div className="animate-slide-up mb-12 flex flex-wrap items-center justify-center gap-3 opacity-0 animation-delay-500">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
              <Scan className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-300">Scan to Pay</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
              <Users className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-300">Authentic Connections</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm">
              <Shield className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-300">Powered by Polkadot</span>
            </div>
          </div>
        </section>

        {/* Action buttons */}
        <footer className="w-full max-w-sm space-y-4">
          <Button
            onClick={handleStart}
            className="animate-slide-up group relative h-14 w-full overflow-hidden rounded-2xl bg-white text-lg font-semibold text-black opacity-0 transition-all hover:bg-gray-100 animation-delay-600"
          >
            <span className="relative z-10 flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Get Started
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </span>
          </Button>

          <Button
            onClick={handleDownload}
            variant="outline"
            className="animate-slide-up group h-14 w-full rounded-2xl border-white/20 bg-transparent text-lg font-medium text-white opacity-0 transition-all hover:border-white/40 hover:bg-white/5 animation-delay-700"
          >
            <Download className="mr-2 h-5 w-5" />
            {isInstallable ? "Install App" : "Download App"}
          </Button>

          <p className="animate-fade-in pt-4 text-center text-xs text-gray-500 opacity-0 animation-delay-700">
            No app store needed. Install directly to your device.
          </p>
        </footer>
      </main>
    </div>
  );
}
