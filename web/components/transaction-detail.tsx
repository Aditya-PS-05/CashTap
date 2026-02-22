"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Copy, ExternalLink, Check, Coins, ImageIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatBch } from "@/lib/utils";

interface Transaction {
  id: string;
  txHash: string;
  amount: bigint;
  usd: number;
  sender: string;
  recipient: string;
  status: "confirmed" | "pending" | "failed";
  confirmations: number;
  memo: string;
  time: string;
  blockHeight: number | null;
  loyaltyTokensIssued?: number;
  receiptNftId?: string;
}

const statusConfig = {
  confirmed: { variant: "success" as const, label: "Confirmed" },
  pending: { variant: "warning" as const, label: "Pending" },
  failed: { variant: "destructive" as const, label: "Failed" },
};

export function TransactionDetail({
  tx,
  open,
  onOpenChange,
}: {
  tx: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!tx) return null;

  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("Copied!");
    setTimeout(() => setCopiedField(null), 2000);
  };

  const explorerUrl = `https://blockchair.com/bitcoin-cash/transaction/${tx.txHash}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{tx.memo || "Payment"}</SheetTitle>
          <SheetDescription>Transaction details</SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Amount */}
          <div className="text-center rounded-lg border p-4">
            <p className="text-2xl font-bold">{formatBch(tx.amount)}</p>
            <p className="text-sm text-muted-foreground">${tx.usd.toFixed(2)} USD</p>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge variant={statusConfig[tx.status].variant}>
              {statusConfig[tx.status].label}
            </Badge>
          </div>

          {/* Details */}
          <div className="space-y-3 text-sm">
            {/* Tx Hash */}
            <div>
              <p className="text-muted-foreground mb-1">Transaction Hash</p>
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                <code className="text-xs flex-1 break-all">{tx.txHash}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => copyText(tx.txHash, "hash")}
                >
                  {copiedField === "hash" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {/* Sender */}
            <div>
              <p className="text-muted-foreground mb-1">From</p>
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                <code className="text-xs flex-1 break-all">{tx.sender}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => copyText(tx.sender, "sender")}
                >
                  {copiedField === "sender" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {/* Recipient */}
            <div>
              <p className="text-muted-foreground mb-1">To</p>
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                <code className="text-xs flex-1 break-all">{tx.recipient}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => copyText(tx.recipient, "recipient")}
                >
                  {copiedField === "recipient" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Confirmations</span>
              <span className="font-medium">{tx.confirmations}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-muted-foreground">Timestamp</span>
              <span>{tx.time}</span>
            </div>

            {tx.blockHeight && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Block Height</span>
                <span className="font-mono">{tx.blockHeight.toLocaleString()}</span>
              </div>
            )}

            {tx.memo && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Memo</span>
                <span>{tx.memo}</span>
              </div>
            )}
          </div>

          {/* CashToken Info */}
          {(tx.loyaltyTokensIssued || tx.receiptNftId) && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm font-medium">CashToken Details</p>

              {tx.loyaltyTokensIssued != null && tx.loyaltyTokensIssued > 0 && (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <Coins className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Loyalty Tokens Issued</p>
                    <p className="text-xs text-muted-foreground">{tx.loyaltyTokensIssued} tokens awarded to customer</p>
                  </div>
                  <Badge variant="warning" className="text-xs">{tx.loyaltyTokensIssued}</Badge>
                </div>
              )}

              {tx.receiptNftId && (
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
                    <ImageIcon className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Receipt NFT</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{tx.receiptNftId}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => copyText(tx.receiptNftId!, "nft")}
                  >
                    {copiedField === "nft" ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Explorer Link */}
          <Button variant="outline" className="w-full gap-2" asChild>
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> View on Block Explorer
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
