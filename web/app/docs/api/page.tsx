"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const methodColors: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  POST: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  PATCH: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

interface Endpoint {
  method: string;
  path: string;
  auth: string;
  description: string;
}

const endpoints: Record<string, Endpoint[]> = {
  Authentication: [
    { method: "POST", path: "/api/v1/auth/challenge", auth: "No", description: "Generate a nonce challenge for wallet signing" },
    { method: "POST", path: "/api/v1/auth/verify", auth: "No", description: "Verify signed challenge and get JWT tokens" },
    { method: "POST", path: "/api/v1/auth/refresh", auth: "No", description: "Refresh access token using refresh token" },
  ],
  Merchants: [
    { method: "POST", path: "/api/v1/merchants", auth: "No", description: "Register a new merchant" },
    { method: "GET", path: "/api/v1/merchants/me", auth: "Yes", description: "Get authenticated merchant profile" },
    { method: "GET", path: "/api/v1/merchants/:id", auth: "No", description: "Get public merchant profile" },
    { method: "PUT", path: "/api/v1/merchants/me", auth: "Yes", description: "Update merchant profile" },
  ],
  "Payment Links": [
    { method: "POST", path: "/api/v1/payment-links", auth: "Yes", description: "Create a new payment link" },
    { method: "GET", path: "/api/v1/payment-links", auth: "Yes", description: "List merchant's payment links" },
    { method: "GET", path: "/api/v1/payment-links/:slug", auth: "No", description: "Get payment link by slug" },
    { method: "GET", path: "/api/v1/payment-links/:id/stats", auth: "Yes", description: "Get payment link statistics" },
    { method: "PUT", path: "/api/v1/payment-links/:id", auth: "Yes", description: "Update a payment link" },
    { method: "DELETE", path: "/api/v1/payment-links/:id", auth: "Yes", description: "Deactivate a payment link" },
  ],
  Transactions: [
    { method: "GET", path: "/api/v1/transactions", auth: "Yes", description: "List merchant's transactions" },
    { method: "GET", path: "/api/v1/transactions/:id", auth: "Yes", description: "Get transaction details" },
  ],
  Invoices: [
    { method: "POST", path: "/api/v1/invoices", auth: "Yes", description: "Create a new invoice" },
    { method: "GET", path: "/api/v1/invoices", auth: "Yes", description: "List merchant's invoices" },
    { method: "GET", path: "/api/v1/invoices/:id", auth: "No", description: "Get invoice details" },
    { method: "PATCH", path: "/api/v1/invoices/:id", auth: "Yes", description: "Update invoice" },
  ],
  Contracts: [
    { method: "GET", path: "/api/v1/contracts", auth: "Yes", description: "List merchant's contracts" },
    { method: "GET", path: "/api/v1/contracts/types", auth: "Yes", description: "List available contract types" },
    { method: "GET", path: "/api/v1/contracts/:id", auth: "Yes", description: "Get contract details" },
    { method: "POST", path: "/api/v1/contracts/escrow", auth: "Yes", description: "Create escrow contract" },
    { method: "POST", path: "/api/v1/contracts/split-payment", auth: "Yes", description: "Create 2-recipient split payment" },
    { method: "POST", path: "/api/v1/contracts/split-payment-multi", auth: "Yes", description: "Create N-recipient split payment" },
    { method: "POST", path: "/api/v1/contracts/split-payment/preview", auth: "Yes", description: "Preview split distribution" },
    { method: "POST", path: "/api/v1/contracts/savings-vault", auth: "Yes", description: "Create savings vault" },
    { method: "PATCH", path: "/api/v1/contracts/:id/status", auth: "Yes", description: "Update contract status" },
    { method: "POST", path: "/api/v1/contracts/:id/release", auth: "Yes", description: "Release escrow funds" },
    { method: "POST", path: "/api/v1/contracts/:id/refund", auth: "Yes", description: "Refund escrow" },
    { method: "POST", path: "/api/v1/contracts/:id/resolve", auth: "Yes", description: "Resolve disputed escrow" },
  ],
  Checkout: [
    { method: "POST", path: "/api/v1/checkout/sessions", auth: "Yes", description: "Create checkout session" },
    { method: "GET", path: "/api/v1/checkout/:sessionId", auth: "No", description: "Get checkout session details" },
    { method: "POST", path: "/api/v1/checkout/:sessionId/cancel", auth: "No", description: "Cancel checkout session" },
  ],
  CashTokens: [
    { method: "GET", path: "/api/v1/cashtokens/loyalty/stats", auth: "Yes", description: "Get loyalty token stats" },
    { method: "POST", path: "/api/v1/cashtokens/receipts/enable", auth: "Yes", description: "Enable receipt NFTs" },
  ],
  Price: [
    { method: "GET", path: "/api/v1/price", auth: "No", description: "Get current BCH/USD price" },
  ],
};

