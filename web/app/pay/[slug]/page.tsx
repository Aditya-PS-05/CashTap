"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { generatePaymentURI, shortenAddress } from "@/lib/utils";

type PaymentStatus = "awaiting" | "detected" | "confirmed";

export default function PaymentPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [status, setStatus] = useState<PaymentStatus>("awaiting");
  const [copied, setCopied] = useState(false);

  // Mock payment data
  const payment = {
    merchantName: "Coffee Shop BCH",
    merchantLogo: null,
    memo: "Coffee Latte",
    amountBch: "0.01460000",
    amountUsd: "5.00",
    address: "bitcoincash:qzm3abc123def456ghi789jkl012mno345",
  };

  const paymentURI = generatePaymentURI(payment.address, payment.amountBch, payment.memo);

  // Simulate payment detection after 15s for demo
  useEffect(() => {
    if (status !== "awaiting") return;
    const timer = setTimeout(() => setStatus("detected"), 15000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (status !== "detected") return;
    const timer = setTimeout(() => setStatus("confirmed"), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  const copyAddress = () => {
    navigator.clipboard.writeText(payment.address);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-6">
          {/* Merchant Info */}
          <div>
            <div className="mx-auto mb-3 relative w-14 h-14">
              <Image src="/images/bch_coin_icon.png" alt="BCH" fill className="object-contain" />
            </div>
            <h1 className="text-lg font-semibold">{payment.merchantName}</h1>
            {payment.memo && (
              <p className="text-sm text-muted-foreground">{payment.memo}</p>
            )}
          </div>

          {/* Amount */}
          <div className="rounded-lg bg-muted p-4">
            <p className="text-3xl font-bold">${payment.amountUsd}</p>
            <p className="text-sm text-muted-foreground">{payment.amountBch} BCH</p>
          </div>

          {status === "awaiting" && (
            <>
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="rounded-xl bg-white p-4">
                  <QRCodeSVG
                    value={paymentURI}
                    size={220}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Send BCH to:</p>
                <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                  <code className="text-xs flex-1 break-all text-left">{payment.address}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyAddress}>
                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              {/* Open in wallet */}
              <Button className="w-full gap-2" asChild>
                <a href={paymentURI}>
                  <ExternalLink className="h-4 w-4" /> Open in BCH Wallet
                </a>
              </Button>

              {/* Status */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Waiting for payment...</span>
              </div>
            </>
          )}

          {status === "detected" && (
            <div className="space-y-4 py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                <Loader2 className="h-8 w-8 animate-spin text-yellow-600" />
              </div>
              <div>
                <p className="text-lg font-semibold">Payment Detected!</p>
                <p className="text-sm text-muted-foreground">Waiting for confirmation...</p>
              </div>
              <Badge variant="warning">0-conf — Confirming</Badge>
            </div>
          )}

          {status === "confirmed" && (
            <div className="space-y-4 py-4">
              <div className="relative mx-auto w-20 h-20">
                <Image src="/images/bch_coin.png" alt="Payment Confirmed" fill className="object-contain animate-float" />
              </div>
              <div>
                <p className="text-lg font-semibold text-green-600">Payment Confirmed!</p>
                <p className="text-sm text-muted-foreground">Thank you for your payment.</p>
              </div>
              <Badge variant="success">Confirmed</Badge>
              <div className="pt-2 text-xs text-muted-foreground">
                <p>Transaction: <code className="font-mono">abc123...ef456</code></p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Powered by <span className="font-semibold text-primary">BCH Pay</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
