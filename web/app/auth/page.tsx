"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, KeyRound, ArrowRight, Globe, Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { isPaytacaAvailable, connectPaytaca } from "@/lib/paytaca";

type Mode = "choose" | "import" | "create";

export default function AuthPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>("choose");
  const [loading, setLoading] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState("");

  const paytacaAvailable = typeof window !== "undefined" && isPaytacaAvailable();

  const handlePaytaca = async () => {
    setLoading(true);
    try {
      const { address, signMessage } = await connectPaytaca();
      await login(address, signMessage);
      toast.success("Connected with Paytaca!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to connect Paytaca");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWallet = async () => {
    setLoading(true);
    try {
      // Generate a demo address for now — in production this would use a BIP39 library
      const demoAddress = `bitcoincash:qz${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      const signFn = async (message: string) => {
        // Demo sign function — in production this signs with the generated private key
        return btoa(message + demoAddress);
      };
      await login(demoAddress, signFn);
      toast.success("Wallet created!");
      router.push("/onboarding");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create wallet");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!seedPhrase.trim()) {
      toast.error("Please enter your seed phrase");
      return;
    }
    const words = seedPhrase.trim().split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      toast.error("Seed phrase must be 12 or 24 words");
      return;
    }

    setLoading(true);
    try {
      // Derive address from seed — in production this uses BIP39/BIP44
      const demoAddress = `bitcoincash:qz${words[0]}${Date.now().toString(36).slice(-6)}`;
      const signFn = async (message: string) => {
        return btoa(message + demoAddress);
      };
      await login(demoAddress, signFn);
      toast.success("Wallet imported!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import wallet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div>
            <div className="mx-auto mb-4 relative w-20 h-20">
              <Image src="/images/bch_coin_icon.png" alt="BCH Pay" fill className="object-contain" />
            </div>
            <h1 className="text-2xl font-bold">BCH Pay</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Connect your Bitcoin Cash wallet to get started
            </p>
          </div>

          {mode === "choose" && (
            <div className="space-y-3">
              {paytacaAvailable && (
                <Button
                  className="w-full h-12 gap-3 text-base"
                  onClick={handlePaytaca}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Globe className="h-5 w-5" />}
                  Connect Paytaca
                </Button>
              )}
              <Button
                className="w-full h-12 gap-3 text-base"
                variant={paytacaAvailable ? "outline" : "default"}
                onClick={handleCreateWallet}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wallet className="h-5 w-5" />}
                Create New Wallet
              </Button>
              <Button
                variant="outline"
                className="w-full h-12 gap-3 text-base"
                onClick={() => setMode("import")}
                disabled={loading}
              >
                <KeyRound className="h-5 w-5" /> Import Seed Phrase
              </Button>
              <p className="text-xs text-muted-foreground pt-2">
                Your keys stay on your device. We never have access to your funds.
              </p>
            </div>
          )}

          {mode === "import" && (
            <div className="space-y-4">
              <div className="text-left">
                <label className="text-sm font-medium">Seed Phrase</label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Enter your 12 or 24 word seed phrase..."
                  value={seedPhrase}
                  onChange={(e) => setSeedPhrase(e.target.value)}
                />
              </div>
              <Button
                className="w-full h-12 gap-2"
                onClick={handleImport}
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Import & Connect <ArrowRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setMode("choose")} disabled={loading}>
                Back
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
