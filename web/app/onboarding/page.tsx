"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";

export default function OnboardingPage() {
  const router = useRouter();
  const { address } = useAuth();
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

    const profileBody = JSON.stringify({
      bch_address: address,
      business_name: name.trim(),
      email: email.trim() || undefined,
      logo_url: logoUrl.trim() || undefined,
    });

    setLoading(true);
    try {
      await apiFetch("/api/merchants", {
        method: "POST",
        body: profileBody,
      });

      toast.success("Welcome to CashTap!");
      router.push("/dashboard?tour=true");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("already exists")) {
        // Merchant was auto-created during auth — update with business name
        try {
          await apiFetch("/api/merchants/me", {
            method: "PUT",
            body: profileBody,
          });
          toast.success("Welcome to CashTap!");
          router.push("/dashboard?tour=true");
        } catch {
          // PUT failed — still let them through
          toast.success("Welcome back!");
          router.push("/dashboard");
        }
      } else {
        toast.error("Failed to create profile. Please try again.");
      }
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
