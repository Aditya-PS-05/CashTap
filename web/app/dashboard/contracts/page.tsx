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
} from "lucide-react";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://bch-pay-api-production.up.railway.app";

interface ContractInstance {
  id: string;
  type: "ESCROW" | "SPLIT_PAYMENT" | "SAVINGS_VAULT";
  address: string;
  token_address: string | null;
  constructor_args: Record<string, unknown>;
  status: "ACTIVE" | "COMPLETED" | "EXPIRED";
  created_at: string;
}

const typeBadgeColors: Record<string, string> = {
  ESCROW: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  SPLIT_PAYMENT: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  SAVINGS_VAULT: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
};

const typeLabels: Record<string, string> = {
  ESCROW: "Escrow",
  SPLIT_PAYMENT: "Split Payment",
  SAVINGS_VAULT: "Savings Vault",
};

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Split Payment form state
  const [sp_r1, setSp_r1] = useState("");
  const [sp_r2, setSp_r2] = useState("");
  const [sp_p1, setSp_p1] = useState("50");
  const [sp_p2, setSp_p2] = useState("50");

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

  const updateStatus = async (id: string, status: "COMPLETED" | "EXPIRED") => {
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

  const copyAddress = (address: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(address);
    toast.success("Address copied!");
  };

  const activeCount = contracts.filter((c) => c.status === "ACTIVE").length;
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Recipient 1 PKH (hex)</label>
                  <Input
                    placeholder="40-char hex public key hash"
                    value={sp_r1}
                    onChange={(e) => setSp_r1(e.target.value)}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Percentage</label>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={sp_p1}
                    onChange={(e) => {
                      setSp_p1(e.target.value);
                      setSp_p2(String(100 - Number(e.target.value)));
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Recipient 2 PKH (hex)</label>
                  <Input
                    placeholder="40-char hex public key hash"
                    value={sp_r2}
                    onChange={(e) => setSp_r2(e.target.value)}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Percentage</label>
                  <Input type="number" min={1} max={99} value={sp_p2} readOnly className="mt-1 bg-muted" />
                </div>
              </div>
              <Button
                onClick={() =>
                  createContract("split-payment", {
                    recipient1_pkh: sp_r1,
                    recipient2_pkh: sp_r2,
                    split1_percent: Number(sp_p1),
                    split2_percent: Number(sp_p2),
                  })
                }
                disabled={creating}
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
                    <th className="p-4 font-medium">Created</th>
                    <th className="p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contracts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground">
                        No contracts deployed yet. Create your first one above!
                      </td>
                    </tr>
                  ) : (
                    contracts.map((contract) => (
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
                              contract.status === "ACTIVE"
                                ? "success"
                                : contract.status === "COMPLETED"
                                  ? "secondary"
                                  : "warning"
                            }
                            className="text-xs"
                          >
                            {contract.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {new Date(contract.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-1">
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
                    ))
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
