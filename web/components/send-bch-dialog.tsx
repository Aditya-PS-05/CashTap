"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, ArrowRight, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { usePrice } from "@/lib/price-context";
import { buildAndSignTransaction } from "@/lib/bch-wallet";
import { decryptMnemonic } from "@/lib/wallet-crypto";

interface SendBchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  prefillAddress?: string;
  prefillAmount?: number;
}

type Step = "address" | "amount" | "review" | "sending" | "done";

export function SendBchDialog({ open, onOpenChange, onSuccess, prefillAddress, prefillAmount }: SendBchDialogProps) {
  const { address, user } = useAuth();
  const { bchUsd, formatBch, formatUsd } = usePrice();
  const [step, setStep] = useState<Step>("address");
  const [recipient, setRecipient] = useState(prefillAddress || "");
  const [amountBch, setAmountBch] = useState(prefillAmount ? String(prefillAmount) : "");
  const [amountMode, setAmountMode] = useState<"BCH" | "USD">("BCH");
  const [txid, setTxid] = useState("");
  const [error, setError] = useState("");
  const [passwordPrompt, setPasswordPrompt] = useState(false);
  const [sendPassword, setSendPassword] = useState("");

  const reset = () => {
    setStep("address");
    setRecipient(prefillAddress || "");
    setAmountBch(prefillAmount ? String(prefillAmount) : "");
    setTxid("");
    setError("");
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(reset, 300);
  };

  if (!open) return null;

  const amountSatoshis = (() => {
    const val = parseFloat(amountBch);
    if (isNaN(val) || val <= 0) return 0;
    if (amountMode === "USD") {
      if (bchUsd <= 0) return 0;
      return Math.round((val / bchUsd) * 1e8);
    }
    return Math.round(val * 1e8);
  })();

  const estimatedFee = 226; // ~1 sat/byte for a typical 1-input-2-output tx

  const handleSend = async () => {
    setError("");

    try {
      // Try sessionStorage first
      let seedPhrase = sessionStorage.getItem("cashtap_mnemonic");

      if (!seedPhrase) {
        // Need to decrypt from server-stored encrypted wallet
        if (!sendPassword) {
          setPasswordPrompt(true);
          return;
        }

        const encryptedWallet = user?.encrypted_wallet;
        if (!encryptedWallet) {
          throw new Error("Wallet seed not found. Please set up your wallet again.");
        }

        seedPhrase = await decryptMnemonic(encryptedWallet, sendPassword);
        // Cache for this session
        sessionStorage.setItem("cashtap_mnemonic", seedPhrase);
        setSendPassword("");
        setPasswordPrompt(false);
      }

      setStep("sending");

      const result = await buildAndSignTransaction({
        senderAddress: address!,
        recipientAddress: recipient,
        amountSatoshis,
        mnemonic: seedPhrase,
      });

      setTxid(result.txid);
      setStep("done");
      toast.success("BCH sent successfully!");

      // Record transaction in the database
      try {
        const sessionRes = await fetch("/api/auth/session", { credentials: "include" });
        const session = await sessionRes.json();
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";
        await fetch(`${API_BASE}/api/transactions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify({
            tx_hash: result.txid,
            sender_address: address,
            recipient_address: recipient,
            amount_satoshis: amountSatoshis,
          }),
        });
      } catch {
        // Don't fail the UI if recording fails — tx is already on-chain
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed");
      setStep("review");
      setPasswordPrompt(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={handleClose}>
      <div
        className="bg-background rounded-lg border shadow-lg w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Send className="h-5 w-5" /> Send BCH
          </h2>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground text-xl">
            &times;
          </button>
        </div>

        {/* Step 1: Address */}
        {step === "address" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Recipient Address</label>
              <Input
                placeholder="bchtest:qp... or bitcoincash:q..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="mt-1 font-mono text-sm"
              />
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => setStep("amount")}
              disabled={!recipient.match(/^(bitcoincash:|bchtest:)?[qpzrs][a-z0-9]{41,}$/i)}
            >
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Amount */}
        {step === "amount" && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Amount</label>
                <button
                  className="text-xs text-primary"
                  onClick={() => setAmountMode(amountMode === "BCH" ? "USD" : "BCH")}
                >
                  Switch to {amountMode === "BCH" ? "USD" : "BCH"}
                </button>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={amountBch}
                  onChange={(e) => setAmountBch(e.target.value)}
                  className="pr-16"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {amountMode}
                </span>
              </div>
              {amountSatoshis > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {amountMode === "BCH" ? formatUsd(amountSatoshis) : formatBch(amountSatoshis)}
                  {" "}({amountSatoshis.toLocaleString()} sats)
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("address")}>
                Back
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => setStep("review")}
                disabled={amountSatoshis <= 546}
              >
                Review <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === "review" && (
          <div className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">To</span>
                <span className="font-mono text-xs max-w-[200px] truncate">{recipient}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">{formatBch(amountSatoshis)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network Fee</span>
                <span>~{estimatedFee} sats</span>
              </div>
              <hr />
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>{formatBch(amountSatoshis + estimatedFee)}</span>
              </div>
            </div>
            {passwordPrompt && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Enter password to unlock wallet</label>
                <Input
                  type="password"
                  placeholder="Your account password"
                  value={sendPassword}
                  onChange={(e) => setSendPassword(e.target.value)}
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("amount")}>
                Back
              </Button>
              <Button className="flex-1 gap-2" onClick={handleSend}>
                {passwordPrompt ? "Unlock & Send" : "Confirm & Send"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Sending */}
        {step === "sending" && (
          <div className="text-center py-8 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Broadcasting transaction...</p>
          </div>
        )}

        {/* Step 5: Done */}
        {step === "done" && (
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
              <Send className="h-7 w-7 text-green-500" />
            </div>
            <div>
              <p className="font-semibold">BCH Sent!</p>
              <p className="text-sm text-muted-foreground mt-1">{formatBch(amountSatoshis)} sent to recipient</p>
            </div>
            {txid && (
              <div className="bg-muted p-2 rounded text-xs font-mono break-all">
                TX: {txid}
              </div>
            )}
            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
