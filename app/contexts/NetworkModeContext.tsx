"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { NetworkMode } from "@/app/chains/types";
import { NETWORK_MODE_KEY } from "@/app/types/constants";
import { resetRegistry } from "@/app/chains/registry";

function getInitialNetworkMode(): NetworkMode {
  if (typeof window === "undefined") return "mainnet";
  return localStorage.getItem(NETWORK_MODE_KEY) === "testnet"
    ? "testnet"
    : "mainnet";
}

interface NetworkModeContextValue {
  networkMode: NetworkMode;
  setNetworkMode: (mode: NetworkMode) => void;
  isTestnet: boolean;
}

const NetworkModeContext = createContext<NetworkModeContextValue>({
  networkMode: "mainnet",
  setNetworkMode: () => {},
  isTestnet: false,
});

export function NetworkModeProvider({ children }: { children: ReactNode }) {
  const [networkMode, setNetworkModeState] = useState<NetworkMode>(getInitialNetworkMode);

  const setNetworkMode = useCallback((mode: NetworkMode) => {
    setNetworkModeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem(NETWORK_MODE_KEY, mode);
    }
    // Force the chain registry to re-initialise with the new mode
    resetRegistry();
  }, []);

  return (
    <NetworkModeContext.Provider
      value={{
        networkMode,
        setNetworkMode,
        isTestnet: networkMode === "testnet",
      }}
    >
      {children}
    </NetworkModeContext.Provider>
  );
}

export function useNetworkMode() {
  return useContext(NetworkModeContext);
}
