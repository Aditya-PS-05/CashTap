import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">Developer Documentation</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Everything you need to integrate BCH Pay into your application.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Link
          href="/docs/api"
          className="block rounded-lg border p-6 hover:border-primary/50 transition-colors"
        >
          <h2 className="text-xl font-semibold">API Reference</h2>
          <p className="text-muted-foreground mt-2">
            Complete REST API documentation with authentication, endpoints, webhooks, and error handling.
          </p>
        </Link>
        <Link
          href="/docs/sdk"
          className="block rounded-lg border p-6 hover:border-primary/50 transition-colors"
        >
          <h2 className="text-xl font-semibold">SDK Guide</h2>
          <p className="text-muted-foreground mt-2">
            Embed a "Pay with BCH" button on any website with our JavaScript SDK.
          </p>
        </Link>
      </div>
    </div>
  );
}
