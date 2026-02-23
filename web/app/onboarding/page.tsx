"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://cashtap-api-production.up.railway.app";

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Business name is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/merchants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined, logoUrl: logoUrl.trim() || undefined }),
      });

      if (!res.ok) throw new Error("Failed to create merchant profile");

      toast.success("Welcome to CashTap!");
      router.push("/dashboard?tour=true");
    } catch {
      toast.error("Failed to create profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 relative w-20 h-20">
              <Image src="/images/bch_coin_icon.png" alt="CashTap" fill className="object-contain" />
            </div>
            <h1 className="text-2xl font-bold">Set Up Your Business</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tell us about your business to get started
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium">Business Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Coffee Shop"
                className="mt-1"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hello@mybusiness.com"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">For invoice notifications (optional)</p>
            </div>
            <div>
              <label className="text-sm font-medium">Logo URL</label>
              <Input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Will appear on invoices (optional)</p>
            </div>
            <Button type="submit" className="w-full h-12 gap-2 text-base" disabled={loading}>
              {loading ? "Setting up..." : "Continue to Dashboard"} <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
