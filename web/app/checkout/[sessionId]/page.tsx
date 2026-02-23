"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, ExternalLink, Loader2, X } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://cashtap-api-production.up.railway.app";

type SessionStatus = "loading" | "awaiting" | "detected" | "confirmed" | "expired" | "error";

interface SessionData {
  id: string;
  status: string;
  amount_satoshis: string;
  currency: string;
  memo: string | null;
  success_url: string;
  cancel_url: string;
  expires_at: string;
  merchant: {
    id: string;
    business_name: string;
    bch_address: string;
    logo_url: string | null;
  };
  payment_link: {
    id: string;
    slug: string;
    amount_satoshis: string;
    payment_address: string | null;
    status: string;
  } | null;
}

export default function CheckoutPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const isEmbed = searchParams.get("embed") === "true";

  const [status, setStatus] = useState<SessionStatus>("loading");
  const [session, setSession] = useState<SessionData | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/checkout/${sessionId}`);
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = await res.json();
      setSession(data.session);

      if (data.session.status === "COMPLETE") {
        setStatus("confirmed");
        // Redirect or postMessage
        setTimeout(() => {
          const url = `${data.session.success_url}${data.session.success_url.includes("?") ? "&" : "?"}session_id=${sessionId}`;
          if (isEmbed) {
            window.parent.postMessage({ type: "cashtap:success", payload: { session_id: sessionId, status: "COMPLETE" } }, "*");
          } else {
            window.location.href = url;
          }
        }, 2000);
      } else if (data.session.status === "EXPIRED") {
        setStatus("expired");
      } else {
        // Check if payment link is now inactive (paid)
        if (data.session.payment_link?.status === "INACTIVE") {
          setStatus("confirmed");
        } else {
          setStatus("awaiting");
        }
      }
    } catch {
      setStatus("error");
    }
  }, [sessionId, isEmbed]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Poll for updates
  useEffect(() => {
    if (status !== "awaiting") return;
    const timer = setInterval(fetchSession, 3000);
    return () => clearInterval(timer);
  }, [status, fetchSession]);

  const paymentAddress = session?.payment_link?.payment_address || session?.merchant?.bch_address || "";
  const amountSats = Number(session?.payment_link?.amount_satoshis || session?.amount_satoshis || 0);
  const amountBch = (amountSats / 1e8).toFixed(8);
  const amountUsd = session?.currency === "USD" ? ((Number(session?.amount_satoshis || 0) / 1e8) * 400).toFixed(2) : null;
  const paymentURI = paymentAddress ? `bitcoincash:${paymentAddress.replace("bitcoincash:", "")}?amount=${amountBch}` : "";

  const copyAddress = () => {
    navigator.clipboard.writeText(paymentAddress);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCancel = () => {
    if (isEmbed) {
      window.parent.postMessage({ type: "cashtap:cancel" }, "*");
    } else if (session?.cancel_url) {
      window.location.href = session.cancel_url;
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-lg font-semibold text-red-500">Session not found</p>
            <p className="text-sm text-muted-foreground mt-2">This checkout session may have expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-6">
          {/* Merchant Info */}
          <div>
            <div className="mx-auto mb-3 relative w-14 h-14">
              <Image src="/images/bch_coin_icon.png" alt="BCH" fill className="object-contain" />
            </div>
            <h1 className="text-lg font-semibold">{session?.merchant?.business_name || "Payment"}</h1>
            {session?.memo && <p className="text-sm text-muted-foreground">{session.memo}</p>}
          </div>

          {/* Amount */}
          <div className="rounded-lg bg-muted p-4">
            {amountUsd && <p className="text-3xl font-bold">${amountUsd}</p>}
            <p className={amountUsd ? "text-sm text-muted-foreground" : "text-3xl font-bold"}>
              {amountBch} BCH
            </p>
          </div>

          {status === "awaiting" && (
            <>
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="rounded-xl bg-white p-4">
                  <QRCodeSVG value={paymentURI} size={220} level="M" includeMargin={false} />
                </div>
              </div>

              {/* Address */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Send BCH to:</p>
                <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                  <code className="text-xs flex-1 break-all text-left">{paymentAddress}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyAddress}>
                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              <Button className="w-full gap-2" asChild>
                <a href={paymentURI}>
                  <ExternalLink className="h-4 w-4" /> Open in BCH Wallet
                </a>
              </Button>

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Waiting for payment...</span>
              </div>

              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleCancel}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
            </>
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
            </div>
          )}

          {status === "expired" && (
            <div className="space-y-4 py-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                <X className="h-8 w-8 text-yellow-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-yellow-600">Session Expired</p>
                <p className="text-sm text-muted-foreground">This checkout session has expired.</p>
              </div>
              <Button variant="outline" onClick={handleCancel}>Go Back</Button>
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
