"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

type DisplayCurrency = "BCH" | "USD";

interface PriceState {
  bchUsd: number;
  loading: boolean;
  displayCurrency: DisplayCurrency;
}

interface PriceContextType extends PriceState {
  formatUsd: (satoshis: bigint | number | string) => string;
  formatBch: (satoshis: bigint | number | string) => string;
  formatPrimary: (satoshis: bigint | number | string) => string;
  formatSecondary: (satoshis: bigint | number | string) => string;
  setDisplayCurrency: (currency: DisplayCurrency) => void;
}

const PriceContext = createContext<PriceContextType | null>(null);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";
const REFRESH_INTERVAL = 60_000; // 60 seconds

export function PriceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PriceState>({
    bchUsd: 0,
    loading: true,
    displayCurrency: "BCH",
  });

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/price`);
      if (res.ok) {
        const data = await res.json();
        setState((s) => ({ ...s, bchUsd: data.bch_usd, loading: false }));
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

  // Load display currency preference from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cashtap_display_currency");
      if (saved === "BCH" || saved === "USD") {
        setState((s) => ({ ...s, displayCurrency: saved }));
      }
    } catch {}
  }, []);

  const setDisplayCurrency = useCallback((currency: DisplayCurrency) => {
    setState((s) => ({ ...s, displayCurrency: currency }));
    try {
      localStorage.setItem("cashtap_display_currency", currency);
    } catch {}
  }, []);

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

  const formatPrimary = useCallback(
    (satoshis: bigint | number | string): string => {
      return state.displayCurrency === "USD" ? formatUsd(satoshis) : formatBch(satoshis);
    },
    [state.displayCurrency, formatUsd, formatBch],
  );

  const formatSecondary = useCallback(
    (satoshis: bigint | number | string): string => {
      return state.displayCurrency === "USD" ? formatBch(satoshis) : formatUsd(satoshis);
    },
    [state.displayCurrency, formatUsd, formatBch],
  );

  return (
    <PriceContext.Provider
      value={{
        ...state,
        formatUsd,
        formatBch,
        formatPrimary,
        formatSecondary,
        setDisplayCurrency,
      }}
    >
      {children}
    </PriceContext.Provider>
  );
}

export function usePrice() {
  const ctx = useContext(PriceContext);
  if (!ctx) throw new Error("usePrice must be used within PriceProvider");
  return ctx;
}
