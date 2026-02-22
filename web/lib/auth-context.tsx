"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface Merchant {
  id: string;
  name: string;
  email?: string;
  logoUrl?: string;
  address: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  merchant: Merchant | null;
  address: string | null;
}

interface AuthContextType extends AuthState {
  login: (address: string, signFn: (msg: string) => Promise<string>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://bch-pay-api-production.up.railway.app";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    merchant: null,
    address: null,
  });

  // Check existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.address) {
          // Fetch merchant profile
          const merchantRes = await fetch(`${API_BASE}/merchants/me`, {
            headers: { Authorization: `Bearer ${data.accessToken}` },
          });
          const merchant = merchantRes.ok ? await merchantRes.json() : null;

          setState({
            isAuthenticated: true,
            isLoading: false,
            merchant,
            address: data.address,
          });
          return;
        }
      }
    } catch {
      // Session check failed, not authenticated
    }
    setState((s) => ({ ...s, isLoading: false }));
  }

  const login = useCallback(async (address: string, signFn: (msg: string) => Promise<string>) => {
    // 1. Request challenge from API
    const challengeRes = await fetch(`${API_BASE}/auth/challenge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    });
    if (!challengeRes.ok) throw new Error("Failed to get challenge");
    const { challenge } = await challengeRes.json();

    // 2. Sign the challenge
    const signature = await signFn(challenge);

    // 3. Verify signature with API
    const verifyRes = await fetch(`${API_BASE}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, signature, challenge }),
    });
    if (!verifyRes.ok) throw new Error("Signature verification failed");
    const { accessToken, refreshToken, merchant } = await verifyRes.json();

    // 4. Store tokens in httpOnly cookie via route handler
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken, refreshToken, address }),
    });

    setState({
      isAuthenticated: true,
      isLoading: false,
      merchant: merchant || null,
      address,
    });
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    setState({
      isAuthenticated: false,
      isLoading: false,
      merchant: null,
      address: null,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
