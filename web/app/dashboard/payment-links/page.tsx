"use client";

import { useState } from "react";
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
import { Plus, Copy, QrCode, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PaymentLinkDetail } from "@/components/payment-link-detail";

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

const mockLinks: PaymentLink[] = [
  { id: "1", slug: "cof-latte-5", memo: "Coffee Latte", amountBch: "0.0146", amountUsd: "$5.00", type: "MULTI", status: "ACTIVE", created: "Feb 20", totalCollected: "0.146 BCH", payCount: 10, loyaltyTokens: true },
  { id: "2", slug: "web-design", memo: "Web Design Service", amountBch: "0.5845", amountUsd: "$200.00", type: "SINGLE", status: "ACTIVE", created: "Feb 19", totalCollected: "0 BCH", payCount: 0, receiptNft: true },
  { id: "3", slug: "donation", memo: "Tip Jar / Donation", amountBch: "", amountUsd: "Any amount", type: "MULTI", status: "ACTIVE", created: "Feb 18", totalCollected: "0.87 BCH", payCount: 15 },
  { id: "4", slug: "old-promo", memo: "Flash Sale Promo", amountBch: "0.0292", amountUsd: "$10.00", type: "SINGLE", status: "EXPIRED", created: "Feb 15", totalCollected: "0.0292 BCH", payCount: 1, expiresAt: "Feb 16" },
];

const statusColors = {
  ACTIVE: "success" as const,
  INACTIVE: "secondary" as const,
  EXPIRED: "warning" as const,
};

export default function PaymentLinksPage() {
  const [open, setOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<PaymentLink | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [expiration, setExpiration] = useState("none");
  const [customExpiry, setCustomExpiry] = useState("");
  const [loyaltyTokens, setLoyaltyTokens] = useState(false);
  const [receiptNft, setReceiptNft] = useState(false);

  const copyLink = (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`https://bchpay.app/pay/${slug}`);
    toast.success("Payment link copied!");
  };

  const openDetail = (link: PaymentLink) => {
    setSelectedLink(link);
    setDetailOpen(true);
  };

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
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                toast.success("Payment link created!");
                setOpen(false);
                setExpiration("none");
                setCustomExpiry("");
                setLoyaltyTokens(false);
                setReceiptNft(false);
              }}
            >
              <div>
                <label className="text-sm font-medium">Amount (USD)</label>
                <Input type="number" step="0.01" placeholder="5.00" className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">Leave empty for any amount</p>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea placeholder="Coffee, Web Design, Donation..." className="mt-1" />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="type" value="SINGLE" className="accent-primary" />
                  Single Use
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="type" value="MULTI" defaultChecked className="accent-primary" />
                  Multi Use
                </label>
              </div>

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

              <Button type="submit" className="w-full">Create Payment Link</Button>
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
                  <th className="p-4 font-medium">Description</th>
                  <th className="p-4 font-medium">Amount</th>
                  <th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Collected</th>
                  <th className="p-4 font-medium">Created</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mockLinks.map((link) => (
                  <tr
                    key={link.id}
                    className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                    onClick={() => openDetail(link)}
                  >
                    <td className="p-4">
                      <p className="font-medium text-sm">{link.memo}</p>
                      <p className="text-xs text-muted-foreground font-mono">/pay/{link.slug}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-medium">{link.amountBch ? `${link.amountBch} BCH` : "Any"}</p>
                      <p className="text-xs text-muted-foreground">{link.amountUsd}</p>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline" className="text-xs">{link.type === "SINGLE" ? "Single" : "Multi"}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={statusColors[link.status]} className="text-xs">{link.status}</Badge>
                    </td>
                    <td className="p-4">
                      <p className="text-sm">{link.totalCollected}</p>
                      <p className="text-xs text-muted-foreground">{link.payCount} payments</p>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{link.created}</td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => copyLink(link.slug, e)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openDetail(link); }}>
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" asChild onClick={(e) => e.stopPropagation()}>
                          <a href={`https://bchpay.app/pay/${link.slug}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <PaymentLinkDetail link={selectedLink} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
