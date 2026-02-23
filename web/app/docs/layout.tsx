import Link from "next/link";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-6 gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold">
            BCH Pay
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/docs/api" className="text-muted-foreground hover:text-foreground transition-colors">
              API Reference
            </Link>
            <Link href="/docs/sdk" className="text-muted-foreground hover:text-foreground transition-colors">
              SDK Guide
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
