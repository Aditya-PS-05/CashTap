"use client";

import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Copy, ExternalLink, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PaymentLink {
  id: string;
  slug: string;
  memo: string;
  amountBch: string;
  amountUsd: string;
  type: "SINGLE" | "MULTI";
  status: "ACTIVE" | "INACTIVE" | "EXPIRED";
  created: string;
  totalCollected: string;
  payCount: number;
  expiresAt?: string;
  loyaltyTokens?: boolean;
  receiptNft?: boolean;
}

const statusColors = {
  ACTIVE: "success" as const,
  INACTIVE: "secondary" as const,
  EXPIRED: "warning" as const,
};

export function PaymentLinkDetail({
  link,
  open,
  onOpenChange,
}: {
  link: PaymentLink | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!link) return null;

  const paymentUrl = `https://cashtap.app/pay/${link.slug}`;

  const copyUrl = () => {
    navigator.clipboard.writeText(paymentUrl);
    setCopied(true);
    toast.success("Payment link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{link.memo}</SheetTitle>
          <SheetDescription>Payment link details and QR code</SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* QR Code */}
          <div className="flex justify-center">
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <QRCodeSVG value={paymentUrl} size={180} level="M" />
            </div>
          </div>

          {/* Copyable URL */}
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
            <code className="text-xs flex-1 break-all">{paymentUrl}</code>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyUrl}>
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>

          {/* Collection Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-sm text-muted-foreground">Total Collected</p>
              <p className="text-lg font-bold">{link.totalCollected}</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-sm text-muted-foreground">Payments</p>
              <p className="text-lg font-bold">{link.payCount}</p>
            </div>
          </div>

          {/* Link Details */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-medium">
                {link.amountBch ? `${link.amountBch} BCH (${link.amountUsd})` : "Any amount"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <Badge variant="outline" className="text-xs">
                {link.type === "SINGLE" ? "Single Use" : "Multi Use"}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={statusColors[link.status]} className="text-xs">
                {link.status}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Created</span>
              <span>{link.created}</span>
            </div>
            {link.expiresAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expires</span>
                <span>{link.expiresAt}</span>
              </div>
            )}
            {link.loyaltyTokens && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Loyalty Tokens</span>
                <Badge variant="success" className="text-xs">Enabled</Badge>
              </div>
            )}
            {link.receiptNft && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Receipt NFT</span>
                <Badge variant="success" className="text-xs">Enabled</Badge>
              </div>
            )}
          </div>

          {/* Actions */}
          <Button variant="outline" className="w-full gap-2" asChild>
            <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Open Payment Page
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
