"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Wallet, LogOut, ArrowDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shortenAddress, formatBch } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { usePrice } from "@/lib/price-context";
import { useRouter } from "next/navigation";

interface Notification {
  id: string;
  type: string;
  data: {
    transaction_id?: string;
    tx_hash?: string;
    amount_satoshis?: string;
    status?: string;
    [key: string]: unknown;
  };
  time: Date;
  read: boolean;
}

export function Header() {
  const { address, user, logout } = useAuth();
  const { bchUsd, loading: priceLoading } = usePrice();
  const router = useRouter();
  const bchPrice = priceLoading ? 0 : bchUsd;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Connect to SSE events
  useEffect(() => {
    let es: EventSource | null = null;

    async function connect() {
      try {
        const sessionRes = await fetch("/api/auth/session", { credentials: "include" });
        if (!sessionRes.ok) return;
        const session = await sessionRes.json();
        if (!session.accessToken) return;

        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";
        es = new EventSource(`${apiBase}/api/events?token=${session.accessToken}`);
        eventSourceRef.current = es;

        es.addEventListener("payment.received", (event) => {
          try {
            const data = JSON.parse(event.data);
            setNotifications((prev) => [
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                type: "payment.received",
                data,
                time: new Date(),
                read: false,
              },
              ...prev.slice(0, 49), // Keep max 50 notifications
            ]);
          } catch {
            // Ignore malformed events
          }
        });

        es.onerror = () => {
          // Reconnect will happen automatically via EventSource
        };
      } catch {
        // SSE connection failed, that's ok
      }
    }

    connect();

    return () => {
      if (es) es.close();
      eventSourceRef.current = null;
    };
  }, []);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowPopover(false);
      }
    }
    if (showPopover) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showPopover]);

  const handleBellClick = useCallback(() => {
    setShowPopover((prev) => !prev);
    // Mark all as read when opening
    if (!showPopover) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
    }
  }, [showPopover]);

  const handleLogout = async () => {
    await logout();
    router.push("/auth");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        {(user?.business_name || user?.email) && (
          <span className="text-sm font-medium">{user.business_name || user.email}</span>
        )}
        <Badge variant="outline" className="font-mono text-xs">
          {priceLoading ? "Loading..." : `1 BCH = $${bchPrice.toFixed(2)}`}
        </Badge>
      </div>

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <div className="relative" ref={popoverRef}>
          <Button variant="ghost" size="icon" className="relative" onClick={handleBellClick}>
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>

          {showPopover && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border bg-popover p-2 shadow-lg z-50">
              <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Notifications
              </p>
              {notifications.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No notifications yet
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      className="flex w-full items-start gap-3 rounded-md p-2 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        if (n.data.transaction_id) {
                          router.push(`/dashboard/transactions`);
                          setShowPopover(false);
                        }
                      }}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 mt-0.5">
                        <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Payment received</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {n.data.amount_satoshis
                            ? formatBch(BigInt(n.data.amount_satoshis))
                            : "Unknown amount"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {n.time.toLocaleTimeString()}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

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