export default function ApiDocsPage() {
  return (
    <div className="space-y-12">
      <div>
        <h1 className="text-4xl font-bold">API Reference</h1>
        <p className="text-lg text-muted-foreground mt-2">
          BCH Pay REST API v1 — Base URL: <code className="text-sm bg-muted px-2 py-1 rounded">/api/v1</code>
        </p>
      </div>

      {/* Authentication */}
      <section id="authentication" className="space-y-4">
        <h2 className="text-2xl font-bold border-b pb-2">Authentication</h2>
        <p className="text-muted-foreground">
          BCH Pay supports two authentication methods. All authenticated endpoints accept either method.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="font-semibold">JWT Bearer Token</h3>
            <p className="text-sm text-muted-foreground">
              Obtain tokens via the challenge/verify auth flow. Include in requests:
            </p>
            <Tabs defaultValue="curl">
              <TabsList><TabsTrigger value="curl">cURL</TabsTrigger><TabsTrigger value="js">JavaScript</TabsTrigger></TabsList>
              <TabsContent value="curl">
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  ${"{API_URL}"}/api/v1/merchants/me`}
                </pre>
              </TabsContent>
              <TabsContent value="js">
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`fetch("/api/v1/merchants/me", {
  headers: { Authorization: "Bearer " + token }
})`}
                </pre>
              </TabsContent>
            </Tabs>
          </div>
          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="font-semibold">API Key</h3>
            <p className="text-sm text-muted-foreground">
              Use your API key (generated at registration) for server-to-server calls:
            </p>
            <Tabs defaultValue="curl">
              <TabsList><TabsTrigger value="curl">cURL</TabsTrigger><TabsTrigger value="js">JavaScript</TabsTrigger></TabsList>
              <TabsContent value="curl">
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`curl -H "x-api-key: bchpay_xxx..." \\
  ${"{API_URL}"}/api/v1/merchants/me`}
                </pre>
              </TabsContent>
              <TabsContent value="js">
                <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
{`fetch("/api/v1/merchants/me", {
  headers: { "x-api-key": "bchpay_xxx..." }
})`}
                </pre>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>

      {/* Endpoints */}
      <section id="endpoints" className="space-y-6">
        <h2 className="text-2xl font-bold border-b pb-2">Endpoints</h2>
        {Object.entries(endpoints).map(([group, eps]) => (
          <div key={group} className="space-y-3">
            <h3 className="text-lg font-semibold">{group}</h3>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left font-medium w-20">Method</th>
                    <th className="p-3 text-left font-medium">Path</th>
                    <th className="p-3 text-left font-medium w-16">Auth</th>
                    <th className="p-3 text-left font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {eps.map((ep, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${methodColors[ep.method]}`}>
                          {ep.method}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-xs">{ep.path}</td>
                      <td className="p-3">{ep.auth === "Yes" ? <Badge variant="outline" className="text-xs">Auth</Badge> : <span className="text-xs text-muted-foreground">Public</span>}</td>
                      <td className="p-3 text-muted-foreground">{ep.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      {/* Webhooks */}
      <section id="webhooks" className="space-y-4">
        <h2 className="text-2xl font-bold border-b pb-2">Webhooks</h2>
        <p className="text-muted-foreground">
          Configure a webhook URL in your merchant settings to receive real-time event notifications.
        </p>
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-semibold">Event Types</h3>
          <ul className="space-y-2 text-sm">
            <li><code className="bg-muted px-1.5 py-0.5 rounded">payment.received</code> — Payment detected (0-conf)</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded">payment.confirmed</code> — Payment confirmed on-chain</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded">invoice.paid</code> — Invoice payment received</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded">contract.funded</code> — Contract address received funds</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded">contract.released</code> — Escrow funds released</li>
            <li><code className="bg-muted px-1.5 py-0.5 rounded">contract.refunded</code> — Escrow refunded</li>
          </ul>
          <h3 className="font-semibold mt-4">Verification</h3>
          <p className="text-sm text-muted-foreground">Webhooks are signed with HMAC-SHA256. Verify the <code>X-Webhook-Signature</code> header.</p>
        </div>
      </section>

      {/* Rate Limits */}
      <section id="rate-limits" className="space-y-4">
        <h2 className="text-2xl font-bold border-b pb-2">Rate Limits</h2>
        <div className="rounded-lg border p-4 space-y-2">
          <p className="text-sm"><strong>100 requests per minute</strong> per API key / merchant / IP address.</p>
          <p className="text-sm text-muted-foreground">Rate limit headers are included in every response:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li><code>X-RateLimit-Limit</code> — Maximum requests per window</li>
            <li><code>X-RateLimit-Remaining</code> — Remaining requests in window</li>
            <li><code>X-RateLimit-Reset</code> — Unix timestamp when window resets</li>
            <li><code>Retry-After</code> — Seconds until retry (only on 429)</li>
          </ul>
        </div>
      </section>

      {/* Errors */}
      <section id="errors" className="space-y-4">
        <h2 className="text-2xl font-bold border-b pb-2">Errors</h2>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground mb-3">All errors return a JSON response with an <code>error</code> field:</p>
          <pre className="bg-muted p-3 rounded text-xs">{`{ "error": "Description of the error" }`}</pre>
          <div className="mt-4 space-y-2 text-sm">
            <p><code>400</code> — Bad Request (validation errors)</p>
            <p><code>401</code> — Unauthorized (missing/invalid auth)</p>
            <p><code>404</code> — Not Found</p>
            <p><code>409</code> — Conflict (duplicate resource)</p>
            <p><code>429</code> — Rate Limited</p>
            <p><code>500</code> — Internal Server Error</p>
            <p><code>503</code> — Service Unavailable (price service down)</p>
          </div>
        </div>
      </section>
    </div>
  );
}
