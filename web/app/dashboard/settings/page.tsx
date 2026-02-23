"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Key, Plus, Trash2, Webhook, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { usePrice } from "@/lib/price-context";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://bch-pay-api-production.up.railway.app";

export default function SettingsPage() {
  const router = useRouter();
  const { displayCurrency, setDisplayCurrency } = usePrice();
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [receiptsEnabled, setReceiptsEnabled] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(true);

  useEffect(() => {
    fetchTokenStatus();
  }, []);

  async function getAuthToken(): Promise<string | null> {
    try {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      return data.accessToken || null;
    } catch {
      return null;
    }
  }

  async function fetchTokenStatus() {
    const token = await getAuthToken();
    if (!token) {
      setLoadingTokens(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/cashtokens/loyalty/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setLoyaltyEnabled(data.stats.loyaltyTokens.configured);
        setReceiptsEnabled(data.stats.receiptNFTs.configured);
      }
    } catch {
      // Stats not available
    } finally {
      setLoadingTokens(false);
    }
  }

  async function handleLoyaltyToggle() {
    if (!loyaltyEnabled) {
      router.push("/dashboard/tokens");
    }
  }

  async function handleReceiptsToggle() {
    if (receiptsEnabled) return;

    const token = await getAuthToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/api/cashtokens/receipts/enable`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setReceiptsEnabled(true);
        toast.success("Receipt NFTs enabled!");
      } else if (res.status === 409) {
        setReceiptsEnabled(true);
        toast.info("Receipt NFTs already enabled");
      } else {
        toast.error("Failed to enable receipt NFTs");
      }
    } catch {
      toast.error("Network error");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your merchant profile and configuration</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Merchant Profile</CardTitle>
          <CardDescription>Your business information displayed to customers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Business Name</label>
            <Input defaultValue="Coffee Shop BCH" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input type="email" defaultValue="merchant@coffeeshop.com" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Logo URL</label>
            <Input defaultValue="https://example.com/logo.png" className="mt-1" />
          </div>
          <Button size="sm">Save Changes</Button>
        </CardContent>
      </Card>

      {/* Wallet */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wallet</CardTitle>
          <CardDescription>Your connected BCH wallet address.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 rounded-md bg-muted p-3">
            <code className="text-xs flex-1 break-all">bitcoincash:qzm3abc123def456ghi789jkl012mno345</code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => {
                navigator.clipboard.writeText("bitcoincash:qzm3abc123def456ghi789jkl012mno345");
                toast.success("Address copied!");
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Balance</span>
            <span className="font-medium">3.456 BCH ($1,183.00)</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Network</span>
            <Badge variant="outline" className="text-xs">Chipnet (Testnet)</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payment Settings</CardTitle>
          <CardDescription>Configure how you accept payments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Accept 0-conf Payments</p>
              <p className="text-xs text-muted-foreground">Accept unconfirmed transactions for fast checkout</p>
            </div>
            <input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">0-conf Threshold</p>
              <p className="text-xs text-muted-foreground">Maximum amount for instant 0-conf acceptance</p>
            </div>
            <Input defaultValue="50.00" className="w-28 text-right" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Minimum Payment</p>
              <p className="text-xs text-muted-foreground">Minimum BCH amount accepted</p>
            </div>
            <Input defaultValue="0.00" className="w-28 text-right" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">CashToken Loyalty</p>
              <p className="text-xs text-muted-foreground">Issue loyalty tokens on purchases</p>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={loyaltyEnabled}
              disabled={loadingTokens}
              onChange={handleLoyaltyToggle}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Receipt NFTs</p>
              <p className="text-xs text-muted-foreground">Mint receipt NFTs for each transaction</p>
            </div>
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={receiptsEnabled}
              disabled={loadingTokens}
              onChange={handleReceiptsToggle}
            />
          </div>
          <Button size="sm">Save Settings</Button>
        </CardContent>
      </Card>

      {/* Display Currency */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Display Currency
          </CardTitle>
          <CardDescription>Choose how amounts are displayed across the dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="display_currency"
                value="BCH"
                checked={displayCurrency === "BCH"}
                onChange={() => setDisplayCurrency("BCH")}
                className="accent-primary"
              />
              <span className="font-medium">BCH</span>
              <span className="text-xs text-muted-foreground">Show amounts in Bitcoin Cash</span>
            </label>
          </div>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="display_currency"
                value="USD"
                checked={displayCurrency === "USD"}
                onChange={() => setDisplayCurrency("USD")}
                className="accent-primary"
              />
              <span className="font-medium">USD</span>
              <span className="text-xs text-muted-foreground">Show amounts in US Dollars</span>
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            The secondary currency is always shown alongside the primary one.
          </p>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Webhooks
          </CardTitle>
          <CardDescription>Receive real-time notifications for payment events.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Webhook URL</label>
            <Input placeholder="https://yoursite.com/api/bch-webhook" className="mt-1" />
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Events: <code>payment.received</code>, <code>payment.confirmed</code>, <code>invoice.paid</code></p>
            <p>Webhooks are signed with HMAC-SHA256 for verification.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm">Save</Button>
            <Button size="sm" variant="outline">Send Test</Button>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" /> API Keys
          </CardTitle>
          <CardDescription>Manage API keys for programmatic access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md bg-muted p-3">
            <div>
              <p className="text-sm font-medium">Production Key</p>
              <code className="text-xs text-muted-foreground">bchpay_sk_...x4f2</code>
            </div>
            <div className="flex gap-1">
              <Badge variant="success" className="text-xs">Active</Badge>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-3 w-3" /> Create API Key
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm">Delete Account</Button>
        </CardContent>
      </Card>
    </div>
  );
}
