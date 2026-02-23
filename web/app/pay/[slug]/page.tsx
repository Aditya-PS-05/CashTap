"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ExternalLink, Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { generatePaymentURI, shortenAddress } from "@/lib/utils";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://cashtap-api-production.up.railway.app";

type PaymentStatus = "awaiting" | "detected" | "confirmed";

interface PaymentData {
  merchantName: string;
  merchantLogo: string | null;
  memo: string;
  amountBch: string;
  amountUsd: string;
  address: string;
}

export default function PaymentPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [status, setStatus] = useState<PaymentStatus>("awaiting");
  const [copied, setCopied] = useState(false);
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch payment link data
  useEffect(() => {
    async function fetchPaymentLink() {
      try {
        const [linkRes, priceRes] = await Promise.all([
          fetch(`${API_BASE}/api/payment-links/${slug}`),
          fetch(`${API_BASE}/api/price`),
        ]);

        if (!linkRes.ok) {
          throw new Error("Payment link not found");
        }

        const linkData = await linkRes.json();
        const pl = linkData.payment_link || linkData;

        let bchPrice = 0;
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          bchPrice = priceData.bch_usd || 0;
        }

        const amountSats = Number(pl.amount_satoshis || 0);
        const amountBch = amountSats / 1e8;
        const amountUsd = bchPrice > 0 ? amountBch * bchPrice : 0;

        const address = pl.payment_address || pl.merchant?.bch_address || "";

        setPayment({
          merchantName: pl.merchant?.business_name || "Merchant",
          merchantLogo: pl.merchant?.logo_url || null,
          memo: pl.memo || "",
          amountBch: amountBch.toFixed(8),
          amountUsd: amountUsd.toFixed(2),
          address,
        });

        // If the payment link is already inactive (paid), show confirmed immediately
        if (pl.status === "INACTIVE") {
          setStatus("confirmed");
          setTxHash(pl.tx_hash || null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load payment");
      } finally {
        setLoading(false);
      }
    }

    fetchPaymentLink();
  }, [slug]);

  // Poll for payment status
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/payment-links/${slug}`);
      if (!res.ok) return;
      const data = await res.json();
      const pl = data.payment_link || data;

      if (pl.status === "INACTIVE") {
        setStatus("confirmed");
        setTxHash(pl.tx_hash || null);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    } catch {
      // Polling failure is non-fatal
    }
  }, [slug]);

  useEffect(() => {
    if (status !== "awaiting" || loading || error) return;
    pollingRef.current = setInterval(pollStatus, 3000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [status, loading, error, pollStatus]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-lg font-semibold text-destructive">Payment Link Not Found</p>
            <p className="text-sm text-muted-foreground">{error || "This payment link does not exist or has expired."}</p>
            <div className="border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Powered by <span className="font-semibold text-primary">CashTap</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const paymentURI = generatePaymentURI(payment.address, payment.amountBch, payment.memo);

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
              {txHash && (
                <div className="pt-2 text-xs text-muted-foreground">
                  <p>Transaction: <code className="font-mono">{shortenAddress(txHash)}</code></p>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Powered by <span className="font-semibold text-primary">CashTap</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
