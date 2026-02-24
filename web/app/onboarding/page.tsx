"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, Lock, ArrowRight } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { createWallet } from "@/lib/bch-wallet";
import { encryptMnemonic } from "@/lib/wallet-crypto";

type Step = "creating" | "password" | "done";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, address, isAuthenticated, isLoading } = useAuth();
  const [step, setStep] = useState<Step>("creating");
  const [walletAddress, setWalletAddress] = useState("");
  const [mnemonic, setMnemonic] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // If already has a wallet, skip onboarding
  useEffect(() => {
    if (!isLoading && isAuthenticated && address) {
      const role = user?.role;
      router.replace(role === "MERCHANT" ? "/dashboard" : "/buyer");
    }
  }, [isLoading, isAuthenticated, address, user, router]);

  // If not authenticated, go to auth
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/auth");
    }
  }, [isLoading, isAuthenticated, router]);

  // Auto-generate wallet on mount
  useEffect(() => {
    if (isAuthenticated && !address) {
      try {
        const wallet = createWallet();
        setWalletAddress(wallet.address);
        setMnemonic(wallet.mnemonic);
        setStep("password");
      } catch (err) {
        toast.error("Failed to generate wallet");
      }
    }
  }, [isAuthenticated, address]);

  const handleRegisterWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error("Please enter your password to encrypt your wallet");
      return;
    }

    setLoading(true);
    try {
      // Encrypt mnemonic with password
      const encryptedWallet = await encryptMnemonic(mnemonic, password);

      // Get session token
      const sessionRes = await fetch("/api/auth/session", { credentials: "include" });
      if (!sessionRes.ok) throw new Error("No session");
      const session = await sessionRes.json();

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";

      // Register wallet address + encrypted blob with API
      const res = await fetch(`${API_BASE}/api/wallet/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          bch_address: walletAddress,
          encrypted_wallet: encryptedWallet,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to register wallet" }));
        throw new Error(err.error || "Failed to register wallet");
      }

      // Store mnemonic in sessionStorage for immediate use in send flow
      sessionStorage.setItem("cashtap_mnemonic", mnemonic);

      setStep("done");
      toast.success("Wallet created!");

      // Redirect after brief delay
      setTimeout(() => {
        router.push("/buyer");
      }, 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set up wallet");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 relative w-20 h-20">
              <Image src="/images/bch_coin_icon.png" alt="CashTap" fill className="object-contain" />
            </div>
            <h1 className="text-2xl font-bold">
              {step === "creating" ? "Creating Your Wallet..." : step === "password" ? "Secure Your Wallet" : "You're All Set!"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {step === "creating"
                ? "Generating your Bitcoin Cash wallet"
                : step === "password"
                  ? "Enter your password to encrypt your wallet for cross-device recovery"
                  : "Your wallet is ready to use"}
            </p>
          </div>

          {step === "creating" && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          )}

          {step === "password" && (
            <>
              <div className="rounded-md border bg-muted p-3">
                <p className="text-xs text-muted-foreground mb-1">Your wallet address:</p>
                <p className="text-sm font-mono break-all">{walletAddress}</p>
              </div>

              <form onSubmit={handleRegisterWallet} className="space-y-4">
                <div className="text-left">
                  <label className="text-sm font-medium">Password</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Re-enter your account password to encrypt your wallet backup
                  </p>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Your account password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 gap-2" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Set Up Wallet <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              <p className="text-xs text-muted-foreground text-center">
                Your seed phrase is encrypted with your password and stored for recovery.
                You can view it anytime in Settings.
              </p>
            </>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center py-4 gap-3">
              <CheckCircle2 className="h-14 w-14 text-green-500" />
              <p className="text-sm text-muted-foreground">Redirecting to your wallet...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
