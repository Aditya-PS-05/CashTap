"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowDownLeft,
  TrendingUp,
  Clock,
  DollarSign,
  ArrowLeftRight,
  Link2,
  FileText,
  Loader2,
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
import { useAuth } from "@/lib/auth-context";
import { usePrice } from "@/lib/price-context";
import { apiFetch } from "@/lib/api";

interface StatsData {
  stats: {
    confirmed: { count: number; total_satoshis: string };
    pending: { count: number; total_satoshis: string };
    failed_count: number;
  };
  recent_transactions: Array<{
    id: string;
    tx_hash: string;
    amount_satoshis: string;
    sender_address: string;
    status: string;
    created_at: string;
  }>;
}

interface DailyData {
  date: string;
  total_satoshis: string;
  tx_count: number;
  total_usd: number;
}

interface AnalyticsData {
  daily: DailyData[];
  summary: {
    avg_payment_satoshis: string;
    avg_payment_usd: number;
  };
}

const statusVariant = {
  CONFIRMED: "success" as const,
  PENDING: "warning" as const,
  FAILED: "destructive" as const,
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { formatUsd } = usePrice();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, analyticsRes] = await Promise.all([
          apiFetch<StatsData>("/api/transactions/stats"),
          apiFetch<AnalyticsData>("/api/transactions/analytics?range=7d"),
        ]);
        setStats(statsRes);
        setAnalytics(analyticsRes);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const revenueData = analytics?.daily.map((d) => ({
    day: new Date(d.date).toLocaleDateString("en-US", { weekday: "short" }),
    bch: Number(d.total_satoshis) / 1e8,
    usd: d.total_usd,
  })) ?? [];

  const totalRevenueSats = stats?.stats.confirmed.total_satoshis ?? "0";
  const totalRevenueUsd = formatUsd(totalRevenueSats);
  const confirmedCount = stats?.stats.confirmed.count ?? 0;
  const pendingCount = stats?.stats.pending.count ?? 0;
  const avgPaymentSats = analytics?.summary.avg_payment_satoshis ?? "0";

  return (
    <div className="space-y-6">
      <DashboardTour />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.business_name || user?.email || "Merchant"}
          </p>
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatBch(BigInt(totalRevenueSats))}
                </div>
                <p className="text-xs text-muted-foreground">{totalRevenueUsd} USD</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{confirmedCount}</div>
                <p className="text-xs text-muted-foreground">Confirmed</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingCount}</div>
                <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Avg Payment</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatBch(BigInt(avgPaymentSats))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatUsd(avgPaymentSats)} USD
                </p>
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
                {revenueData.length > 0 ? (
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
                        formatter={(value) => [`${Number(value).toFixed(8)} BCH`, "Revenue"]}
                      />
                      <Bar dataKey="bch" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-20">No revenue data yet</p>
                )}
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
                {stats?.recent_transactions && stats.recent_transactions.length > 0 ? (
                  stats.recent_transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                        <ArrowDownLeft className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {formatBch(BigInt(tx.amount_satoshis))}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {shortenAddress(tx.sender_address)}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={statusVariant[tx.status as keyof typeof statusVariant] || "secondary"}
                          className="text-[10px]"
                        >
                          {tx.status === "CONFIRMED" ? "Confirmed" : tx.status === "PENDING" ? "Pending" : tx.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(tx.created_at).toLocaleTimeString("en-US", {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No transactions yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
