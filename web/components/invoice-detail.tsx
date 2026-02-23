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
import { Download, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { generatePaymentURI } from "@/lib/utils";
import { generateInvoicePdf } from "@/lib/generate-pdf";

interface Invoice {
  id: string;
  number: string;
  customerEmail: string;
  totalBch: string;
  totalUsd: string;
  status: "DRAFT" | "SENT" | "VIEWED" | "PAID" | "OVERDUE";
  dueDate: string;
  created: string;
  items?: { description: string; quantity: number; unitPrice: number }[];
  notes?: string;
  address?: string;
  taxRate?: number;
}

const statusColors = {
  DRAFT: "secondary" as const,
  SENT: "default" as const,
  VIEWED: "warning" as const,
  PAID: "success" as const,
  OVERDUE: "destructive" as const,
};

export function InvoiceDetail({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!invoice) return null;

  const items = invoice.items || [];
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxRate = invoice.taxRate ?? 0;
  const tax = subtotal * (taxRate / 100);
  const address = invoice.address;
  const paymentURI = address ? generatePaymentURI(address, invoice.totalBch, `Invoice ${invoice.number}`) : "";
  const isPaid = invoice.status === "PAID";

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    try {
      await generateInvoicePdf("invoice-detail-content", `${invoice.number}.pdf`);
      toast.success("PDF downloaded!");
    } catch {
      toast.error("Failed to generate PDF");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-lg w-full">
        <SheetHeader>
          <SheetTitle>Invoice {invoice.number}</SheetTitle>
          <SheetDescription>{invoice.customerEmail}</SheetDescription>
        </SheetHeader>

        <div id="invoice-detail-content" className="space-y-6 bg-background">
          {/* Status & Meta */}
          <div className="flex items-center justify-between">
            <Badge variant={statusColors[invoice.status]}>{invoice.status}</Badge>
            <span className="text-sm text-muted-foreground">Due: {invoice.dueDate}</span>
          </div>

          {/* Line Items */}
          {items.length > 0 && items[0].unitPrice > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted text-left">
                    <th className="p-2 font-medium">Item</th>
                    <th className="p-2 font-medium text-center">Qty</th>
                    <th className="p-2 font-medium text-right">Price</th>
                    <th className="p-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{item.description}</td>
                      <td className="p-2 text-center">{item.quantity}</td>
                      <td className="p-2 text-right">${item.unitPrice.toFixed(2)}</td>
                      <td className="p-2 text-right font-medium">
                        ${(item.quantity * item.unitPrice).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totals */}
          <div className="space-y-2 text-sm">
            {items.length > 0 && items[0]?.unitPrice > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                    <span>${tax.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <span>Total</span>
              <div className="text-right">
                <p>{invoice.totalUsd}</p>
                <p className="text-sm font-normal text-muted-foreground">{invoice.totalBch} BCH</p>
              </div>
            </div>
          </div>

          {/* Payment QR (if not paid and address available) */}
          {!isPaid && address && (
            <div className="text-center space-y-3 border-t pt-4">
              <p className="text-sm font-medium">Scan to Pay</p>
              <div className="flex justify-center">
                <div className="rounded-xl bg-white p-3">
                  <QRCodeSVG value={paymentURI} size={140} level="M" />
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2">
                <code className="text-xs flex-1 break-all">{address}</code>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyAddress}>
                  {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="text-sm text-muted-foreground border-t pt-3">
              <p className="font-medium text-foreground mb-1">Notes</p>
              <p>{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* PDF Download */}
        <div className="mt-4">
          <Button variant="outline" className="w-full gap-2" onClick={handleDownloadPdf}>
            <Download className="h-4 w-4" /> Download PDF
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
