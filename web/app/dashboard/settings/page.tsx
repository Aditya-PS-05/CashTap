"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Copy, Key, Plus, Trash2, Webhook, DollarSign, Loader2, Store, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { usePrice } from "@/lib/price-context";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { decryptMnemonic } from "@/lib/wallet-crypto";
import { deriveMerchantAddress } from "@/lib/bch-wallet";

interface MerchantProfile {
  id: string;
  bch_address: string | null;
  merchant_address: string | null;
  business_name: string | null;
  email: string;
  logo_url: string | null;
  webhook_url: string | null;
  display_currency: string | null;
  role: string;
  encrypted_wallet: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const { role, user, upgradeToMerchant, address } = useAuth();
  const { displayCurrency, setDisplayCurrency } = usePrice();
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [receiptsEnabled, setReceiptsEnabled] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);

  // Merchant upgrade state
  const [upgrading, setUpgrading] = useState(false);
  const [merchantBusinessName, setMerchantBusinessName] = useState("");

  // Wallet backup state
  const [showBackup, setShowBackup] = useState(false);
  const [backupPassword, setBackupPassword] = useState("");
  const [revealedSeed, setRevealedSeed] = useState("");
  const [decrypting, setDecrypting] = useState(false);

  // Profile form state
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [bchAddress, setBchAddress] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [profileRole, setProfileRole] = useState("");
  const [encryptedWallet, setEncryptedWallet] = useState<string | null>(null);

  const isMerchant = role === "MERCHANT";
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";

  const fetchProfile = useCallback(async () => {
    try {
      const data = await apiFetch<{ merchant: MerchantProfile }>("/api/merchants/me");
      const m = data.merchant;
      setBusinessName(m.business_name || "");
      setEmail(m.email || "");
      setLogoUrl(m.logo_url || "");
      setBchAddress(m.bch_address || "");
      setWebhookUrl(m.webhook_url || "");
      setProfileRole(m.role || "");
      setEncryptedWallet(m.encrypted_wallet || null);
    } catch {
      // Profile not available
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchTokenStatus();
  }, [fetchProfile]);

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

  async function handleSaveProfile() {
    setSaving(true);
    try {
      await apiFetch("/api/merchants/me", {
        method: "PUT",
        body: JSON.stringify({
          business_name: businessName || undefined,
          email,
          logo_url: logoUrl || null,
        }),
      });
      toast.success("Profile saved!");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveWebhook() {
    setSavingWebhook(true);
    try {
      await apiFetch("/api/merchants/me", {
        method: "PUT",
        body: JSON.stringify({
          webhook_url: webhookUrl || null,
        }),
      });
      toast.success("Webhook URL saved!");
    } catch {
      toast.error("Failed to save webhook");
    } finally {
      setSavingWebhook(false);
    }
  }

  async function handleUpgradeToMerchant() {
    if (!merchantBusinessName.trim()) {
      toast.error("Please enter your business name");
      return;
    }

    setUpgrading(true);
    try {
      // Derive merchant address from mnemonic if available
      let merchantAddr: string | undefined;
      const mnemonic = sessionStorage.getItem("cashtap_mnemonic");
      if (mnemonic) {
        const merchantKeys = deriveMerchantAddress(mnemonic);
        merchantAddr = merchantKeys.address;
      }

      await upgradeToMerchant(merchantBusinessName.trim(), merchantAddr);
      toast.success("You're now a merchant!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upgrade");
    } finally {
      setUpgrading(false);
    }
  }

  async function handleRevealSeed() {
    if (!backupPassword) {
      toast.error("Please enter your password");
      return;
    }

    setDecrypting(true);
    try {
      // First check sessionStorage
      const cachedMnemonic = sessionStorage.getItem("cashtap_mnemonic");
      if (cachedMnemonic) {
        setRevealedSeed(cachedMnemonic);
        setDecrypting(false);
        return;
      }

      // Decrypt from encrypted_wallet
      if (!encryptedWallet) {
        toast.error("No encrypted wallet found. Please re-import your wallet.");
        setDecrypting(false);
        return;
      }

      const mnemonic = await decryptMnemonic(encryptedWallet, backupPassword);
      setRevealedSeed(mnemonic);
    } catch {
      toast.error("Wrong password or corrupted wallet data");
    } finally {
      setDecrypting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your profile and configuration</p>
      </div>

      {/* Become a Merchant (only for BUYER) */}
      {!isMerchant && (
        <Card id="become-merchant" className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="h-4 w-4" /> Become a Merchant
            </CardTitle>
            <CardDescription>Upgrade to accept BCH payments and manage your business.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Business Name</label>
              <Input
                value={merchantBusinessName}
                onChange={(e) => setMerchantBusinessName(e.target.value)}
                placeholder="Your business name"
                className="mt-1"
              />
            </div>
            <Button onClick={handleUpgradeToMerchant} disabled={upgrading} className="gap-2">
              {upgrading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
              {upgrading ? "Upgrading..." : "Upgrade to Merchant"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Profile (conditional on merchant) */}
      {isMerchant && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Merchant Profile</CardTitle>
            <CardDescription>Your business information displayed to customers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingProfile ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div>
                  <label className="text-sm font-medium">Business Name</label>
                  <Input
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Your business name"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="merchant@example.com"
                    className="mt-1"
                    disabled
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Logo URL</label>
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="mt-1"
                  />
                </div>
                <Button size="sm" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Back up Wallet */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Back Up Wallet
          </CardTitle>
          <CardDescription>Reveal your 12-word seed phrase to back up your wallet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {revealedSeed ? (
            <>
              <div className="rounded-md border bg-muted p-4">
                <p className="text-sm font-mono leading-relaxed break-words">{revealedSeed}</p>
              </div>
              <p className="text-xs text-destructive font-medium">
                Write these words down and store them safely. Anyone with this phrase can access your funds.
              </p>
              <Button variant="outline" size="sm" onClick={() => { setRevealedSeed(""); setBackupPassword(""); setShowBackup(false); }}>
                Hide Seed Phrase
              </Button>
            </>
          ) : showBackup ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Enter your password</label>
                <Input
                  type="password"
                  value={backupPassword}
                  onChange={(e) => setBackupPassword(e.target.value)}
                  placeholder="Your account password"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleRevealSeed} disabled={decrypting}>
                  {decrypting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  Reveal Seed Phrase
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowBackup(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowBackup(true)}>
              <EyeOff className="h-4 w-4" /> Show Seed Phrase
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Wallet */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Wallet</CardTitle>
          <CardDescription>Your connected BCH wallet address.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingProfile ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : bchAddress ? (
            <>
              <div className="flex items-center gap-2 rounded-md bg-muted p-3">
                <code className="text-xs flex-1 break-all">{bchAddress}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(bchAddress);
                    toast.success("Address copied!");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Network</span>
                <Badge variant="outline" className="text-xs">Chipnet (Testnet)</Badge>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No wallet address configured.</p>
          )}
        </CardContent>
      </Card>

      {/* Payment Settings — only for merchants */}
      {isMerchant && (
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
          </CardContent>
        </Card>
      )}

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
        </CardContent>
      </Card>

      {/* Webhooks — only for merchants */}
      {isMerchant && (
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
              <Input
                placeholder="https://yoursite.com/api/bch-webhook"
                className="mt-1"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveWebhook} disabled={savingWebhook}>
                {savingWebhook ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline">Send Test</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Keys — only for merchants */}
      {isMerchant && (
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
                <code className="text-xs text-muted-foreground">cashtap_sk_...x4f2</code>
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
      )}

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
