"use client";

import { Bell, Wallet, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shortenAddress } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { usePrice } from "@/lib/price-context";
import { useRouter } from "next/navigation";

export function Header() {
  const { address, merchant, logout } = useAuth();
  const { bchUsd, loading: priceLoading } = usePrice();
  const router = useRouter();
  const bchPrice = priceLoading ? 0 : bchUsd;

  const handleLogout = async () => {
    await logout();
    router.push("/auth");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        {merchant?.name && (
          <span className="text-sm font-medium">{merchant.name}</span>
        )}
        <Badge variant="outline" className="font-mono text-xs">
          {priceLoading ? "Loading..." : `1 BCH = $${bchPrice.toFixed(2)}`}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />
        </Button>

        <Button variant="outline" size="sm" className="gap-2 font-mono text-xs">
          <Wallet className="h-3.5 w-3.5" />
          {address ? shortenAddress(address) : "Not connected"}
        </Button>

        <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
