"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Clock,
  DollarSign,
  ArrowLeftRight,
  Link2,
  FileText,
  Plus,
} from "lucide-react";
import { formatBch, shortenAddress } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import Link from "next/link";
import { DashboardTour } from "@/components/dashboard-tour";

const revenueData = [
  { day: "Mon", bch: 0.45, usd: 154 },
  { day: "Tue", bch: 1.2, usd: 411 },
  { day: "Wed", bch: 0.8, usd: 274 },
  { day: "Thu", bch: 2.1, usd: 719 },
  { day: "Fri", bch: 1.5, usd: 514 },
  { day: "Sat", bch: 0.3, usd: 103 },
  { day: "Sun", bch: 0.65, usd: 223 },
];

const recentTransactions = [
  { id: "1", txHash: "abc123def456", amount: 50000000n, usd: 171.25, sender: "bitcoincash:qzm3abc123xyz", status: "confirmed" as const, time: "2 min ago" },
  { id: "2", txHash: "def456ghi789", amount: 15000000n, usd: 51.38, sender: "bitcoincash:qpw9def456abc", status: "confirmed" as const, time: "15 min ago" },
  { id: "3", txHash: "ghi789jkl012", amount: 120000000n, usd: 411.00, sender: "bitcoincash:qrk7ghi789def", status: "pending" as const, time: "32 min ago" },
  { id: "4", txHash: "jkl012mno345", amount: 8500000n, usd: 29.12, sender: "bitcoincash:qnm2jkl012ghi", status: "confirmed" as const, time: "1 hr ago" },
  { id: "5", txHash: "mno345pqr678", amount: 200000000n, usd: 685.00, sender: "bitcoincash:qbc5mno345jkl", status: "confirmed" as const, time: "3 hr ago" },
];

const statusVariant = {
  confirmed: "success" as const,
  pending: "warning" as const,
  failed: "destructive" as const,
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <DashboardTour />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, Coffee Shop</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/payment-links">
            <Button variant="outline" size="sm" className="gap-2">
              <Link2 className="h-4 w-4" /> Payment Link
            </Button>
          </Link>
          <Link href="/dashboard/invoices">
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="h-4 w-4" /> Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">7.00 BCH</div>
            <p className="text-xs text-muted-foreground">$2,398.00 USD</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">+12% from last week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Payment</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0.29 BCH</div>
            <p className="text-xs text-muted-foreground">$99.92 USD</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        {/* Revenue Chart */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Revenue (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" tick={{ fill: "var(--color-muted-foreground)" }} />
                <YAxis className="text-xs" tick={{ fill: "var(--color-muted-foreground)" }} tickFormatter={(v) => `${v} BCH`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value) => [`${value} BCH`, "Revenue"]}
                />
                <Bar dataKey="bch" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Transactions</CardTitle>
            <Link href="/dashboard/transactions">
              <Button variant="ghost" size="sm" className="text-xs">View All</Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <ArrowDownLeft className="h-4 w-4 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{formatBch(tx.amount)}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {shortenAddress(tx.sender)}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={statusVariant[tx.status]} className="text-[10px]">
                    {tx.status === "confirmed" ? "Confirmed" : "Pending"}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">{tx.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
