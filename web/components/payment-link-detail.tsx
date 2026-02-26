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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Copy, ExternalLink, Check, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";

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
  onDeactivated,
}: {
  link: PaymentLink | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeactivated?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!link) return null;

  const appBase = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : "http://localhost:3000");
  const paymentUrl = `${appBase}/pay/${link.slug}`;

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

          {link.status === "ACTIVE" && (
            <Button
              variant="destructive"
              className="w-full gap-2"
              disabled={deactivating}
              onClick={() => setShowConfirm(true)}
            >
              {deactivating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Deactivate Link
            </Button>
          )}
        </div>

        {/* Deactivate Confirmation */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Deactivate Payment Link</DialogTitle>
              <DialogDescription>
                This link will stop accepting payments. You can&apos;t undo this action.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={deactivating}
                onClick={async () => {
                  setDeactivating(true);
                  setShowConfirm(false);
                  try {
                    const sessionRes = await fetch("/api/auth/session");
                    const sessionData = await sessionRes.json();
                    const headers: Record<string, string> = {};
                    if (sessionData.accessToken) {
                      headers["Authorization"] = `Bearer ${sessionData.accessToken}`;
                    }
                    const res = await fetch(`${API_BASE}/api/payment-links/${link.id}`, {
                      method: "DELETE",
                      headers,
                    });
                    if (res.ok) {
                      toast.success("Payment link deactivated");
                      onOpenChange(false);
                      onDeactivated?.();
                    } else {
                      toast.error("Failed to deactivate");
                    }
                  } catch {
                    toast.error("Failed to deactivate");
                  } finally {
                    setDeactivating(false);
                  }
                }}
              >
                Deactivate
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
