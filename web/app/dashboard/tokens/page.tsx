"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Coins, Receipt, TrendingUp, Users, Loader2, Check } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";

interface TokenStats {
  loyaltyTokens: {
    configured: boolean;
    symbol?: string;
    category?: string;
    totalIssued: number;
    issuanceCount: number;
  };
  receiptNFTs: {
    configured: boolean;
    category?: string;
    totalMinted: number;
  };
}

interface Analytics {
  stats: TokenStats;
  recent_issuances: any[];
  recent_receipts: any[];
  top_holders: { customer_address: string; total_tokens: string }[];
  redemption_rate: number;
}

export default function TokensPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [creating, setCreating] = useState(false);
  const [enablingReceipts, setEnablingReceipts] = useState(false);

  // Loyalty form state
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState("0");

  useEffect(() => {
    fetchAnalytics();
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

  async function fetchAnalytics() {
    const token = await getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/cashtokens/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics);
      }
    } catch {
      // Analytics not available
    } finally {
      setLoading(false);
    }
  }

  async function createLoyaltyToken() {
    if (!tokenName || !tokenSymbol) {
      toast.error("Name and symbol are required");
      return;
    }

    const token = await getAuthToken();
    if (!token) return;

    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/cashtokens/loyalty/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tokenName,
          symbol: tokenSymbol,
          decimals: parseInt(tokenDecimals) || 0,
        }),
      });

      if (res.status === 409) {
        toast.error("Loyalty token already configured");
      } else if (res.ok) {
        toast.success("Loyalty token created!");
        fetchAnalytics();
      } else {
        toast.error("Failed to create loyalty token");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setCreating(false);
    }
  }

  async function enableReceipts() {
    const token = await getAuthToken();
    if (!token) return;

    setEnablingReceipts(true);
    try {
      const res = await fetch(`${API_BASE}/api/cashtokens/receipts/enable`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 409) {
        toast.error("Receipt NFTs already enabled");
      } else if (res.ok) {
        toast.success("Receipt NFTs enabled!");
        fetchAnalytics();
      } else {
        toast.error("Failed to enable receipt NFTs");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setEnablingReceipts(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = analytics?.stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">CashTokens</h1>
        <p className="text-muted-foreground">Manage loyalty tokens and receipt NFTs</p>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Issued</p>
                <p className="text-2xl font-bold">{stats?.loyaltyTokens.totalIssued ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Issuance Count</p>
                <p className="text-2xl font-bold">{stats?.loyaltyTokens.issuanceCount ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <Receipt className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">NFTs Minted</p>
                <p className="text-2xl font-bold">{stats?.receiptNFTs.totalMinted ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <Users className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Redemption Rate</p>
                <p className="text-2xl font-bold">
                  {analytics ? `${(analytics.redemption_rate * 100).toFixed(1)}%` : "0%"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Loyalty Token */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Coins className="h-4 w-4" /> Loyalty Token
            </CardTitle>
            <CardDescription>Issue fungible CashTokens as loyalty rewards</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.loyaltyTokens.configured ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="success">Active</Badge>
                  <span className="text-sm font-medium">{stats.loyaltyTokens.symbol}</span>
                </div>
                <div className="rounded-md bg-muted p-3 text-xs space-y-1">
                  <p>
                    <span className="text-muted-foreground">Category:</span>{" "}
                    <code className="break-all">{stats.loyaltyTokens.category?.slice(0, 16)}...</code>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Total Issued:</span>{" "}
                    {stats.loyaltyTokens.totalIssued}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Issuances:</span>{" "}
                    {stats.loyaltyTokens.issuanceCount}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative mx-auto w-20 h-20 mb-2">
                  <Image src="/images/wallet.png" alt="Loyalty Tokens" fill className="object-contain opacity-60" />
                </div>
                <div>
                  <label className="text-sm font-medium">Token Name</label>
                  <Input
                    placeholder="Coffee Points"
                    className="mt-1"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Symbol</label>
                  <Input
                    placeholder="CPT"
                    className="mt-1"
                    value={tokenSymbol}
                    onChange={(e) => setTokenSymbol(e.target.value)}
                    maxLength={10}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Decimals</label>
                  <Input
                    type="number"
                    className="mt-1 w-24"
                    value={tokenDecimals}
                    onChange={(e) => setTokenDecimals(e.target.value)}
                    min={0}
                    max={18}
                  />
                </div>
                <Button onClick={createLoyaltyToken} disabled={creating} size="sm">
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Create Loyalty Token
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receipt NFTs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Receipt NFTs
            </CardTitle>
            <CardDescription>Mint on-chain payment receipts as CashToken NFTs</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.receiptNFTs.configured ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="success">Active</Badge>
                  <span className="text-sm font-medium">RCPT</span>
                </div>
                <div className="rounded-md bg-muted p-3 text-xs space-y-1">
                  <p>
                    <span className="text-muted-foreground">Category:</span>{" "}
                    <code className="break-all">{stats.receiptNFTs.category?.slice(0, 16)}...</code>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Total Minted:</span>{" "}
                    {stats.receiptNFTs.totalMinted}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Receipt NFTs are automatically minted for each payment.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative mx-auto w-20 h-20 mb-2">
                  <Image src="/images/security_shield.png" alt="Receipt NFTs" fill className="object-contain opacity-60" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Enable receipt NFTs to automatically mint an on-chain proof-of-purchase for every payment.
                </p>
                <Button onClick={enableReceipts} disabled={enablingReceipts} size="sm">
                  {enablingReceipts ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Enable Receipt NFTs
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Analytics Section */}
      {analytics && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Issuances */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Issuances</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.recent_issuances.length === 0 ? (
                <p className="text-sm text-muted-foreground">No issuances yet</p>
              ) : (
                <div className="space-y-2">
                  {analytics.recent_issuances.map((issuance: any) => (
                    <div
                      key={issuance.id}
                      className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs text-muted-foreground">
                          {issuance.customer_address?.slice(0, 20)}...
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="font-medium">
                          {Number(issuance.amount) >= 0 ? "+" : ""}
                          {issuance.amount}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(issuance.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Holders */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Token Holders</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.top_holders.length === 0 ? (
                <p className="text-sm text-muted-foreground">No holders yet</p>
              ) : (
                <div className="space-y-2">
                  {analytics.top_holders.map((holder, i) => (
                    <div
                      key={holder.customer_address}
                      className="flex items-center gap-3 rounded-md bg-muted px-3 py-2"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </span>
                      <p className="text-xs truncate flex-1">{holder.customer_address}</p>
                      <span className="text-sm font-medium shrink-0">{holder.total_tokens}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
