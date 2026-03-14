"use client";

import type { ChainId } from "@/app/chains/types";
import { useNetworkMode } from "@/app/contexts/NetworkModeContext";

interface ChainOption {
  id: ChainId;
  name: string;
  icon: string;
  color: string;
}

const CHAINS: ChainOption[] = [
  { id: "polkadot", name: "Polkadot", icon: "DOT", color: "#e6007a" },
  { id: "base", name: "Base", icon: "BASE", color: "#0052ff" },
  { id: "solana", name: "Solana", icon: "SOL", color: "#9945ff" },
  { id: "monad", name: "Monad", icon: "MON", color: "#836ef9" },
  { id: "near", name: "NEAR", icon: "NEAR", color: "#00ec97" },
];

interface ChainSelectorProps {
  selectedChain: ChainId;
  onSelect: (chainId: ChainId) => void;
  /** Show "All" option to aggregate balances across chains. */
  showAll?: boolean;
}

export function ChainSelector({ selectedChain, onSelect, showAll = true }: ChainSelectorProps) {
  const { isTestnet } = useNetworkMode();

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      {isTestnet && (
        <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 rounded-full flex-shrink-0">
          Testnet
        </span>
      )}
      {showAll && (
        <ChainPill
          label="All"
          isActive={selectedChain === ("all" as ChainId)}
          color="#1a1a1a"
          onClick={() => onSelect("all" as ChainId)}
        />
      )}
      {CHAINS.map((chain) => (
        <ChainPill
          key={chain.id}
          label={chain.name}
          icon={chain.icon}
          isActive={selectedChain === chain.id}
          color={chain.color}
          onClick={() => onSelect(chain.id)}
        />
      ))}
    </div>
  );
}

function ChainPill({
  label,
  icon,
  isActive,
  color,
  onClick,
}: {
  label: string;
  icon?: string;
  isActive: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
        isActive ? "text-white shadow-sm" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
      style={isActive ? { backgroundColor: color } : undefined}
    >
      {icon && (
        <span
          className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
            isActive ? "bg-white/20" : "bg-gray-200"
          }`}
        >
          {icon[0]}
        </span>
      )}
      {label}
    </button>
  );
}
