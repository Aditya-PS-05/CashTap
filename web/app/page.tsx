import Link from "next/link";
import Image from "next/image";
import { Zap, Smartphone, Link2, FileText, Coins, Shield, ArrowRight, Github } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0AC18E]">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold">BCH Pay</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center justify-center rounded-md bg-[#0AC18E] px-4 text-sm font-medium text-white hover:bg-[#09a87b] transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm mb-6">
              <Coins className="h-4 w-4 text-[#0AC18E]" />
              <span>Built with CashTokens on Bitcoin Cash</span>
            </div>
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Accept <span className="text-[#0AC18E]">Bitcoin Cash</span>
              <br />in Seconds
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
              Mobile POS, Payment Links, Invoices, and CashToken Loyalty Rewards — all in one app.
              Zero-confirmation instant payments. No middlemen.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#0AC18E] px-8 text-base font-semibold text-white hover:bg-[#09a87b] transition-colors"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com"
                className="inline-flex h-12 items-center gap-2 rounded-lg border px-8 text-base font-medium hover:bg-muted transition-colors"
              >
                <Github className="h-4 w-4" /> View on GitHub
              </a>
            </div>
          </div>
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative w-80 h-80 lg:w-96 lg:h-96">
              <Image
                src="/images/bch_coin.png"
                alt="Bitcoin Cash 3D Coin"
                fill
                className="object-contain drop-shadow-2xl animate-float"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold mb-4">Everything You Need</h2>
          <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
            A complete payment platform for Bitcoin Cash merchants — from charging customers to tracking revenue.
          </p>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Smartphone,
                image: "/images/payment_terminal.png",
                title: "Mobile POS",
                desc: "Charge customers with your phone. Type the amount, show the QR, get paid instantly.",
              },
              {
                icon: Link2,
                image: "/images/pay_button.png",
                title: "Payment Links",
                desc: "Share a link, get paid in BCH. Single-use or reusable. Works with any BCH wallet.",
              },
              {
                icon: Coins,
                image: "/images/wallet.png",
                title: "CashToken Loyalty",
                desc: "Reward customers with on-chain loyalty tokens. Fungible CashTokens for real utility.",
              },
              {
                icon: Shield,
                image: "/images/security_shield.png",
                title: "Receipt NFTs",
                desc: "On-chain proof of every purchase. Non-fungible CashToken receipts with purchase data.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-6 space-y-3 group hover:shadow-lg transition-shadow">
                <div className="relative h-28 w-full mb-2">
                  <Image
                    src={f.image}
                    alt={f.title}
                    fill
                    className="object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold mb-16">How It Works</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              { step: "1", title: "Connect Your Wallet", desc: "Download the app and connect your BCH wallet. Generate a new one or import existing." },
              { step: "2", title: "Enter the Amount", desc: "Type the amount on the POS numpad and tap Charge. A QR code is generated instantly." },
              { step: "3", title: "Customer Pays", desc: "Customer scans the QR with any BCH wallet. Payment confirmed in seconds with 0-conf." },
            ].map((s) => (
              <div key={s.step} className="text-center space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#0AC18E] text-2xl font-bold text-white">
                  {s.step}
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Developer CTA */}
      <section className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">For Developers</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Integrate BCH payments in 5 lines of code. RESTful API, webhook support, and an embeddable payment button SDK.
          </p>
          <div className="mx-auto max-w-lg rounded-xl border bg-zinc-950 p-6 text-left">
            <pre className="text-sm text-green-400 overflow-x-auto">
              <code>{`BCHPay.button({
  merchant: "bitcoincash:qz...",
  amount: 500, // cents USD
  memo: "Coffee",
  onSuccess: (tx) => console.log("Paid!", tx),
})`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="mx-auto max-w-6xl px-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[#0AC18E]">
              <Zap className="h-3 w-3 text-white" />
            </div>
            <span className="text-sm font-semibold">BCH Pay</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built for BCH-1 Hackcelerator 2026. Powered by Bitcoin Cash.
          </p>
        </div>
      </footer>
    </div>
  );
}
