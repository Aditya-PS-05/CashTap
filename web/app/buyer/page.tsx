"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Send, QrCode, ArrowDownLeft, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { usePrice } from "@/lib/price-context";
import { apiFetch } from "@/lib/api";
import { SendBchDialog } from "@/components/send-bch-dialog";
import { QRCodeSVG } from "qrcode.react";

interface BalanceData {
  confirmed_satoshis: number;
  unconfirmed_satoshis: number;
  total_satoshis: number;
}

interface TxRecord {
  id: string;
  tx_hash: string;
  amount_satoshis: string | number;
  status: string;
  created_at: string;
  sender_address: string;
  recipient_address: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";

export default function BuyerPage() {
  const { address } = useAuth();
  const { formatPrimary, formatSecondary } = usePrice();
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [transactions, setTransactions] = useState<TxRecord[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showReceive, setShowReceive] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`${API_BASE}/api/wallet/balance?address=${encodeURIComponent(address)}`);
      if (res.ok) {
        const data = await res.json();
        setBalance(data);
      }
    } catch {
      // Keep last known balance
    } finally {
      setLoadingBalance(false);
    }
  }, [address]);

  const fetchTransactions = useCallback(async () => {
    try {
      const data = await apiFetch<{ transactions: TxRecord[] }>("/api/transactions?limit=10");
      setTransactions(data.transactions || []);
    } catch {
      // No transactions available
    } finally {
      setLoadingTx(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
    const timer = setInterval(fetchBalance, 30000);
    return () => clearInterval(timer);
  }, [fetchBalance, fetchTransactions]);

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const totalSats = balance?.total_satoshis || 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Wallet</h1>
        <p className="text-muted-foreground">Send and receive Bitcoin Cash</p>
      </div>

      {/* Balance Card */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Your Balance</p>
              {loadingBalance ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <p className="text-3xl font-bold">{formatPrimary(totalSats)}</p>
                  <p className="text-sm text-muted-foreground">{formatSecondary(totalSats)}</p>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setSendOpen(true)} className="gap-2">
                <Send className="h-4 w-4" /> Send
              </Button>
              <Button variant="outline" onClick={() => setShowReceive(!showReceive)} className="gap-2">
                <ArrowDownLeft className="h-4 w-4" /> Receive
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Receive Section */}
      {showReceive && address && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4" /> Receive BCH
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="rounded-lg border p-4 bg-white">
              <QRCodeSVG value={address} size={180} />
            </div>
            <div className="flex items-center gap-2 w-full max-w-md">
              <code className="text-xs flex-1 break-all bg-muted p-3 rounded-md">{address}</code>
              <Button variant="ghost" size="icon" onClick={copyAddress}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this address or QR code to receive BCH
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTx ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No transactions yet</p>
              <p className="text-xs mt-1">Send or receive BCH to see activity here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const sats = Number(tx.amount_satoshis);
                const isSend = tx.sender_address === address;
                return (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isSend ? "bg-red-500/10" : "bg-green-500/10"}`}>
                        {isSend ? (
                          <Send className="h-4 w-4 text-red-500" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4 text-green-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{isSend ? "Sent" : "Received"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-medium ${isSend ? "text-red-500" : "text-green-500"}`}>
                        {isSend ? "-" : "+"}{formatPrimary(sats)}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{tx.status.toLowerCase()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <SendBchDialog open={sendOpen} onOpenChange={setSendOpen} onSuccess={() => { fetchBalance(); fetchTransactions(); }} />
    </div>
  );
}
