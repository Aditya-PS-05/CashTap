"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Download, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generatePaymentURI } from "@/lib/utils";
import { generateInvoicePdf } from "@/lib/generate-pdf";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:3456";

interface ApiInvoice {
  id: string;
  customer_email: string | null;
  items: { description: string; quantity: number; unit_price_satoshis: number }[];
  total_satoshis: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  notes?: string;
  merchant?: {
    business_name?: string;
    bch_address?: string;
    logo_url?: string;
  };
}

interface InvoiceData {
  number: string;
  merchantName: string;
  customerEmail: string;
  items: { description: string; quantity: number; unitPrice: number }[];
  totalUsd: string;
  totalBch: string;
  status: string;
  dueDate: string;
  created: string;
  address: string;
  notes: string;
}

export default function InvoicePage() {
  const params = useParams();
  const id = params.id as string;
  const [showPay, setShowPay] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bchPrice, setBchPrice] = useState(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const [invoiceRes, priceRes] = await Promise.all([
          fetch(`${API_BASE}/api/invoices/${id}`),
          fetch(`${API_BASE}/api/price`),
        ]);

        if (!invoiceRes.ok) {
          throw new Error(`Invoice not found`);
        }

        const invoiceData = await invoiceRes.json();
        const inv: ApiInvoice = invoiceData.invoice || invoiceData;

        let price = 0;
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          price = priceData.bch_usd || 0;
          setBchPrice(price);
        }

        const totalSats = Number(inv.total_satoshis);
        const totalBch = totalSats / 1e8;
        const totalUsd = price > 0 ? totalBch * price : 0;

        setInvoice({
          number: `INV-${inv.id.slice(0, 6).toUpperCase()}`,
          merchantName: inv.merchant?.business_name || "Merchant",
          customerEmail: inv.customer_email || "—",
          items: (inv.items || []).map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: price > 0 ? (item.unit_price_satoshis / 1e8) * price : item.unit_price_satoshis / 1e8,
          })),
          totalUsd: totalUsd.toFixed(2),
          totalBch: totalBch.toFixed(8),
          status: inv.status,
          dueDate: inv.due_date
            ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
            : "—",
          created: new Date(inv.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
          address: inv.merchant?.bch_address || "",
          notes: inv.notes || "",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load invoice");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-muted/30 py-8 px-4">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-lg font-semibold text-destructive">Invoice Not Found</p>
              <p className="text-sm text-muted-foreground mt-2">{error || "This invoice does not exist."}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const paymentURI = invoice.address
    ? generatePaymentURI(invoice.address, invoice.totalBch, `Invoice ${invoice.number}`)
    : "";
  const subtotal = invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const copyAddress = () => {
    if (!invoice.address) return;
    navigator.clipboard.writeText(invoice.address);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      await generateInvoicePdf("invoice-content", `${invoice.number}.pdf`);
      toast.success("PDF downloaded!");
    } catch {
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="p-8">
            <div id="invoice-content">
              {/* Invoice Header */}
              <div className="flex items-start justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0AC18E]">
                    <Zap className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">{invoice.merchantName}</h1>
                    <p className="text-sm text-muted-foreground">Invoice {invoice.number}</p>
                  </div>
                </div>
                <Badge
                  variant={invoice.status === "PAID" ? "success" : invoice.status === "OVERDUE" ? "destructive" : "warning"}
                >
                  {invoice.status}
                </Badge>
              </div>

              {/* Customer & Dates */}
              <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
                <div>
                  <p className="text-muted-foreground">Bill To</p>
                  <p className="font-medium">{invoice.customerEmail}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-medium">{invoice.dueDate}</p>
                </div>
              </div>

              {/* Line Items */}
              {invoice.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden mb-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted text-left">
                        <th className="p-3 font-medium">Description</th>
                        <th className="p-3 font-medium text-center">Qty</th>
                        <th className="p-3 font-medium text-right">Price</th>
                        <th className="p-3 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.items.map((item, i) => (
                        <tr key={i} className="border-t">
                          <td className="p-3">{item.description}</td>
                          <td className="p-3 text-center">{item.quantity}</td>
                          <td className="p-3 text-right">${item.unitPrice.toFixed(2)}</td>
                          <td className="p-3 text-right font-medium">${(item.quantity * item.unitPrice).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Totals */}
              <div className="flex justify-end mb-6">
                <div className="w-64 space-y-2 text-sm">
                  {invoice.items.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 text-base font-bold">
                    <span>Total</span>
                    <div className="text-right">
                      <p>${invoice.totalUsd}</p>
                      <p className="text-sm font-normal text-muted-foreground">{invoice.totalBch} BCH</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {invoice.notes && (
                <div className="text-sm text-muted-foreground border-t pt-4 mb-6">
                  <p className="font-medium text-foreground mb-1">Notes</p>
                  <p>{invoice.notes}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {invoice.address && (
                <Button className="flex-1 gap-2" onClick={() => setShowPay(!showPay)}>
                  {showPay ? "Hide" : "Pay Now"}
                </Button>
              )}
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
              >
                <Download className="h-4 w-4" /> {generatingPdf ? "Generating..." : "PDF"}
              </Button>
            </div>

            {/* Payment QR */}
            {showPay && invoice.address && (
              <div className="mt-6 border-t pt-6 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-xl bg-white p-4">
                    <QRCodeSVG value={paymentURI} size={200} level="M" />
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 max-w-md mx-auto">
                  <code className="text-xs flex-1 break-all text-left">{invoice.address}</code>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyAddress}>
                    {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <Button variant="outline" className="gap-2" asChild>
                  <a href={paymentURI}>Open in BCH Wallet</a>
                </Button>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 border-t pt-4 text-center">
              <p className="text-xs text-muted-foreground">
                Powered by <span className="font-semibold text-[#0AC18E]">CashTap</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
