"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Wallet,
  Download,
  ArrowRight,
  Users,
  Shield,
  Trophy,
  Globe,
  ChevronRight,
} from "lucide-react";
import { exists } from "./utils/wallet";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function useIsMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

const CHAINS = [
  { name: "Polkadot", color: "#E6007A" },
  { name: "Solana", color: "#9945FF" },
  { name: "NEAR", color: "#00C08B" },
  { name: "Base", color: "#0052FF" },
  { name: "Monad", color: "#836EF9" },
];

export default function LandingPage() {
  const router = useRouter();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
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
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
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
      alert("To install: tap the share button in your browser and select 'Add to Home Screen'");
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col">
      {/* Hero section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-8">
        {/* Logo */}
        <div className="mb-8 animate-fade-in">
          <div className="w-28 h-28 rounded-[28px] overflow-hidden bg-gray-100 flex items-center justify-center shadow-sm">
            <Image
              src="/icons/icon.svg"
              alt="Relay"
              width={112}
              height={112}
              className="object-cover"
              priority
            />
          </div>
        </div>

        {/* Headline */}
        <h1
          className="text-3xl font-semibold tracking-tight text-center mb-3 animate-slide-up"
          style={{ color: "#1a1a1a" }}
        >
          Welcome to Relay
        </h1>
        <p
          className="text-base text-center max-w-[280px] leading-relaxed animate-slide-up animation-delay-100"
          style={{ color: "#8e8e93" }}
        >
          One wallet for every chain. Communities, championships, and more.
        </p>

        {/* Chain indicators */}
        <div className="flex items-center gap-2 mt-6 animate-slide-up animation-delay-200">
          {CHAINS.map((chain) => (
            <div key={chain.name} className="group relative">
              <div
                className="w-3 h-3 rounded-full transition-transform group-hover:scale-125"
                style={{ backgroundColor: chain.color }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Feature cards */}
      <div className="px-5 pb-6 space-y-3 animate-slide-up animation-delay-300">
        <FeatureRow
          icon={<Wallet className="w-5 h-5" strokeWidth={1.5} />}
          title="Multi-Chain Wallet"
          subtitle="Polkadot, Solana, NEAR, Base & Monad"
        />
        <FeatureRow
          icon={<Users className="w-5 h-5" strokeWidth={1.5} />}
          title="Communities"
          subtitle="Create, join, and coordinate together"
        />
        <FeatureRow
          icon={<Trophy className="w-5 h-5" strokeWidth={1.5} />}
          title="Championships"
          subtitle="On-chain escrow competitions"
        />
        <FeatureRow
          icon={<Shield className="w-5 h-5" strokeWidth={1.5} />}
          title="Self-Custodial"
          subtitle="Your keys never leave your device"
        />
      </div>

      {/* CTAs */}
      <div className="px-6 pb-10 space-y-3">
        <button
          onClick={handleStart}
          className="w-full h-14 rounded-full flex items-center justify-center gap-2 animate-slide-up animation-delay-400 transition-all duration-200 active:scale-[0.98] cursor-pointer"
          style={{ backgroundColor: "#1a1a1a" }}
        >
          <span className="text-white font-medium">Get Started</span>
          <ArrowRight className="w-4 h-4 text-white" />
        </button>

        <button
          onClick={handleDownload}
          className="w-full h-14 rounded-full flex items-center justify-center gap-2 border animate-slide-up animation-delay-500 transition-all duration-200 active:scale-[0.98] cursor-pointer"
          style={{ backgroundColor: "#f5f5f5", borderColor: "#e5e5e5" }}
        >
          <Download className="w-4 h-4" style={{ color: "#1a1a1a" }} />
          <span style={{ color: "#1a1a1a" }} className="font-medium">
            {isInstallable ? "Install App" : "Download App"}
          </span>
        </button>

        <p
          className="text-center text-xs pt-2 animate-fade-in animation-delay-600"
          style={{ color: "#c7c7cc" }}
        >
          No app store needed. Install directly from your browser.
        </p>
      </div>
    </div>
  );
}

function FeatureRow({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-4 bg-white rounded-2xl border border-gray-100 px-4 py-3.5">
      <div
        className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0"
        style={{ color: "#1a1a1a" }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: "#8e8e93" }}>
          {subtitle}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 shrink-0 ml-auto" style={{ color: "#d1d1d6" }} />
    </div>
  );
}
