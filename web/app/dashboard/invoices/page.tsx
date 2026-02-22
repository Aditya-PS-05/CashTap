"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Send, Eye, Trash2, Mail } from "lucide-react";
import { toast } from "sonner";
import { InvoiceDetail } from "@/components/invoice-detail";

interface LineItem {
  desc: string;
  qty: number;
  price: string;
}

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

const mockInvoices: Invoice[] = [
  {
    id: "1", number: "INV-001", customerEmail: "alice@example.com", totalBch: "0.5845", totalUsd: "$200.00", status: "PAID", dueDate: "Feb 25", created: "Feb 18",
    items: [{ description: "Logo Design", quantity: 1, unitPrice: 200.00 }],
  },
  {
    id: "2", number: "INV-002", customerEmail: "bob@example.com", totalBch: "1.4613", totalUsd: "$500.00", status: "SENT", dueDate: "Feb 28", created: "Feb 20",
    items: [
      { description: "Web Design Service", quantity: 1, unitPrice: 350.00 },
      { description: "Hosting Setup", quantity: 1, unitPrice: 100.00 },
      { description: "Domain Registration", quantity: 2, unitPrice: 25.00 },
    ],
    notes: "Payment due within 7 days. Thank you for your business!",
  },
  {
    id: "3", number: "INV-003", customerEmail: "carol@example.com", totalBch: "0.2923", totalUsd: "$100.00", status: "VIEWED", dueDate: "Mar 1", created: "Feb 21",
    items: [{ description: "Consultation", quantity: 2, unitPrice: 50.00 }],
  },
  {
    id: "4", number: "INV-004", customerEmail: "dave@example.com", totalBch: "0.1461", totalUsd: "$50.00", status: "DRAFT", dueDate: "Mar 5", created: "Feb 22",
    items: [{ description: "Support Package", quantity: 1, unitPrice: 50.00 }],
  },
  {
    id: "5", number: "INV-005", customerEmail: "eve@example.com", totalBch: "0.4384", totalUsd: "$150.00", status: "OVERDUE", dueDate: "Feb 15", created: "Feb 10",
    items: [{ description: "Monthly Retainer", quantity: 1, unitPrice: 150.00 }],
  },
];

const statusColors = {
  DRAFT: "secondary" as const,
  SENT: "default" as const,
  VIEWED: "warning" as const,
  PAID: "success" as const,
  OVERDUE: "destructive" as const,
};

export default function InvoicesPage() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LineItem[]>([{ desc: "", qty: 1, price: "" }]);
  const [taxRate, setTaxRate] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const addItem = () => setItems([...items, { desc: "", qty: 1, price: "" }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  // Auto-calculate totals
  const subtotal = items.reduce((sum, item) => {
    const price = parseFloat(item.price) || 0;
    return sum + item.qty * price;
  }, 0);
  const taxAmount = subtotal * ((parseFloat(taxRate) || 0) / 100);
  const total = subtotal + taxAmount;

  const openDetail = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Create and send invoices to customers</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Invoice</DialogTitle>
              <DialogDescription>Create an invoice and send it to your customer.</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                toast.success("Invoice created!");
                setOpen(false);
                setItems([{ desc: "", qty: 1, price: "" }]);
                setTaxRate("");
              }}
            >
              <div>
                <label className="text-sm font-medium">Customer Email</label>
                <Input type="email" placeholder="customer@example.com" className="mt-1" />
              </div>

              <div>
                <label className="text-sm font-medium">Line Items</label>
                <div className="mt-2 space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        placeholder="Description"
                        className="flex-1"
                        value={item.desc}
                        onChange={(e) => updateItem(i, "desc", e.target.value)}
                      />
                      <Input
                        type="number"
                        placeholder="Qty"
                        className="w-16"
                        min={1}
                        value={item.qty}
                        onChange={(e) => updateItem(i, "qty", parseInt(e.target.value) || 1)}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        className="w-24"
                        value={item.price}
                        onChange={(e) => updateItem(i, "price", e.target.value)}
                      />
                      {items.length > 1 && (
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(i)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-2 gap-1" onClick={addItem}>
                  <Plus className="h-3 w-3" /> Add Item
                </Button>
              </div>

              {/* Tax Rate */}
              <div>
                <label className="text-sm font-medium">Tax Rate (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0"
                  className="mt-1 w-24"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>

              {/* Auto-calculated totals */}
              <div className="rounded-lg border p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {(parseFloat(taxRate) || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                    <span>${taxAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Due Date</label>
                <Input type="date" className="mt-1" />
              </div>

              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea placeholder="Payment terms, thank you message..." className="mt-1" />
              </div>

              <div className="flex gap-2">
                <Button type="submit" variant="outline" className="flex-1">Save Draft</Button>
                <Button type="submit" className="flex-1 gap-2">
                  <Send className="h-4 w-4" /> Send Invoice
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="p-4 font-medium">Invoice #</th>
                  <th className="p-4 font-medium">Customer</th>
                  <th className="p-4 font-medium">Amount</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Due Date</th>
                  <th className="p-4 font-medium">Created</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                    onClick={() => openDetail(inv)}
                  >
                    <td className="p-4 font-medium text-sm">{inv.number}</td>
                    <td className="p-4 text-sm text-muted-foreground">{inv.customerEmail}</td>
                    <td className="p-4">
                      <p className="text-sm font-medium">{inv.totalBch} BCH</p>
                      <p className="text-xs text-muted-foreground">{inv.totalUsd}</p>
                    </td>
                    <td className="p-4">
                      <Badge variant={statusColors[inv.status]} className="text-xs">{inv.status}</Badge>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{inv.dueDate}</td>
                    <td className="p-4 text-sm text-muted-foreground">{inv.created}</td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => { e.stopPropagation(); openDetail(inv); }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {(inv.status === "SENT" || inv.status === "VIEWED" || inv.status === "OVERDUE") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <InvoiceDetail invoice={selectedInvoice} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
