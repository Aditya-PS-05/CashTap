"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const dailyRevenue = [
  { date: "Feb 16", bch: 0.3, usd: 103 },
  { date: "Feb 17", bch: 1.1, usd: 377 },
  { date: "Feb 18", bch: 0.7, usd: 240 },
  { date: "Feb 19", bch: 1.8, usd: 616 },
  { date: "Feb 20", bch: 2.3, usd: 787 },
  { date: "Feb 21", bch: 1.5, usd: 514 },
  { date: "Feb 22", bch: 0.9, usd: 308 },
];

const paymentVolume = [
  { date: "Feb 16", count: 3 },
  { date: "Feb 17", count: 8 },
  { date: "Feb 18", count: 5 },
  { date: "Feb 19", count: 12 },
  { date: "Feb 20", count: 15 },
  { date: "Feb 21", count: 9 },
  { date: "Feb 22", count: 6 },
];

const paymentMethods = [
  { name: "POS", value: 45, color: "#0AC18E" },
  { name: "Payment Link", value: 30, color: "#34d399" },
  { name: "Invoice", value: 15, color: "#6ee7b7" },
  { name: "Direct", value: 10, color: "#a7f3d0" },
];

const topLinks = [
  { name: "Coffee Latte", revenue: "0.876 BCH", count: 60 },
  { name: "Tip Jar", revenue: "0.543 BCH", count: 42 },
  { name: "Pastry Box", revenue: "0.321 BCH", count: 28 },
  { name: "Catering", revenue: "0.292 BCH", count: 5 },
];

const chartTooltipStyle = {
  backgroundColor: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: "8px",
  fontSize: "12px",
};

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Revenue and payment insights</p>
        </div>
        <div className="flex gap-2">
          {["7D", "30D", "90D"].map((range) => (
            <Button key={range} variant={range === "7D" ? "default" : "outline"} size="sm">{range}</Button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue (BCH)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${v} BCH`]} />
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
              <LineChart data={paymentVolume}>
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
            <div className="flex items-center gap-8">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={paymentMethods} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {paymentMethods.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${v}%`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {paymentMethods.map((m) => (
                  <div key={m.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: m.color }} />
                    <span className="text-sm">{m.name}</span>
                    <span className="text-sm font-medium ml-auto">{m.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Payment Links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Payment Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topLinks.map((link, i) => (
                <div key={link.name} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{link.name}</p>
                    <p className="text-xs text-muted-foreground">{link.count} payments</p>
                  </div>
                  <span className="text-sm font-semibold">{link.revenue}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
