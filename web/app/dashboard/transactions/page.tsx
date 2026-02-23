"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowDownLeft, ExternalLink, Search, Download, FileJson, Loader2 } from "lucide-react";
import { formatBch, shortenAddress, satoshisToBch } from "@/lib/utils";
import { TransactionDetail } from "@/components/transaction-detail";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface Transaction {
  id: string;
  tx_hash: string;
  amount_satoshis: string;
  sender_address: string;
  recipient_address: string;
  status: "CONFIRMED" | "PENDING" | "FAILED";
  confirmations: number;
  usd_rate_at_time: number | null;
  created_at: string;
  payment_link?: { id: string; slug: string; memo: string | null } | null;
  invoice?: { id: string; customer_email: string | null } | null;
}

interface TransactionListResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

const statusConfig = {
  CONFIRMED: { variant: "success" as const, label: "Confirmed" },
  PENDING: { variant: "warning" as const, label: "Pending" },
  FAILED: { variant: "destructive" as const, label: "Failed" },
};

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function TransactionsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "CONFIRMED" | "PENDING">("all");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Date range filter for exports
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filter !== "all") params.set("status", filter);
      const result = await apiFetch<TransactionListResponse>(
        `/api/transactions?${params.toString()}`
      );
      setTransactions(result.transactions);
      setTotalPages(result.pagination.total_pages);
    } catch (err) {
      toast.error("Failed to load transactions");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const filtered = transactions.filter((tx) => {
    if (search && !tx.tx_hash.includes(search) && !(tx.payment_link?.memo || "").toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const getExportData = () => {
    let data = filtered;
    if (exportFrom) {
      const from = new Date(exportFrom);
      data = data.filter((tx) => new Date(tx.created_at) >= from);
    }
    if (exportTo) {
      const to = new Date(exportTo);
      to.setHours(23, 59, 59, 999);
      data = data.filter((tx) => new Date(tx.created_at) <= to);
    }
    return data;
  };

  const exportCsv = () => {
    const data = getExportData();
    const headers = ["ID", "TX Hash", "Amount (BCH)", "Amount (USD)", "Sender", "Recipient", "Status", "Confirmations", "Memo", "Date"];
    const rows = data.map((tx) => {
      const bch = satoshisToBch(BigInt(tx.amount_satoshis));
      const usd = tx.usd_rate_at_time
        ? (Number(tx.amount_satoshis) * tx.usd_rate_at_time / 1e8).toFixed(2)
        : "";
      return [
        tx.id,
        tx.tx_hash,
        bch,
        usd,
        tx.sender_address,
        tx.recipient_address,
        tx.status,
        tx.confirmations.toString(),
        tx.payment_link?.memo ?? "",
        tx.created_at,
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    downloadFile(csv, "transactions.csv", "text/csv");
  };

  const exportJson = () => {
    const data = getExportData().map((tx) => ({
      id: tx.id,
      txHash: tx.tx_hash,
      amountBch: satoshisToBch(BigInt(tx.amount_satoshis)),
      amountUsd: tx.usd_rate_at_time
        ? Number((Number(tx.amount_satoshis) * tx.usd_rate_at_time / 1e8).toFixed(2))
        : null,
      sender: tx.sender_address,
      recipient: tx.recipient_address,
      status: tx.status,
      confirmations: tx.confirmations,
      memo: tx.payment_link?.memo ?? null,
      date: tx.created_at,
    }));
    downloadFile(JSON.stringify(data, null, 2), "transactions.json", "application/json");
  };

  const openDetail = (tx: Transaction) => {
    setSelectedTx(tx);
    setDetailOpen(true);
  };

  const txForDetail = selectedTx
    ? {
        id: selectedTx.id,
        txHash: selectedTx.tx_hash,
        amount: BigInt(selectedTx.amount_satoshis),
        usd: selectedTx.usd_rate_at_time
          ? Number(selectedTx.amount_satoshis) * selectedTx.usd_rate_at_time / 1e8
          : 0,
        sender: selectedTx.sender_address,
        recipient: selectedTx.recipient_address,
        status: selectedTx.status.toLowerCase() as "confirmed" | "pending" | "failed",
        confirmations: selectedTx.confirmations,
        memo: selectedTx.payment_link?.memo ?? "",
        time: new Date(selectedTx.created_at).toLocaleString(),
        blockHeight: null,
      }
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">View and filter all payments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportJson}>
            <FileJson className="h-4 w-4" /> Export JSON
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by tx hash or memo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "CONFIRMED", "PENDING"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => { setFilter(f); setPage(1); }}
              className="capitalize"
            >
              {f === "all" ? "All" : f === "CONFIRMED" ? "Confirmed" : "Pending"}
            </Button>
          ))}
        </div>
        <div className="flex gap-2 items-center text-sm text-muted-foreground">
          <span>Export range:</span>
          <Input
            type="date"
            value={exportFrom}
            onChange={(e) => setExportFrom(e.target.value)}
            className="w-36 h-8"
          />
          <span>to</span>
          <Input
            type="date"
            value={exportTo}
            onChange={(e) => setExportTo(e.target.value)}
            className="w-36 h-8"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="p-4 font-medium">Transaction</th>
                    <th className="p-4 font-medium">Amount</th>
                    <th className="p-4 font-medium">From</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Confirmations</th>
                    <th className="p-4 font-medium">Date</th>
                    <th className="p-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length > 0 ? filtered.map((tx) => {
                    const config = statusConfig[tx.status] || statusConfig.PENDING;
                    const usdAmount = tx.usd_rate_at_time
                      ? (Number(tx.amount_satoshis) * tx.usd_rate_at_time / 1e8).toFixed(2)
                      : null;

                    return (
                      <tr
                        key={tx.id}
                        className="border-b last:border-0 hover:bg-muted/50 cursor-pointer"
                        onClick={() => openDetail(tx)}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                              <ArrowDownLeft className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{tx.payment_link?.memo || "Payment"}</p>
                              <p className="text-xs text-muted-foreground font-mono">{tx.tx_hash.slice(0, 12)}...</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-sm font-semibold">{formatBch(BigInt(tx.amount_satoshis))}</p>
                          {usdAmount && <p className="text-xs text-muted-foreground">${usdAmount}</p>}
                        </td>
                        <td className="p-4">
                          <p className="text-xs font-mono text-muted-foreground">{shortenAddress(tx.sender_address)}</p>
                        </td>
                        <td className="p-4">
                          <Badge variant={config.variant} className="text-xs">
                            {config.label}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-muted-foreground">{tx.confirmations}</td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.open(`https://blockchair.com/bitcoin-cash/transaction/${tx.tx_hash}`, "_blank");
                            }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                        No transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
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

      <TransactionDetail tx={txForDetail} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
