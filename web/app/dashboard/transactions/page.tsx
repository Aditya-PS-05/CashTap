"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowDownLeft, ExternalLink, Search, Download, FileJson } from "lucide-react";
import { formatBch, shortenAddress, satoshisToBch } from "@/lib/utils";
import { TransactionDetail } from "@/components/transaction-detail";

interface Transaction {
  id: string;
  txHash: string;
  amount: bigint;
  usd: number;
  sender: string;
  recipient: string;
  status: "confirmed" | "pending" | "failed";
  confirmations: number;
  memo: string;
  time: string;
  blockHeight: number | null;
  loyaltyTokensIssued?: number;
  receiptNftId?: string;
}

const mockTxs: Transaction[] = [
  { id: "1", txHash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd", amount: 50000000n, usd: 171.25, sender: "bitcoincash:qzm3abc123xyz789def456", recipient: "bitcoincash:qpw9merchant001", status: "confirmed", confirmations: 6, memo: "Coffee Latte", time: "2025-02-22 10:30", blockHeight: 845123, loyaltyTokensIssued: 50, receiptNftId: "nft_rcpt_a1b2c3d4e5f6_001" },
  { id: "2", txHash: "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6bcde", amount: 15000000n, usd: 51.38, sender: "bitcoincash:qpw9def456abc123ghi789", recipient: "bitcoincash:qpw9merchant001", status: "confirmed", confirmations: 4, memo: "Pastry", time: "2025-02-22 10:15", blockHeight: 845122, loyaltyTokensIssued: 15 },
  { id: "3", txHash: "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6cdef", amount: 120000000n, usd: 411.00, sender: "bitcoincash:qrk7ghi789def456abc123", recipient: "bitcoincash:qpw9merchant001", status: "pending", confirmations: 0, memo: "Catering order", time: "2025-02-22 09:48", blockHeight: null },
  { id: "4", txHash: "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6defg", amount: 8500000n, usd: 29.12, sender: "bitcoincash:qnm2jkl012ghi789def456", recipient: "bitcoincash:qpw9merchant001", status: "confirmed", confirmations: 12, memo: "Espresso", time: "2025-02-22 09:05", blockHeight: 845118, loyaltyTokensIssued: 8, receiptNftId: "nft_rcpt_d4e5f6a1b2c3_004" },
  { id: "5", txHash: "e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6efgh", amount: 200000000n, usd: 685.00, sender: "bitcoincash:qbc5mno345jkl012ghi789", recipient: "bitcoincash:qpw9merchant001", status: "confirmed", confirmations: 24, memo: "Monthly subscription", time: "2025-02-22 07:20", blockHeight: 845110, loyaltyTokensIssued: 200, receiptNftId: "nft_rcpt_e5f6a1b2c3d4_005" },
  { id: "6", txHash: "f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6fghi", amount: 5000000n, usd: 17.13, sender: "bitcoincash:qxy8pqr678stu901vwx234", recipient: "bitcoincash:qpw9merchant001", status: "confirmed", confirmations: 30, memo: "Tip", time: "2025-02-21 18:45", blockHeight: 845098, loyaltyTokensIssued: 5 },
];

const statusConfig = {
  confirmed: { variant: "success" as const, label: "Confirmed" },
  pending: { variant: "warning" as const, label: "Pending" },
  failed: { variant: "destructive" as const, label: "Failed" },
};

function serializeTx(tx: Transaction) {
  return {
    id: tx.id,
    txHash: tx.txHash,
    amountBch: satoshisToBch(tx.amount),
    amountUsd: tx.usd,
    sender: tx.sender,
    recipient: tx.recipient,
    status: tx.status,
    confirmations: tx.confirmations,
    memo: tx.memo,
    time: tx.time,
    blockHeight: tx.blockHeight,
    loyaltyTokensIssued: tx.loyaltyTokensIssued ?? null,
    receiptNftId: tx.receiptNftId ?? null,
  };
}

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
  const [filter, setFilter] = useState<"all" | "confirmed" | "pending">("all");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filtered = mockTxs.filter((tx) => {
    if (filter !== "all" && tx.status !== filter) return false;
    if (search && !tx.txHash.includes(search) && !tx.memo.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const exportCsv = () => {
    const headers = ["ID", "TX Hash", "Amount (BCH)", "Amount (USD)", "Sender", "Recipient", "Status", "Confirmations", "Memo", "Time", "Block Height", "Loyalty Tokens", "Receipt NFT"];
    const rows = filtered.map((tx) => [
      tx.id,
      tx.txHash,
      satoshisToBch(tx.amount),
      tx.usd.toFixed(2),
      tx.sender,
      tx.recipient,
      tx.status,
      tx.confirmations.toString(),
      tx.memo,
      tx.time,
      tx.blockHeight?.toString() ?? "",
      tx.loyaltyTokensIssued?.toString() ?? "",
      tx.receiptNftId ?? "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    downloadFile(csv, "transactions.csv", "text/csv");
  };

  const exportJson = () => {
    const data = filtered.map(serializeTx);
    downloadFile(JSON.stringify(data, null, 2), "transactions.json", "application/json");
  };

  const openDetail = (tx: Transaction) => {
    setSelectedTx(tx);
    setDetailOpen(true);
  };

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

      <div className="flex gap-3 items-center">
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
          {(["all", "confirmed", "pending"] as const).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>
      </div>

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
                {filtered.map((tx) => (
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
                          <p className="text-sm font-medium">{tx.memo || "Payment"}</p>
                          <p className="text-xs text-muted-foreground font-mono">{tx.txHash.slice(0, 12)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-sm font-semibold">{formatBch(tx.amount)}</p>
                      <p className="text-xs text-muted-foreground">${tx.usd.toFixed(2)}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-xs font-mono text-muted-foreground">{shortenAddress(tx.sender)}</p>
                    </td>
                    <td className="p-4">
                      <Badge variant={statusConfig[tx.status].variant} className="text-xs">
                        {statusConfig[tx.status].label}
                      </Badge>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{tx.confirmations}</td>
                    <td className="p-4 text-sm text-muted-foreground">{tx.time}</td>
                    <td className="p-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`https://blockchair.com/bitcoin-cash/transaction/${tx.txHash}`, "_blank");
                        }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <TransactionDetail tx={selectedTx} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
