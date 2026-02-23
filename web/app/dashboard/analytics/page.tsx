"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users } from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { usePrice } from "@/lib/price-context";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface DailyData {
  date: string;
  total_satoshis: string;
  tx_count: number;
  total_usd: number;
}

interface AnalyticsResponse {
  daily: DailyData[];
  summary: {
    total_revenue_satoshis: string;
    total_revenue_usd: number;
    total_transactions: number;
    avg_payment_satoshis: string;
    avg_payment_usd: number;
  };
  top_payment_links: Array<{
    id: string;
    slug: string | null;
    memo: string | null;
    revenue_satoshis: string;
    tx_count: number;
  }>;
  payment_methods: {
    payment_link: number;
    invoice: number;
    direct: number;
  };
  customers: {
    unique_count: number;
    repeat_count: number;
  };
}

type Range = "7d" | "30d" | "90d";

const RANGE_LABELS: Record<Range, string> = { "7d": "7D", "30d": "30D", "90d": "90D" };

const PIE_COLORS = ["#0AC18E", "#34d399", "#6ee7b7", "#a7f3d0"];

const chartTooltipStyle = {
  backgroundColor: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "12px",
};

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("7d");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { formatBch, formatUsd } = usePrice();

  const fetchAnalytics = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      const result = await apiFetch<AnalyticsResponse>(
        `/api/transactions/analytics?range=${r}`
      );
      setData(result);
    } catch (err) {
      toast.error("Failed to load analytics");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(range);
  }, [range, fetchAnalytics]);

  const dailyChartData = data?.daily.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    bch: Number(d.total_satoshis) / 1e8,
    usd: d.total_usd,
    count: d.tx_count,
  })) ?? [];

  const pieData = data
    ? [
        { name: "Payment Link", value: data.payment_methods.payment_link, color: PIE_COLORS[0] },
        { name: "Invoice", value: data.payment_methods.invoice, color: PIE_COLORS[1] },
        { name: "Direct", value: data.payment_methods.direct, color: PIE_COLORS[2] },
      ].filter((d) => d.value > 0)
    : [];

  const totalMethods = pieData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Revenue and payment insights</p>
        </div>
        <div className="flex gap-2">
          {(["7d", "30d", "90d"] as const).map((r) => (
            <Button
              key={r}
              variant={range === r ? "default" : "outline"}
              size="sm"
              onClick={() => setRange(r)}
            >
              {RANGE_LABELS[r]}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatBch(data.summary.total_revenue_satoshis)}
                </div>
                <p className="text-xs text-muted-foreground">
                  ${data.summary.total_revenue_usd.toFixed(2)} USD
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.summary.total_transactions}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Avg Payment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatBch(data.summary.avg_payment_satoshis)}
                </div>
                <p className="text-xs text-muted-foreground">
                  ${data.summary.avg_payment_usd.toFixed(2)} USD
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" /> Customers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.customers.unique_count}</div>
                <p className="text-xs text-muted-foreground">
                  {data.customers.repeat_count} repeat
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue (BCH)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${Number(v).toFixed(8)} BCH`]} />
                    <Bar dataKey="bch" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Payment Volume */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Line type="monotone" dataKey="count" stroke="var(--color-primary)" strokeWidth={2} dot={{ fill: "var(--color-primary)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <div className="flex items-center gap-8">
                    <ResponsiveContainer width={180} height={180}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                          {pieData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${totalMethods > 0 ? Math.round((Number(v) / totalMethods) * 100) : 0}%`]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-3">
                      {pieData.map((m) => (
                        <div key={m.name} className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: m.color }} />
                          <span className="text-sm">{m.name}</span>
                          <span className="text-sm font-medium ml-auto">
                            {totalMethods > 0 ? Math.round((m.value / totalMethods) * 100) : 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">No payment data</p>
                )}
              </CardContent>
            </Card>

            {/* Top Payment Links */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Payment Links</CardTitle>
              </CardHeader>
              <CardContent>
                {data.top_payment_links.length > 0 ? (
                  <div className="space-y-4">
                    {data.top_payment_links.map((link, i) => (
                      <div key={link.id} className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{link.memo || link.slug || "Payment Link"}</p>
                          <p className="text-xs text-muted-foreground">{link.tx_count} payments</p>
                        </div>
                        <span className="text-sm font-semibold">
                          {formatBch(link.revenue_satoshis)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">No payment links yet</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-center py-20">Failed to load analytics data</p>
      )}
    </div>
  );
}
