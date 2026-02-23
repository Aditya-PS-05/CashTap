"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Zap, Loader2, Receipt } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://cashtap-api-production.up.railway.app";
const EXPLORER_BASE = "https://chipnet.chaingraph.cash/tx/";

interface ReceiptData {
  id: string;
  merchant_name: string;
  merchant_logo: string | null;
  nft_category: string;
  commitment: string;
  tx_hash: string | null;
  mint_tx_hash: string | null;
  amount_satoshis: string;
  memo: string | null;
  created_at: string;
}

interface DecodedCommitment {
  merchantHash: string;
  amount: bigint;
  timestamp: Date;
  memoHash: string;
}

function decodeCommitment(hex: string): DecodedCommitment | null {
  try {
    if (hex.length < 40) return null;
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
    const view = new DataView(bytes.buffer);

    const merchantHash = hex.slice(0, 8);
    const amount = view.getBigUint64(4);
    const timestamp = new Date(view.getUint32(12) * 1000);
    const memoHash = hex.slice(32, 40);

    return { merchantHash, amount, timestamp, memoHash };
  } catch {
    return null;
  }
}

function formatBch(satoshis: string): string {
  const sats = BigInt(satoshis);
  const whole = sats / 100_000_000n;
  const frac = sats % 100_000_000n;
  const fracStr = frac.toString().padStart(8, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr} BCH` : `${whole} BCH`;
}

export default function ReceiptPage() {
  const params = useParams();
  const tokenId = params.tokenId as string;

  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReceipt() {
      try {
        const res = await fetch(`${API_BASE}/api/cashtokens/receipts/${tokenId}`);
        if (!res.ok) {
          setError(res.status === 404 ? "Receipt not found" : "Failed to load receipt");
          return;
        }
        const data = await res.json();
        setReceipt(data.receipt);
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    }

    fetchReceipt();
  }, [tokenId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <Receipt className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-lg font-semibold">{error || "Receipt not found"}</p>
            <p className="text-sm text-muted-foreground">
              This receipt may not exist or has been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const decoded = decodeCommitment(receipt.commitment);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-6">
          {/* Merchant Info */}
          <div>
            {receipt.merchant_logo ? (
              <img
                src={receipt.merchant_logo}
                alt={receipt.merchant_name}
                className="mx-auto mb-3 h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
            )}
            <h1 className="text-lg font-semibold">{receipt.merchant_name}</h1>
            <Badge variant="outline" className="mt-1">
              Payment Receipt NFT
            </Badge>
          </div>

          {/* Amount */}
          <div className="rounded-lg bg-muted p-4">
            <p className="text-3xl font-bold">{formatBch(receipt.amount_satoshis)}</p>
            <p className="text-sm text-muted-foreground">
              {new Date(receipt.created_at).toLocaleString()}
            </p>
          </div>

          {/* Receipt Details */}
          <div className="text-left space-y-3 rounded-lg border p-4">
            {receipt.memo && (
              <div>
                <p className="text-xs text-muted-foreground">Memo</p>
                <p className="text-sm font-medium">{receipt.memo}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">NFT Category</p>
              <code className="text-xs break-all">{receipt.nft_category}</code>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Commitment</p>
              <code className="text-xs break-all">{receipt.commitment}</code>
            </div>
            {decoded && (
              <div>
                <p className="text-xs text-muted-foreground">Decoded Commitment</p>
                <div className="text-xs space-y-1 mt-1">
                  <p>Merchant Hash: <code>{decoded.merchantHash}</code></p>
                  <p>Amount: <code>{decoded.amount.toString()} sats</code></p>
                  <p>Timestamp: <code>{decoded.timestamp.toISOString()}</code></p>
                  <p>Memo Hash: <code>{decoded.memoHash}</code></p>
                </div>
              </div>
            )}
          </div>

          {/* Explorer Links */}
          <div className="space-y-2">
            {receipt.tx_hash && (
              <a
                href={`${EXPLORER_BASE}${receipt.tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> View Payment TX
              </a>
            )}
            {receipt.mint_tx_hash && (
              <a
                href={`${EXPLORER_BASE}${receipt.mint_tx_hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> View NFT Mint TX
              </a>
            )}
          </div>

          {/* Footer */}
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Verified on-chain receipt powered by{" "}
              <span className="font-semibold text-primary">CashTap</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
