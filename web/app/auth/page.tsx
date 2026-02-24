"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, KeyRound, ArrowRight, Globe, Loader2, Copy, Check } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { isPaytacaAvailable, connectPaytaca } from "@/lib/paytaca";
import { createWallet, deriveFromMnemonic, signMessage, isValidMnemonic } from "@/lib/bch-wallet";

type Mode = "choose" | "import" | "create" | "show-seed";

export default function AuthPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>("choose");
  const [loading, setLoading] = useState(false);
  const [seedPhrase, setSeedPhrase] = useState("");
  const [generatedSeed, setGeneratedSeed] = useState("");
  const [seedCopied, setSeedCopied] = useState(false);
  const [loginDone, setLoginDone] = useState(false);

  const paytacaAvailable = typeof window !== "undefined" && isPaytacaAvailable();

  const handlePaytaca = async () => {
    setLoading(true);
    try {
      const { address, signMessage: signFn } = await connectPaytaca();
      await login(address, signFn);
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
    setLoginDone(false);
    try {
      const wallet = createWallet();
      setGeneratedSeed(wallet.mnemonic);
      setMode("show-seed");

      // Authenticate in the background while user sees the seed
      const signFn = async (message: string) => {
        return signMessage(wallet.privateKey, message);
      };
      await login(wallet.address, signFn);
      setLoginDone(true);
      toast.success("Wallet created & authenticated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create wallet");
      setMode("choose");
    } finally {
      setLoading(false);
    }
  };

  const handleSeedContinue = () => {
    router.push("/onboarding");
  };

  const copySeed = () => {
    navigator.clipboard.writeText(generatedSeed);
    setSeedCopied(true);
    toast.success("Seed phrase copied!");
    setTimeout(() => setSeedCopied(false), 2000);
  };

  const handleImport = async () => {
    const trimmed = seedPhrase.trim();
    if (!trimmed) {
      toast.error("Please enter your seed phrase");
      return;
    }
    const words = trimmed.split(/\s+/);
    if (words.length !== 12 && words.length !== 24) {
      toast.error("Seed phrase must be 12 or 24 words");
      return;
    }
    if (!isValidMnemonic(trimmed)) {
      toast.error("Invalid seed phrase — check your words and try again");
      return;
    }

    setLoading(true);
    try {
      const wallet = deriveFromMnemonic(trimmed);
      const signFn = async (message: string) => {
        return signMessage(wallet.privateKey, message);
      };
      await login(wallet.address, signFn);
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
              <Image src="/images/bch_coin_icon.png" alt="CashTap" fill className="object-contain" />
            </div>
            <h1 className="text-2xl font-bold">CashTap</h1>
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

          {mode === "show-seed" && (
            <div className="space-y-4">
              <div className="text-left">
                <p className="text-sm font-medium text-destructive mb-2">
                  Write down your seed phrase and store it safely. You will need it to recover your wallet.
                </p>
                <div className="rounded-md border bg-muted p-4">
                  <p className="text-sm font-mono leading-relaxed break-words">{generatedSeed}</p>
                </div>
              </div>
              {loading && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating...
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={copySeed}>
                  {seedCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  {seedCopied ? "Copied" : "Copy"}
                </Button>
                <Button className="flex-1 gap-2" onClick={handleSeedContinue} disabled={!loginDone}>
                  {loginDone ? "Continue" : "Waiting..."} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
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
