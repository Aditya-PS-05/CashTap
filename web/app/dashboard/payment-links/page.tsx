"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Copy, QrCode, ExternalLink, Loader2, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { PaymentLinkDetail } from "@/components/payment-link-detail";
import { usePrice } from "@/lib/price-context";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";

interface PaymentLink {
  id: string;
  slug: string;
  memo: string | null;
  amount_satoshis: string;
  currency: string;
  type: "SINGLE" | "MULTI" | "RECURRING";
  status: "ACTIVE" | "INACTIVE" | "EXPIRED";
  recurring_interval?: string | null;
  recurring_count?: number;
  last_paid_at?: string | null;
  payment_address?: string | null;
  created_at: string;
  expires_at?: string | null;
}

const statusColors = {
  ACTIVE: "success" as const,
  INACTIVE: "secondary" as const,
  EXPIRED: "warning" as const,
};

const typeLabels: Record<string, string> = {
  SINGLE: "Single",
  MULTI: "Multi",
  RECURRING: "Recurring",
};

export default function PaymentLinksPage() {
  const [open, setOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<PaymentLink | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [expiration, setExpiration] = useState("none");
  const [customExpiry, setCustomExpiry] = useState("");
  const [loyaltyTokens, setLoyaltyTokens] = useState(false);
  const [receiptNft, setReceiptNft] = useState(false);
  const [linkType, setLinkType] = useState<"SINGLE" | "MULTI" | "RECURRING">("MULTI");
  const [recurringInterval, setRecurringInterval] = useState("monthly");
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [contractLink, setContractLink] = useState(false);
  const [selectedContract, setSelectedContract] = useState("");
  const [activeContracts, setActiveContracts] = useState<any[]>([]);
  const [expandedLink, setExpandedLink] = useState<string | null>(null);
  const [linkStats, setLinkStats] = useState<Record<string, any>>({});
  const { formatBch, formatUsd, bchUsd } = usePrice();

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const res = await fetch("/api/auth/session");
      if (res.ok) {
        const data = await res.json();
        if (data.accessToken) {
          return { Authorization: `Bearer ${data.accessToken}` };
        }
      }
    } catch {}
    return {};
  }, []);

  const fetchLinks = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/payment-links`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLinks(data.payment_links || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const fetchActiveContracts = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/contracts?type=SPLIT_PAYMENT&status=ACTIVE`, { headers });
      if (res.ok) {
        const data = await res.json();
        setActiveContracts(data.contracts || []);
      }
    } catch {
      // Silently fail
    }
  }, [getAuthHeaders]);

  const fetchLinkStats = useCallback(async (id: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/payment-links/${id}/stats`, { headers });
      if (res.ok) {
        const data = await res.json();
        setLinkStats((prev) => ({ ...prev, [id]: data }));
      }
    } catch {
      // Silently fail
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchLinks();
  }, [fetchLinks]);

  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<string | null>(null);

  const deactivateLink = async (id: string) => {
    setDeleting(id);
    setConfirmDeactivate(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/payment-links/${id}`, {
        method: "DELETE",
        headers,
      });
      if (res.ok) {
        toast.success("Payment link deactivated");
        fetchLinks();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to deactivate");
      }
    } catch {
      toast.error("Failed to deactivate payment link");
    } finally {
      setDeleting(null);
    }
  };

  const copyLink = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/pay/${slug}`);
    toast.success("Payment link copied!");
  };

  const openDetail = (link: PaymentLink) => {
    setSelectedLink(link);
    setDetailOpen(true);
  };

  const computeExpiresAt = (): string | undefined => {
    if (expiration === "none") return undefined;
    if (expiration === "custom" && customExpiry) {
      return new Date(customExpiry).toISOString();
    }
    const now = Date.now();
    const offsets: Record<string, number> = {
      "1h": 3600_000,
      "24h": 86400_000,
      "7d": 604800_000,
      "30d": 2592000_000,
    };
    const offset = offsets[expiration];
    return offset ? new Date(now + offset).toISOString() : undefined;
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreating(true);

    const form = e.currentTarget;
    const amountStr = (form.elements.namedItem("amount") as HTMLInputElement)?.value;
    const memo = (form.elements.namedItem("memo") as HTMLTextAreaElement)?.value;

    if (!amountStr || parseFloat(amountStr) <= 0) {
      toast.error("Please enter a valid amount");
      setCreating(false);
      return;
    }

    // Amount is entered in satoshis directly (label says "Amount (satoshis)")
    const amountSatoshis = Math.round(parseFloat(amountStr));

    try {
      const headers = await getAuthHeaders();
      const body: Record<string, unknown> = {
        amount_satoshis: amountSatoshis,
        memo: memo || undefined,
        type: linkType,
        expires_at: computeExpiresAt(),
        contract_instance_id: contractLink ? selectedContract : undefined,
      };

      if (linkType === "RECURRING") {
        body.recurring_interval = recurringInterval;
      }

      const res = await fetch(`${API_BASE}/api/payment-links`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success("Payment link created!");
        setOpen(false);
        setExpiration("none");
        setCustomExpiry("");
        setLoyaltyTokens(false);
        setReceiptNft(false);
        setContractLink(false);
        setSelectedContract("");
        setLinkType("MULTI");
        fetchLinks();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create payment link");
      }
    } catch {
      toast.error("Failed to create payment link");
    } finally {
      setCreating(false);
    }
  };

  // Adapt PaymentLink for the detail component
  const adaptForDetail = (link: PaymentLink) => ({
    id: link.id,
    slug: link.slug,
    memo: link.memo || "",
    amountBch: link.amount_satoshis ? formatBch(link.amount_satoshis) : "",
    amountUsd: link.amount_satoshis ? formatUsd(link.amount_satoshis) : "Any amount",
    type: link.type as "SINGLE" | "MULTI",
    status: link.status,
    created: new Date(link.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    totalCollected: "0 BCH",
    payCount: link.recurring_count || 0,
    expiresAt: link.expires_at || undefined,
    loyaltyTokens: false,
    receiptNft: false,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payment Links</h1>
          <p className="text-muted-foreground">Create and manage payment links</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Create Link
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Payment Link</DialogTitle>
              <DialogDescription>Generate a shareable link to receive BCH payments.</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="text-sm font-medium">Amount (satoshis)</label>
                <Input name="amount" type="number" step="1" placeholder="50000" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea name="memo" placeholder="Coffee, Web Design, Donation..." className="mt-1" />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="type"
                    value="SINGLE"
                    checked={linkType === "SINGLE"}
                    onChange={() => setLinkType("SINGLE")}
                    className="accent-primary"
                  />
                  Single Use
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="type"
                    value="MULTI"
                    checked={linkType === "MULTI"}
                    onChange={() => setLinkType("MULTI")}
                    className="accent-primary"
                  />
                  Multi Use
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="type"
                    value="RECURRING"
                    checked={linkType === "RECURRING"}
                    onChange={() => setLinkType("RECURRING")}
                    className="accent-primary"
                  />
                  Recurring
                </label>
              </div>

              {linkType === "RECURRING" && (
                <div>
                  <label className="text-sm font-medium">Billing Interval</label>
                  <Select value={recurringInterval} onValueChange={setRecurringInterval}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Expiration */}
              <div>
                <label className="text-sm font-medium">Expiration</label>
                <Select value={expiration} onValueChange={setExpiration}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="No expiration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No expiration</SelectItem>
                    <SelectItem value="1h">1 hour</SelectItem>
                    <SelectItem value="24h">24 hours</SelectItem>
                    <SelectItem value="7d">7 days</SelectItem>
                    <SelectItem value="30d">30 days</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {expiration === "custom" && (
                  <Input
                    type="datetime-local"
                    className="mt-2"
                    value={customExpiry}
                    onChange={(e) => setCustomExpiry(e.target.value)}
                  />
                )}
              </div>

              {/* Loyalty Token Toggle */}
              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={loyaltyTokens}
                  onChange={(e) => setLoyaltyTokens(e.target.checked)}
                  className="h-4 w-4 rounded accent-primary"
                />
                <div>
                  <p className="font-medium">Issue loyalty tokens</p>
                  <p className="text-xs text-muted-foreground">Award CashTokens for this payment</p>
                </div>
              </label>

              {/* Receipt NFT Toggle */}
              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={receiptNft}
                  onChange={(e) => setReceiptNft(e.target.checked)}
                  className="h-4 w-4 rounded accent-primary"
                />
                <div>
                  <p className="font-medium">Mint receipt NFT</p>
                  <p className="text-xs text-muted-foreground">Create an on-chain receipt as an NFT</p>
                </div>
              </label>

              {/* Link to Split Contract */}
              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={contractLink}
                  onChange={(e) => {
                    setContractLink(e.target.checked);
                    if (e.target.checked) fetchActiveContracts();
                  }}
                  className="h-4 w-4 rounded accent-primary"
                />
                <div>
                  <p className="font-medium">Link to split contract</p>
                  <p className="text-xs text-muted-foreground">Paying this link triggers a split payment</p>
                </div>
              </label>
              {contractLink && (
                <Select value={selectedContract} onValueChange={setSelectedContract}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select contract..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeContracts.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.address.slice(0, 20)}... ({c.constructor_args?.recipients?.length || 2} recipients)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button type="submit" className="w-full" disabled={creating}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Payment Link
              </Button>
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="p-4 font-medium">Description</th>
                    <th className="p-4 font-medium">Amount</th>
                    <th className="p-4 font-medium">Type</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Interval</th>
                    <th className="p-4 font-medium">Created</th>
                    <th className="p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {links.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        <div className="relative mx-auto w-32 h-16 mb-4">
                          <Image src="/images/pay_button.png" alt="No payment links" fill className="object-contain opacity-60" />
                        </div>
                        No payment links yet. Create your first one!
                      </td>
                    </tr>
                  ) : (
                    links.map((link) => (
                      <React.Fragment key={link.id}>
                        <tr
                          className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            if (link.type === "RECURRING") {
                              const isExpanding = expandedLink !== link.id;
                              setExpandedLink(isExpanding ? link.id : null);
                              if (isExpanding && !linkStats[link.id]) {
                                fetchLinkStats(link.id);
                              }
                            } else {
                              openDetail(link);
                            }
                          }}
                        >
                          <td className="p-4">
                            <p className="font-medium text-sm">{link.memo || "Untitled"}</p>
                            <p className="text-xs text-muted-foreground font-mono">/pay/{link.slug}</p>
                          </td>
                          <td className="p-4">
                            <p className="text-sm font-medium">
                              {link.amount_satoshis ? formatBch(link.amount_satoshis) : "Any"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {link.amount_satoshis ? formatUsd(link.amount_satoshis) : ""}
                            </p>
                          </td>
                          <td className="p-4">
                            <Badge
                              variant={link.type === "RECURRING" ? "default" : "outline"}
                              className="text-xs"
                            >
                              {typeLabels[link.type] || link.type}
                            </Badge>
                            {link.type === "RECURRING" && (
                              <span className="ml-1 inline-flex align-middle">
                                {expandedLink === link.id ? (
                                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </span>
                            )}
                          </td>
                          <td className="p-4">
                            <Badge variant={statusColors[link.status]} className="text-xs">
                              {link.status}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm text-muted-foreground capitalize">
                            {link.recurring_interval || "-"}
                            {link.recurring_count ? ` (${link.recurring_count}x)` : ""}
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {new Date(link.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => copyLink(link.slug, e)}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openDetail(link); }}>
                                <QrCode className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" asChild onClick={(e) => e.stopPropagation()}>
                                <a href={`/pay/${link.slug}`} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              {link.status === "ACTIVE" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  disabled={deleting === link.id}
                                  onClick={(e) => { e.stopPropagation(); setConfirmDeactivate(link.id); }}
                                >
                                  {deleting === link.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {link.type === "RECURRING" && expandedLink === link.id && (
                          <tr className="bg-muted/30">
                            <td colSpan={7} className="px-4 py-3">
                              {linkStats[link.id] ? (
                                <div className="flex gap-8 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Total Collected: </span>
                                    <span className="font-medium">
                                      {linkStats[link.id].total_collected_satoshis
                                        ? formatBch(String(linkStats[link.id].total_collected_satoshis))
                                        : "0 BCH"}
                                      {linkStats[link.id].total_collected_satoshis
                                        ? ` (${formatUsd(String(linkStats[link.id].total_collected_satoshis))})`
                                        : " ($0.00)"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Payment Count: </span>
                                    <span className="font-medium">{linkStats[link.id].payment_count ?? 0}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Last Payment: </span>
                                    <span className="font-medium">
                                      {linkStats[link.id].last_payment_at
                                        ? new Date(linkStats[link.id].last_payment_at).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                          })
                                        : "Never"}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Loading stats...
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedLink && (
        <PaymentLinkDetail link={adaptForDetail(selectedLink)} open={detailOpen} onOpenChange={setDetailOpen} onDeactivated={fetchLinks} />
      )}

      {/* Deactivate Confirmation Dialog */}
      <Dialog open={!!confirmDeactivate} onOpenChange={(open) => { if (!open) setConfirmDeactivate(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Deactivate Payment Link</DialogTitle>
            <DialogDescription>
              This link will stop accepting payments. You can&apos;t undo this action.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setConfirmDeactivate(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeactivate && deactivateLink(confirmDeactivate)}
            >
              Deactivate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
