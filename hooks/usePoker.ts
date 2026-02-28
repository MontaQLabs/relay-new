"use client";

import { useState, useEffect, useCallback } from "react";
import type { TableInfo, AgentInfo } from "@/app/services/poker";
import { TABLE_STATE } from "@/app/services/poker/contract";

// ============================================================================
// Table list
// ============================================================================

export function usePokerTables(stateFilter?: number) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url =
        stateFilter !== undefined ? `/api/poker/tables?state=${stateFilter}` : "/api/poker/tables";
      const res = await window.fetch(url);
      const data = await res.json();
      setTables(data.tables || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tables");
    } finally {
      setLoading(false);
    }
  }, [stateFilter]);

  useEffect(() => {
    fetch();
  }, [fetch]);
  return { tables, isLoading, error, refetch: fetch };
}

// ============================================================================
// Single table detail (polls every 5s during PLAYING state)
// ============================================================================

interface TableDetail extends TableInfo {
  agents: AgentInfo[];
  betPoolEth: string;
}

export function usePokerTable(tableId: number | null) {
  const [table, setTable] = useState<TableDetail | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (tableId === null) return;
    try {
      const res = await window.fetch(`/api/poker/tables?tableId=${tableId}`);
      const data = await res.json();
      if (data.table) setTable(data.table);
      else setError("Table not found");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load table");
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    fetch();
    // Poll every 5 seconds while table is PLAYING
    const interval = setInterval(() => {
      if (table?.state === TABLE_STATE.PLAYING) fetch();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetch, table?.state]);

  return { table, isLoading, error, refetch: fetch };
}

// ============================================================================
// Place bet
// ============================================================================

export function usePlaceBet() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const bet = async (params: {
    tableId: number;
    agentSeat: number;
    amountEth: string;
    mnemonic: string;
  }) => {
    setLoading(true);
    setError(null);
    setTxHash(null);
    try {
      const res = await window.fetch("/api/poker/bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Bet failed");
      setTxHash(data.txHash);
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bet failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { bet, isLoading, error, txHash };
}

// ============================================================================
// Claim (chips / prize / bet winnings / refund)
// ============================================================================

export function useClaim() {
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const claim = async (params: {
    tableId: number;
    claimType: "chips" | "prize" | "bet" | "refund";
    mnemonic: string;
  }) => {
    setLoading(true);
    setError(null);
    setTxHash(null);
    try {
      const res = await window.fetch("/api/poker/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim failed");
      setTxHash(data.txHash);
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Claim failed";
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  };

  return { claim, isLoading, error, txHash };
}
