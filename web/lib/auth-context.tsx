"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

type UserRole = "MERCHANT" | "BUYER" | null;

interface User {
  id: string;
  email: string;
  bch_address?: string | null;
  merchant_address?: string | null;
  business_name?: string | null;
  role: string;
  encrypted_wallet?: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  address: string | null;
  role: UserRole;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  upgradeToMerchant: (businessName: string, merchantAddress?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://bch-pay-api-production.up.railway.app";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    address: null,
    role: null,
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
        if (data.email) {
          // Fetch user profile
          const profileRes = await fetch(`${API_BASE}/api/merchants/me`, {
            headers: { Authorization: `Bearer ${data.accessToken}` },
          });
          const profileData = profileRes.ok ? await profileRes.json() : null;
          const merchant = profileData?.merchant;

          const role = data.role || merchant?.role || null;
          const user: User = merchant
            ? {
                id: merchant.id,
                email: merchant.email,
                bch_address: merchant.bch_address,
                merchant_address: merchant.merchant_address,
                business_name: merchant.business_name,
                role: merchant.role,
                encrypted_wallet: merchant.encrypted_wallet,
              }
            : { id: "", email: data.email, role: role || "BUYER" };

          setState({
            isAuthenticated: true,
            isLoading: false,
            user,
            address: merchant?.bch_address || null,
            role,
          });
          return;
        }
      }
    } catch {
      // Session check failed, not authenticated
    }
    setState((s) => ({ ...s, isLoading: false }));
  }

  const register = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Registration failed" }));
      throw new Error(err.error || "Registration failed");
    }

    const data = await res.json();
    const user = data.user;

    // Store tokens in httpOnly cookie
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        email: user.email,
        role: user.role,
      }),
    });

    setState({
      isAuthenticated: true,
      isLoading: false,
      user,
      address: user.bch_address || null,
      role: user.role,
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Login failed" }));
      throw new Error(err.error || "Login failed");
    }

    const data = await res.json();
    const user = data.user;

    // Store tokens in httpOnly cookie
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        email: user.email,
        role: user.role,
      }),
    });

    setState({
      isAuthenticated: true,
      isLoading: false,
      user,
      address: user.bch_address || null,
      role: user.role,
    });
  }, []);

  const upgradeToMerchant = useCallback(async (businessName: string, merchantAddress?: string) => {
    const sessionRes = await fetch("/api/auth/session", { credentials: "include" });
    if (!sessionRes.ok) throw new Error("No session");
    const session = await sessionRes.json();

    const res = await fetch(`${API_BASE}/api/merchants/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        business_name: businessName,
        merchant_address: merchantAddress,
      }),
    });

    if (!res.ok) throw new Error("Failed to upgrade to merchant");
    const data = await res.json();
    const user = data.user;

    // Update session with new tokens
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        email: user.email,
        role: "MERCHANT",
      }),
    });

    setState((s) => ({
      ...s,
      user: { ...s.user!, ...user },
      role: "MERCHANT",
    }));
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      address: null,
      role: null,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, upgradeToMerchant, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
