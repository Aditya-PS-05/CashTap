"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Download, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { generatePaymentURI } from "@/lib/utils";
import { generateInvoicePdf } from "@/lib/generate-pdf";

const mockInvoice = {
  number: "INV-002",
  merchantName: "Coffee Shop BCH",
  customerEmail: "bob@example.com",
  items: [
    { description: "Web Design Service", quantity: 1, unitPrice: 350.00 },
    { description: "Hosting Setup", quantity: 1, unitPrice: 100.00 },
    { description: "Domain Registration", quantity: 2, unitPrice: 25.00 },
  ],
  totalUsd: "500.00",
  totalBch: "1.4613",
  status: "SENT" as string,
  dueDate: "February 28, 2026",
  created: "February 20, 2026",
  address: "bitcoincash:qzm3abc123def456ghi789jkl012mno345",
  notes: "Payment due within 7 days. Thank you for your business!",
};

export default function InvoicePage() {
  const params = useParams();
  const [showPay, setShowPay] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const paymentURI = generatePaymentURI(mockInvoice.address, mockInvoice.totalBch, `Invoice ${mockInvoice.number}`);
  const subtotal = mockInvoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  const copyAddress = () => {
    navigator.clipboard.writeText(mockInvoice.address);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      await generateInvoicePdf("invoice-content", `${mockInvoice.number}.pdf`);
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
                    <h1 className="text-xl font-bold">{mockInvoice.merchantName}</h1>
                    <p className="text-sm text-muted-foreground">Invoice {mockInvoice.number}</p>
                  </div>
                </div>
                <Badge
                  variant={mockInvoice.status === "PAID" ? "success" : mockInvoice.status === "OVERDUE" ? "destructive" : "warning"}
                >
                  {mockInvoice.status}
                </Badge>
              </div>

              {/* Customer & Dates */}
              <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
                <div>
                  <p className="text-muted-foreground">Bill To</p>
                  <p className="font-medium">{mockInvoice.customerEmail}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Due Date</p>
                  <p className="font-medium">{mockInvoice.dueDate}</p>
                </div>
              </div>

              {/* Line Items */}
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
                    {mockInvoice.items.map((item, i) => (
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

              {/* Totals */}
              <div className="flex justify-end mb-6">
                <div className="w-64 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base font-bold">
                    <span>Total</span>
                    <div className="text-right">
                      <p>${mockInvoice.totalUsd}</p>
                      <p className="text-sm font-normal text-muted-foreground">{mockInvoice.totalBch} BCH</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {mockInvoice.notes && (
                <div className="text-sm text-muted-foreground border-t pt-4 mb-6">
                  <p className="font-medium text-foreground mb-1">Notes</p>
                  <p>{mockInvoice.notes}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button className="flex-1 gap-2" onClick={() => setShowPay(!showPay)}>
                {showPay ? "Hide" : "Pay Now"}
              </Button>
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
            {showPay && (
              <div className="mt-6 border-t pt-6 text-center space-y-4">
                <div className="flex justify-center">
                  <div className="rounded-xl bg-white p-4">
                    <QRCodeSVG value={paymentURI} size={200} level="M" />
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 max-w-md mx-auto">
                  <code className="text-xs flex-1 break-all text-left">{mockInvoice.address}</code>
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
                Powered by <span className="font-semibold text-[#0AC18E]">BCH Pay</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
