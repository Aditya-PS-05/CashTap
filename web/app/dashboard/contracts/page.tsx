"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileCode2,
  Copy,
  ExternalLink,
  CheckCircle,
  Loader2,
  Split,
  ShieldCheck,
  PiggyBank,
  Plus,
  Trash2,
  Eye,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { usePrice } from "@/lib/price-context";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";

interface ContractInstance {
  id: string;
  type: "ESCROW" | "SPLIT_PAYMENT" | "SAVINGS_VAULT";
  address: string;
  token_address: string | null;
  constructor_args: Record<string, unknown>;
  status: string;
  created_at: string;
}

interface Recipient {
  pkh: string;
  percent: number;
  label: string;
}

interface PreviewShare {
  pkh: string;
  label: string;
  percent: number;
  satoshis: number;
  bch: string;
  usd: string | null;
}

const typeBadgeColors: Record<string, string> = {
  ESCROW: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  SPLIT_PAYMENT: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  SAVINGS_VAULT: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
};

const statusBadgeVariants: Record<string, string> = {
  ACTIVE: "success",
  FUNDED: "default",
  RELEASED: "secondary",
  REFUNDED: "warning",
  DISPUTED: "destructive",
  COMPLETED: "secondary",
  EXPIRED: "warning",
};

const typeLabels: Record<string, string> = {
  ESCROW: "Escrow",
  SPLIT_PAYMENT: "Split Payment",
  SAVINGS_VAULT: "Savings Vault",
};

