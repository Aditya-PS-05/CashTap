import Link from "next/link";
import Image from "next/image";
import {
  Zap, Smartphone, Link2, Coins, Shield, ArrowRight, Github,
  Download, QrCode, CheckCircle2, Timer, Wallet, Receipt, Code,
  Twitter, ExternalLink,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b sticky top-0 bg-background/80 backdrop-blur-sm z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0AC18E]">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold">BCH Pay</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Docs
            </Link>
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
      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
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
                href="#download"
                className="inline-flex h-12 items-center gap-2 rounded-lg border px-8 text-base font-medium hover:bg-muted transition-colors"
              >
                <Download className="h-4 w-4" /> Download App
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

      {/* Demo Flow Section */}
      <section className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold mb-4">See It in Action</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-lg mx-auto">
            From charge to confirmed in under 30 seconds
          </p>
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-0">
            {/* Step 1: Enter Amount */}
            <div className="flex flex-col items-center text-center max-w-[180px]">
              <div className="relative w-20 h-20 mb-3">
                <div className="absolute inset-0 rounded-2xl bg-[#0AC18E]/10 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Smartphone className="h-10 w-10 text-[#0AC18E]" />
                </div>
              </div>
              <p className="text-sm font-semibold">Enter Amount</p>
              <p className="text-xs text-muted-foreground mt-1">Type the price on the POS numpad</p>
            </div>

            <div className="hidden md:flex items-center px-2">
              <div className="w-12 h-0.5 bg-[#0AC18E]/30" />
              <ArrowRight className="h-4 w-4 text-[#0AC18E]/50" />
            </div>
            <div className="md:hidden">
              <ArrowRight className="h-4 w-4 text-[#0AC18E]/50 rotate-90" />
            </div>

            {/* Step 2: Show QR */}
            <div className="flex flex-col items-center text-center max-w-[180px]">
              <div className="relative w-20 h-20 mb-3">
                <div className="absolute inset-0 rounded-2xl bg-[#0AC18E]/10 animate-pulse [animation-delay:0.5s]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <QrCode className="h-10 w-10 text-[#0AC18E]" />
                </div>
              </div>
              <p className="text-sm font-semibold">Show QR Code</p>
              <p className="text-xs text-muted-foreground mt-1">QR generated instantly</p>
            </div>

            <div className="hidden md:flex items-center px-2">
              <div className="w-12 h-0.5 bg-[#0AC18E]/30" />
              <ArrowRight className="h-4 w-4 text-[#0AC18E]/50" />
            </div>
            <div className="md:hidden">
              <ArrowRight className="h-4 w-4 text-[#0AC18E]/50 rotate-90" />
            </div>

            {/* Step 3: Customer Scans */}
            <div className="flex flex-col items-center text-center max-w-[180px]">
              <div className="relative w-20 h-20 mb-3">
                <div className="absolute inset-0 rounded-2xl bg-[#0AC18E]/10 animate-pulse [animation-delay:1s]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Timer className="h-10 w-10 text-[#0AC18E]" />
                </div>
              </div>
              <p className="text-sm font-semibold">Customer Pays</p>
              <p className="text-xs text-muted-foreground mt-1">Scans with any BCH wallet</p>
            </div>

            <div className="hidden md:flex items-center px-2">
              <div className="w-12 h-0.5 bg-[#0AC18E]/30" />
              <ArrowRight className="h-4 w-4 text-[#0AC18E]/50" />
            </div>
            <div className="md:hidden">
              <ArrowRight className="h-4 w-4 text-[#0AC18E]/50 rotate-90" />
            </div>

            {/* Step 4: Confirmed */}
            <div className="flex flex-col items-center text-center max-w-[180px]">
              <div className="relative w-20 h-20 mb-3">
                <div className="absolute inset-0 rounded-2xl bg-green-500/10 animate-pulse [animation-delay:1.5s]" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
              </div>
              <p className="text-sm font-semibold text-green-600">Confirmed!</p>
              <p className="text-xs text-muted-foreground mt-1">0-conf instant confirmation</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold mb-4">Everything You Need</h2>
          <p className="text-center text-muted-foreground mb-16 max-w-xl mx-auto">
            A complete payment platform for Bitcoin Cash merchants — from charging customers to tracking revenue.
          </p>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                image: "/images/payment_terminal.png",
                title: "Mobile POS",
                desc: "Charge customers with your phone. Type the amount, show the QR, get paid instantly.",
              },
              {
                image: "/images/pay_button.png",
                title: "Payment Links",
                desc: "Share a link, get paid in BCH. Single-use or reusable. Works with any BCH wallet.",
              },
              {
                image: "/images/wallet.png",
                title: "CashToken Loyalty",
                desc: "Reward customers with on-chain loyalty tokens. Fungible CashTokens for real utility.",
              },
              {
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
      <section className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold mb-16">How It Works</h2>
          <div className="grid gap-12 sm:grid-cols-3">
            {[
              {
                step: "1",
                image: "/images/wallet.png",
                title: "Connect Your Wallet",
                desc: "Download the app and connect your BCH wallet. Generate a new one or import an existing seed phrase.",
              },
              {
                step: "2",
                image: "/images/payment_terminal.png",
                title: "Enter the Amount",
                desc: "Type the amount on the POS numpad and tap Charge. A QR code is generated instantly for the customer.",
              },
              {
                step: "3",
                image: "/images/bch_coin.png",
                title: "Customer Pays",
                desc: "Customer scans the QR with any BCH wallet. Payment confirmed in seconds with 0-conf.",
              },
            ].map((s) => (
              <div key={s.step} className="text-center space-y-4">
                <div className="relative w-24 h-24 mx-auto mb-2">
                  <Image src={s.image} alt={s.title} fill className="object-contain" />
                </div>
                <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#0AC18E] text-sm font-bold text-white">
                  {s.step}
                </div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CashToken Section */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0AC18E]/30 bg-[#0AC18E]/5 px-4 py-1.5 text-sm mb-6">
                <Coins className="h-4 w-4 text-[#0AC18E]" />
                <span className="text-[#0AC18E] font-medium">Powered by CashTokens</span>
              </div>
              <h2 className="text-3xl font-bold mb-6">
                On-Chain Loyalty &amp; Receipt NFTs
              </h2>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                BCH Pay leverages Bitcoin Cash&apos;s native CashToken protocol — no sidechains,
                no bridges, no extra fees. Tokens live directly on the BCH blockchain.
              </p>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0AC18E]/10">
                    <Wallet className="h-5 w-5 text-[#0AC18E]" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Fungible Loyalty Tokens</h3>
                    <p className="text-sm text-muted-foreground">
                      Issue your own branded loyalty tokens. Customers earn tokens with every purchase
                      and redeem them for discounts — all verified on-chain.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0AC18E]/10">
                    <Receipt className="h-5 w-5 text-[#0AC18E]" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Non-Fungible Receipt Tokens</h3>
                    <p className="text-sm text-muted-foreground">
                      Every purchase can mint an NFT receipt with the transaction details —
                      immutable proof of purchase stored forever on the blockchain.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0AC18E]/10">
                    <Shield className="h-5 w-5 text-[#0AC18E]" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Native BCH Protocol</h3>
                    <p className="text-sm text-muted-foreground">
                      CashTokens are a native feature of Bitcoin Cash (May 2023 upgrade).
                      No smart contract risk, no bridge exploits — just Bitcoin-level security.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative flex justify-center">
              <div className="grid grid-cols-2 gap-6">
                <div className="relative w-40 h-40">
                  <Image src="/images/wallet.png" alt="Loyalty Tokens" fill className="object-contain" />
                </div>
                <div className="relative w-40 h-40 mt-8">
                  <Image src="/images/security_shield.png" alt="Receipt NFTs" fill className="object-contain" />
                </div>
                <div className="relative w-40 h-40 -mt-4 col-span-2 mx-auto">
                  <Image src="/images/bch_coin.png" alt="Bitcoin Cash" fill className="object-contain animate-float" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Developer CTA */}
      <section className="border-t bg-muted/30 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm mb-6">
                <Code className="h-4 w-4 text-[#0AC18E]" />
                <span>Developer Friendly</span>
              </div>
              <h2 className="text-3xl font-bold mb-4">For Developers</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Integrate BCH payments in 5 lines of code. RESTful API, webhook support,
                and an embeddable payment button SDK.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/docs/api"
                  className="inline-flex h-10 items-center gap-2 rounded-lg border px-6 text-sm font-medium hover:bg-muted transition-colors"
                >
                  API Docs <ExternalLink className="h-3 w-3" />
                </Link>
                <Link
                  href="/docs/sdk"
                  className="inline-flex h-10 items-center gap-2 rounded-lg border px-6 text-sm font-medium hover:bg-muted transition-colors"
                >
                  SDK Guide <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
            <div className="rounded-xl border bg-zinc-950 p-6 text-left">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-xs text-zinc-500 ml-2">index.html</span>
              </div>
              <pre className="text-sm text-green-400 overflow-x-auto">
                <code>{`<script src="https://bchpay.app/sdk.js"></script>
<script>
  BCHPay.button({
    merchant: "bitcoincash:qz...",
    amount: 500, // cents USD
    memo: "Coffee",
    onSuccess: (tx) => {
      console.log("Paid!", tx.hash);
    },
  });
</script>`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="py-24">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Get BCH Pay</h2>
          <p className="text-muted-foreground mb-12 max-w-lg mx-auto">
            Available on Android, Web, and as an embeddable SDK. Start accepting Bitcoin Cash today.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl mx-auto">
            <a
              href="#"
              className="group flex flex-col items-center gap-3 rounded-xl border p-6 hover:border-[#0AC18E]/50 hover:shadow-lg transition-all"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#0AC18E]/10 group-hover:bg-[#0AC18E]/20 transition-colors">
                <Download className="h-7 w-7 text-[#0AC18E]" />
              </div>
              <div>
                <p className="font-semibold">Android APK</p>
                <p className="text-xs text-muted-foreground">Direct download</p>
              </div>
            </a>
            <Link
              href="/dashboard"
              className="group flex flex-col items-center gap-3 rounded-xl border p-6 hover:border-[#0AC18E]/50 hover:shadow-lg transition-all"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#0AC18E]/10 group-hover:bg-[#0AC18E]/20 transition-colors">
                <Smartphone className="h-7 w-7 text-[#0AC18E]" />
              </div>
              <div>
                <p className="font-semibold">Web Dashboard</p>
                <p className="text-xs text-muted-foreground">Open in browser</p>
              </div>
            </Link>
            <Link
              href="/docs/sdk"
              className="group flex flex-col items-center gap-3 rounded-xl border p-6 hover:border-[#0AC18E]/50 hover:shadow-lg transition-all"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#0AC18E]/10 group-hover:bg-[#0AC18E]/20 transition-colors">
                <Code className="h-7 w-7 text-[#0AC18E]" />
              </div>
              <div>
                <p className="font-semibold">JS SDK</p>
                <p className="text-xs text-muted-foreground">npm install</p>
              </div>
            </Link>
            <a
              href="https://github.com"
              className="group flex flex-col items-center gap-3 rounded-xl border p-6 hover:border-[#0AC18E]/50 hover:shadow-lg transition-all"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#0AC18E]/10 group-hover:bg-[#0AC18E]/20 transition-colors">
                <Github className="h-7 w-7 text-[#0AC18E]" />
              </div>
              <div>
                <p className="font-semibold">GitHub</p>
                <p className="text-xs text-muted-foreground">View source</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-[#0AC18E]">
                <Zap className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm font-semibold">BCH Pay</span>
            </div>
            <div className="flex items-center gap-6">
              <a href="https://github.com" className="text-muted-foreground hover:text-foreground transition-colors">
                <Github className="h-5 w-5" />
              </a>
              <a href="https://twitter.com" className="text-muted-foreground hover:text-foreground transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Docs
              </Link>
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
            </div>
          </div>
          <div className="mt-6 text-center sm:text-left">
            <p className="text-sm text-muted-foreground">
              Built for BCH-1 Hackcelerator 2026. Powered by Bitcoin Cash.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
