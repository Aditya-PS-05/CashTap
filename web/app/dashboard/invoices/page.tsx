"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Plus, Send, Eye, Trash2, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { InvoiceDetail } from "@/components/invoice-detail";
import { apiFetch } from "@/lib/api";
import { usePrice } from "@/lib/price-context";

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

interface ApiInvoice {
  id: string;
  customer_email: string | null;
  items: { description: string; quantity: number; unit_price_satoshis: number }[];
  total_satoshis: string;
  status: "DRAFT" | "SENT" | "VIEWED" | "PAID" | "OVERDUE";
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  notes?: string;
  merchant?: { bch_address?: string };
}

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
  const [customerEmail, setCustomerEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const { bchUsd } = usePrice();

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{
        invoices: ApiInvoice[];
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/api/invoices?page=${page}&limit=20`);

      const mapped: Invoice[] = data.invoices.map((inv, idx) => {
        const totalSats = Number(inv.total_satoshis);
        const totalBch = totalSats / 1e8;
        const totalUsd = bchUsd > 0 ? totalBch * bchUsd : 0;

        return {
          id: inv.id,
          number: `INV-${String(idx + 1 + (page - 1) * 20).padStart(3, "0")}`,
          customerEmail: inv.customer_email || "—",
          totalBch: totalBch.toFixed(8),
          totalUsd: `$${totalUsd.toFixed(2)}`,
          status: inv.status,
          dueDate: inv.due_date
            ? new Date(inv.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "—",
          created: new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          items: inv.items?.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: bchUsd > 0 ? (item.unit_price_satoshis / 1e8) * bchUsd : item.unit_price_satoshis / 1e8,
          })),
          notes: inv.notes,
          address: inv.merchant?.bch_address,
        };
      });

      setInvoices(mapped);
      setTotalPages(data.pagination.pages);
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, [page, bchUsd]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

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

  const handleCreateInvoice = async (e: React.FormEvent, send: boolean) => {
    e.preventDefault();
    if (!customerEmail) {
      toast.error("Customer email is required");
      return;
    }
    if (items.some((item) => !item.desc || !item.price)) {
      toast.error("Please fill in all line items");
      return;
    }

    setCreating(true);
    try {
      const totalUsd = total;
      const totalSatoshis = bchUsd > 0 ? Math.round((totalUsd / bchUsd) * 1e8) : 0;

      await apiFetch("/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          customer_email: customerEmail,
          items: items.map((item) => {
            const priceUsd = parseFloat(item.price) || 0;
            const priceSats = bchUsd > 0 ? Math.round((priceUsd / bchUsd) * 1e8) : 0;
            return {
              description: item.desc,
              quantity: item.qty,
              unit_price_satoshis: priceSats,
            };
          }),
          total_satoshis: totalSatoshis,
          due_date: dueDate || null,
          notes: notes || null,
          status: send ? "SENT" : "DRAFT",
        }),
      });

      toast.success(send ? "Invoice created and sent!" : "Invoice saved as draft!");
      setOpen(false);
      setItems([{ desc: "", qty: 1, price: "" }]);
      setTaxRate("");
      setCustomerEmail("");
      setDueDate("");
      setNotes("");
      fetchInvoices();
    } catch {
      toast.error("Failed to create invoice");
    } finally {
      setCreating(false);
    }
  };

  const handleSendInvoice = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/invoices/${id}/send`, { method: "POST" });
      toast.success("Invoice sent!");
      fetchInvoices();
    } catch {
      toast.error("Failed to send invoice");
    }
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
              onSubmit={(e) => handleCreateInvoice(e, false)}
            >
              <div>
                <label className="text-sm font-medium">Customer Email</label>
                <Input
                  type="email"
                  placeholder="customer@example.com"
                  className="mt-1"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
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
                <Input
                  type="date"
                  className="mt-1"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Notes</label>
                <Textarea
                  placeholder="Payment terms, thank you message..."
                  className="mt-1"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" variant="outline" className="flex-1" disabled={creating}>
                  Save Draft
                </Button>
                <Button
                  type="button"
                  className="flex-1 gap-2"
                  disabled={creating}
                  onClick={(e) => handleCreateInvoice(e, true)}
                >
                  <Send className="h-4 w-4" /> Send Invoice
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">No invoices yet</p>
              <p className="text-sm mt-1">Create your first invoice to get started.</p>
            </div>
          ) : (
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
                  {invoices.map((inv) => (
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
                              onClick={(e) => handleSendInvoice(inv.id, e)}
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
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <InvoiceDetail invoice={selectedInvoice} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