const useCaseBadges = [
  { label: "Team Payouts", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300" },
  { label: "Revenue Sharing", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
  { label: "Tips", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  { label: "Affiliate Commissions", color: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300" },
];

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { formatBch, formatUsd } = usePrice();

  // N-recipient split form
  const [recipients, setRecipients] = useState<Recipient[]>([
    { pkh: "", percent: 50, label: "" },
    { pkh: "", percent: 50, label: "" },
  ]);
  const [previewShares, setPreviewShares] = useState<PreviewShare[] | null>(null);
  const [previewTotal, setPreviewTotal] = useState("1000000");

  // Escrow form state
  const [esc_buyer, setEsc_buyer] = useState("");
  const [esc_seller, setEsc_seller] = useState("");
  const [esc_arbiter, setEsc_arbiter] = useState("");
  const [esc_timeout, setEsc_timeout] = useState("");

  // Savings Vault form state
  const [sv_owner, setSv_owner] = useState("");
  const [sv_locktime, setSv_locktime] = useState("");

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

  const fetchContracts = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/contracts`, { headers });
      if (res.ok) {
        const data = await res.json();
        setContracts(data.contracts || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const createContract = async (endpoint: string, body: Record<string, unknown>) => {
    setCreating(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/contracts/${endpoint}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success("Contract created!");
        fetchContracts();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to create contract");
      }
    } catch {
      toast.error("Failed to create contract");
    } finally {
      setCreating(false);
    }
  };

  const contractAction = async (id: string, action: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/contracts/${id}/${action}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        toast.success(`Contract ${action} successful`);
        fetchContracts();
      } else {
        const err = await res.json();
        toast.error(err.error || `Failed to ${action}`);
      }
    } catch {
      toast.error(`Failed to ${action}`);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/contracts/${id}/status`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(`Contract marked as ${status.toLowerCase()}`);
        fetchContracts();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to update contract");
      }
    } catch {
      toast.error("Failed to update contract");
    }
  };

  const fetchPreview = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE}/api/contracts/split-payment/preview`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: recipients.map((r) => ({
            pkh: r.pkh || undefined,
            percent: r.percent,
            label: r.label || undefined,
          })),
          total_satoshis: Number(previewTotal),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewShares(data.shares);
      }
    } catch {
      toast.error("Failed to load preview");
    }
  };

  const addRecipient = () => {
    if (recipients.length >= 10) return;
    setRecipients([...recipients, { pkh: "", percent: 0, label: "" }]);
  };

  const removeRecipient = (index: number) => {
    if (recipients.length <= 2) return;
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const updateRecipient = (index: number, field: keyof Recipient, value: string | number) => {
    const updated = [...recipients];
    (updated[index] as any)[field] = value;
    setRecipients(updated);
    setPreviewShares(null);
  };

  const percentSum = recipients.reduce((s, r) => s + r.percent, 0);

  const copyAddress = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    toast.success("Address copied!");
  };

  const activeCount = contracts.filter((c) => ["ACTIVE", "FUNDED"].includes(c.status)).length;
  const splitCount = contracts.filter((c) => c.type === "SPLIT_PAYMENT").length;
  const escrowCount = contracts.filter((c) => c.type === "ESCROW").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Contracts</h1>
        <p className="text-muted-foreground">Deploy and manage CashScript smart contracts</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileCode2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Active Contracts</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900">
              <Split className="h-5 w-5 text-purple-600 dark:text-purple-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{splitCount}</p>
              <p className="text-sm text-muted-foreground">Split Payments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
              <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-2xl font-bold">{escrowCount}</p>
              <p className="text-sm text-muted-foreground">Escrow Contracts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Contract tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Create Contract</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="split-payment">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="split-payment">Split Payment</TabsTrigger>
              <TabsTrigger value="escrow">Escrow</TabsTrigger>
              <TabsTrigger value="savings-vault">Savings Vault</TabsTrigger>
            </TabsList>

            <TabsContent value="split-payment" className="space-y-4 pt-4">
              {/* Use case badges */}
              <div className="flex flex-wrap gap-2">
                {useCaseBadges.map((b) => (
                  <span key={b.label} className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${b.color}`}>
                    {b.label}
                  </span>
                ))}
              </div>

              {/* Dynamic recipients */}
              <div className="space-y-3">
                {recipients.map((r, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-xs font-medium">Recipient {i + 1} PKH</label>
                      <Input
                        placeholder="40-char hex public key hash"
                        value={r.pkh}
                        onChange={(e) => updateRecipient(i, "pkh", e.target.value)}
                        className="mt-1 font-mono text-xs"
                      />
                    </div>
                    <div className="w-20">
                      <label className="text-xs font-medium">%</label>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        value={r.percent}
                        onChange={(e) => updateRecipient(i, "percent", Number(e.target.value))}
                        className="mt-1"
                      />
                    </div>
                    <div className="w-32">
                      <label className="text-xs font-medium">Label</label>
                      <Input
                        placeholder="Optional"
                        value={r.label}
                        onChange={(e) => updateRecipient(i, "label", e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    {recipients.length > 2 && (
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => removeRecipient(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-3">
                {recipients.length < 10 && (
                  <Button variant="outline" size="sm" onClick={addRecipient} className="gap-1">
                    <Plus className="h-3 w-3" /> Add Recipient
                  </Button>
                )}
                <span className={`text-sm font-medium ${percentSum === 100 ? "text-green-600" : "text-red-500"}`}>
                  Total: {percentSum}%{percentSum !== 100 && " (must be 100%)"}
                </span>
              </div>

              {/* Preview section */}
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Preview Distribution</span>
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    placeholder="Total satoshis"
                    value={previewTotal}
                    onChange={(e) => setPreviewTotal(e.target.value)}
                    className="w-40"
                  />
                  <Button variant="outline" size="sm" onClick={fetchPreview} disabled={percentSum !== 100}>
                    Calculate
                  </Button>
                </div>
                {previewShares && (
                  <div className="space-y-1">
                    {previewShares.map((s, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {s.label || `Recipient ${i + 1}`} ({s.percent}%)
                        </span>
                        <span className="font-mono">
                          {s.bch} BCH {s.usd && <span className="text-muted-foreground">(${s.usd})</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                onClick={() =>
                  createContract("split-payment-multi", { recipients })
                }
                disabled={creating || percentSum !== 100}
                className="gap-2"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                <Split className="h-4 w-4" /> Create Split Payment
              </Button>
            </TabsContent>

            <TabsContent value="escrow" className="space-y-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Buyer PKH (hex)</label>
                  <Input
                    placeholder="40-char hex"
                    value={esc_buyer}
                    onChange={(e) => setEsc_buyer(e.target.value)}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Seller PKH (hex)</label>
                  <Input
                    placeholder="40-char hex"
                    value={esc_seller}
                    onChange={(e) => setEsc_seller(e.target.value)}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Arbiter PKH (hex)</label>
                  <Input
                    placeholder="40-char hex"
                    value={esc_arbiter}
                    onChange={(e) => setEsc_arbiter(e.target.value)}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Timeout (block height)</label>
                  <Input
                    type="number"
                    placeholder="1000000"
                    value={esc_timeout}
                    onChange={(e) => setEsc_timeout(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <Button
                onClick={() =>
                  createContract("escrow", {
                    buyer_pkh: esc_buyer,
                    seller_pkh: esc_seller,
                    arbiter_pkh: esc_arbiter,
                    timeout: Number(esc_timeout),
                  })
                }
                disabled={creating}
                className="gap-2"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                <ShieldCheck className="h-4 w-4" /> Create Escrow
              </Button>
            </TabsContent>

            <TabsContent value="savings-vault" className="space-y-4 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Owner PKH (hex)</label>
                  <Input
                    placeholder="40-char hex"
                    value={sv_owner}
                    onChange={(e) => setSv_owner(e.target.value)}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Locktime (block height)</label>
                  <Input
                    type="number"
                    placeholder="9999999"
                    value={sv_locktime}
                    onChange={(e) => setSv_locktime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <Button
                onClick={() =>
                  createContract("savings-vault", {
                    owner_pkh: sv_owner,
                    locktime: Number(sv_locktime),
                  })
                }
                disabled={creating}
                className="gap-2"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                <PiggyBank className="h-4 w-4" /> Create Vault
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Active Contracts table */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Instances</CardTitle>
        </CardHeader>
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
                    <th className="p-4 font-medium">Type</th>
                    <th className="p-4 font-medium">Address</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Details</th>
                    <th className="p-4 font-medium">Created</th>
                    <th className="p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No contracts deployed yet. Create your first one above!
                      </td>
                    </tr>
                  ) : (
                    contracts.map((contract) => {
                      const args = contract.constructor_args || {};
                      const isEscrow = contract.type === "ESCROW";
                      const canRelease = isEscrow && ["ACTIVE", "FUNDED"].includes(contract.status);
                      const canRefund = isEscrow && ["ACTIVE", "FUNDED"].includes(contract.status);

                      return (
                        <tr key={contract.id} className="border-b last:border-0 hover:bg-muted/50">
                          <td className="p-4">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${typeBadgeColors[contract.type]}`}>
                              {typeLabels[contract.type]}
                            </span>
                          </td>
                          <td className="p-4">
                            <p className="font-mono text-xs">
                              {contract.address.slice(0, 20)}...{contract.address.slice(-8)}
                            </p>
                          </td>
                          <td className="p-4">
                            <Badge
                              variant={
                                (statusBadgeVariants[contract.status] || "secondary") as any
                              }
                              className="text-xs"
                            >
                              {contract.status}
                            </Badge>
                          </td>
                          <td className="p-4">
                            {isEscrow && (
                              <div className="text-xs text-muted-foreground space-y-0.5">
                                <p>Buyer: {String(args.buyer_pkh || "").slice(0, 8)}...</p>
                                <p>Seller: {String(args.seller_pkh || "").slice(0, 8)}...</p>
                                <p>Arbiter: {String(args.arbiter_pkh || "").slice(0, 8)}...</p>
                                {args.timeout != null && <p>Timeout: {String(args.timeout)}</p>}
                              </div>
                            )}
                            {contract.type === "SPLIT_PAYMENT" && (
                              <div className="text-xs text-muted-foreground">
                                {Array.isArray(args.recipients)
                                  ? `${(args.recipients as any[]).length} recipients`
                                  : "2 recipients"}
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-sm text-muted-foreground">
                            {new Date(contract.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </td>
                          <td className="p-4">
                            <div className="flex gap-1 flex-wrap">
                              {canRelease && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50"
                                  onClick={() => contractAction(contract.id, "release")}
                                >
                                  <ArrowRight className="h-3 w-3 mr-1" /> Release
                                </Button>
                              )}
                              {canRefund && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs text-orange-600 border-orange-300 hover:bg-orange-50"
                                  onClick={() => contractAction(contract.id, "refund")}
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" /> Refund
                                </Button>
                              )}
                              {contract.status === "ACTIVE" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  title="Mark as completed"
                                  onClick={() => updateStatus(contract.id, "COMPLETED")}
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                title="Copy address"
                                onClick={(e) => copyAddress(contract.address, e)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="View on explorer">
                                <a
                                  href={`https://chipnet.chaingraph.cash/address/${contract.address}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
