"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface PriceState {
  bchUsd: number;
  loading: boolean;
}

interface PriceContextType extends PriceState {
  formatUsd: (satoshis: bigint | number | string) => string;
  formatBch: (satoshis: bigint | number | string) => string;
}

const PriceContext = createContext<PriceContextType | null>(null);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://bch-pay-api-production.up.railway.app";
const REFRESH_INTERVAL = 60_000; // 60 seconds

export function PriceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PriceState>({ bchUsd: 0, loading: true });

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/price`);
      if (res.ok) {
        const data = await res.json();
        setState({ bchUsd: data.bch_usd, loading: false });
      }
    } catch {
      // Keep last known price on failure
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    const timer = setInterval(fetchPrice, REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchPrice]);

  const formatUsd = useCallback(
    (satoshis: bigint | number | string): string => {
      const sats = typeof satoshis === "string" ? Number(satoshis) : Number(satoshis);
      const bch = sats / 1e8;
      const usd = bch * state.bchUsd;
      return `$${usd.toFixed(2)}`;
    },
    [state.bchUsd],
  );

  const formatBch = useCallback(
    (satoshis: bigint | number | string): string => {
      const sats = typeof satoshis === "string" ? Number(satoshis) : Number(satoshis);
      const bch = sats / 1e8;
      return `${bch.toFixed(8)} BCH`;
    },
    [],
  );

  return (
    <PriceContext.Provider value={{ ...state, formatUsd, formatBch }}>
      {children}
    </PriceContext.Provider>
  );
}

export function usePrice() {
  const ctx = useContext(PriceContext);
  if (!ctx) throw new Error("usePrice must be used within PriceProvider");
  return ctx;
}
