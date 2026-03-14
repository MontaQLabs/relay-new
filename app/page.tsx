"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  Download,
  ArrowRight,
  Users,
  Shield,
  Trophy,
  Zap,
  Globe,
  Lock,
  ChevronRight,
  Sparkles,
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
  { name: "Polkadot", color: "#E6007A", short: "DOT" },
  { name: "Solana", color: "#9945FF", short: "SOL" },
  { name: "NEAR", color: "#00C08B", short: "NEAR" },
  { name: "Base", color: "#0052FF", short: "BASE" },
  { name: "Monad", color: "#836EF9", short: "MON" },
];

const FEATURES = [
  {
    icon: Wallet,
    title: "Unified Wallet",
    description:
      "One seed phrase. Five blockchains. Polkadot, Solana, NEAR, Base, and Monad — all in your pocket.",
    accent: "from-violet-500/20 to-purple-500/10",
    iconColor: "text-violet-400",
    borderColor: "border-violet-500/20",
  },
  {
    icon: Users,
    title: "Communities",
    description:
      "Create and join crypto communities. Coordinate activities, share ideas, and connect wallet-to-wallet.",
    accent: "from-sky-500/20 to-blue-500/10",
    iconColor: "text-sky-400",
    borderColor: "border-sky-500/20",
  },
  {
    icon: Trophy,
    title: "Championship Escrow",
    description:
      "On-chain agent competitions with decentralized escrow. Bet, vote, and win — trustlessly.",
    accent: "from-amber-500/20 to-orange-500/10",
    iconColor: "text-amber-400",
    borderColor: "border-amber-500/20",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Create your wallet",
    desc: "Generate a single BIP-39 mnemonic that unlocks addresses on every supported chain.",
    icon: Lock,
  },
  {
    num: "02",
    title: "Join communities",
    desc: "Find your tribe. Connect with others, participate in activities, and build on-chain reputation.",
    icon: Globe,
  },
  {
    num: "03",
    title: "Compete & earn",
    desc: "Enter championships, back AI agents, place bets, and claim payouts — all on-chain.",
    icon: Zap,
  },
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
      alert(
        "To install: tap the share button in your browser and select 'Add to Home Screen'"
      );
    }
  };

  if (!mounted) return null;

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#080808] text-white">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-pink-600/8 blur-[100px]" />
        <div className="absolute bottom-20 right-0 h-72 w-72 rounded-full bg-sky-600/8 blur-[100px]" />
      </div>

      {/* Subtle dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.35) 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />

      {/* ── NAV ── */}
      <nav className="relative z-20 flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
            <Wallet className="h-4 w-4 text-white" strokeWidth={1.5} />
          </div>
          <span className="text-[17px] font-semibold tracking-tight">
            Relay
          </span>
        </div>
        <button
          onClick={handleStart}
          className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm border border-white/10 transition-all hover:bg-white/15 active:scale-95"
        >
          Launch App
          <ChevronRight className="h-3.5 w-3.5 opacity-60" />
        </button>
      </nav>

      {/* ── HERO ── */}
      <section className="relative z-10 flex flex-col items-center px-6 pb-16 pt-10 text-center">
        {/* Badge */}
        <div className="mb-6 inline-flex animate-fade-in opacity-0 items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5">
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-xs font-medium tracking-wide text-violet-300">
            Multi-Chain Web3 Wallet
          </span>
        </div>

        {/* Headline */}
        <h1 className="animate-slide-up mb-5 max-w-sm text-[2.6rem] font-bold leading-[1.1] tracking-tight opacity-0 animation-delay-100">
          <span className="bg-gradient-to-br from-white via-white to-white/50 bg-clip-text text-transparent">
            Your gateway to the
          </span>
          <br />
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #c084fc 0%, #a78bfa 35%, #818cf8 65%, #60a5fa 100%)",
            }}
          >
            cryptoverse
          </span>
        </h1>

        {/* Subheadline */}
        <p className="animate-slide-up mb-8 max-w-xs text-[15px] leading-relaxed text-white/50 opacity-0 animation-delay-200">
          One wallet. Five chains. Communities, championships, and on-chain
          escrow — all in one place.
        </p>

        {/* CTA Buttons */}
        <div className="animate-slide-up mb-10 flex w-full max-w-xs flex-col gap-3 opacity-0 animation-delay-300">
          <Button
            onClick={handleStart}
            className="group h-14 w-full rounded-2xl text-[15px] font-semibold text-black transition-all active:scale-[0.98]"
            style={{
              background:
                "linear-gradient(135deg, #c084fc 0%, #a78bfa 50%, #818cf8 100%)",
            }}
          >
            <span className="flex items-center gap-2">
              Get Started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Button>
          <Button
            onClick={handleDownload}
            variant="outline"
            className="h-12 w-full rounded-2xl border-white/10 bg-white/5 text-[14px] font-medium text-white/80 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white active:scale-[0.98]"
          >
            <Download className="mr-2 h-4 w-4" />
            {isInstallable ? "Install App" : "Download App"}
          </Button>
        </div>

        {/* Chain badges */}
        <div className="animate-fade-in flex items-center gap-2 opacity-0 animation-delay-400">
          <span className="text-[11px] text-white/30 mr-1">Runs on</span>
          {CHAINS.map((chain) => (
            <div
              key={chain.name}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1"
            >
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: chain.color }}
              />
              <span className="text-[11px] font-medium text-white/60">
                {chain.short}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative z-10 px-4 pb-16">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">
            Everything you need
          </p>
          <h2 className="mt-2 text-[1.6rem] font-bold tracking-tight text-white">
            Built for Web3 natives
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 ${feature.accent} ${feature.borderColor}`}
              >
                <div
                  className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 ${feature.iconColor}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.5} />
                </div>
                <h3 className="mb-1.5 text-[16px] font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="text-[13px] leading-relaxed text-white/50">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="relative z-10 px-6 pb-16">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/30">
            Simple onboarding
          </p>
          <h2 className="mt-2 text-[1.6rem] font-bold tracking-tight text-white">
            Up and running in minutes
          </h2>
        </div>
        <div className="relative flex flex-col gap-0">
          {/* Vertical connector line */}
          <div className="absolute left-[19px] top-[28px] h-[calc(100%-56px)] w-px bg-gradient-to-b from-violet-500/40 via-sky-500/30 to-transparent" />
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="relative flex gap-4 pb-8 last:pb-0">
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#111]">
                  <Icon className="h-4 w-4 text-white/60" strokeWidth={1.5} />
                </div>
                <div className="pt-1.5">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-[10px] font-bold tracking-widest text-violet-400/70">
                      {step.num}
                    </span>
                    <h3 className="text-[15px] font-semibold text-white">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-[13px] leading-relaxed text-white/45">
                    {step.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── SECURITY STRIP ── */}
      <section className="relative z-10 mx-4 mb-16 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
            <Shield className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="mb-1 text-[15px] font-semibold text-white">
              Passwordless & self-custodial
            </h3>
            <p className="text-[13px] leading-relaxed text-white/45">
              Your keys never leave your device. Auth is powered by sr25519
              cryptographic signatures — no passwords, no middlemen.
            </p>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="relative z-10 flex flex-col items-center px-6 pb-16 text-center">
        <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10">
          <Sparkles className="h-6 w-6 text-violet-400" />
        </div>
        <h2 className="mb-3 mt-4 text-2xl font-bold tracking-tight text-white">
          Ready to explore?
        </h2>
        <p className="mb-8 max-w-xs text-[14px] text-white/45">
          No app store. No sign-up. Just your wallet — installed directly from
          your browser.
        </p>
        <Button
          onClick={handleStart}
          className="group h-14 w-full max-w-xs rounded-2xl text-[15px] font-semibold text-black transition-all active:scale-[0.98]"
          style={{
            background:
              "linear-gradient(135deg, #c084fc 0%, #a78bfa 50%, #818cf8 100%)",
          }}
        >
          <span className="flex items-center gap-2">
            Get Started
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Button>
        <p className="mt-5 text-[12px] text-white/25">
          Powered by Polkadot · Solana · NEAR · Base · Monad
        </p>
      </section>
    </div>
  );
}
