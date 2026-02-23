"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Script from "next/script";

export default function SdkDocsPage() {
  const [amount, setAmount] = useState("500");
  const [memo, setMemo] = useState("Coffee");
  const [color, setColor] = useState("#0AC18E");
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sdkLoaded || !buttonRef.current) return;
    buttonRef.current.innerHTML = "";
    const BCHPay = (window as any).BCHPay;
    if (BCHPay?.button) {
      BCHPay.button({
        merchant: "bitcoincash:qz...",
        amount: Number(amount),
        memo,
        containerId: "sdk-demo-button",
        buttonColor: color,
        onSuccess: (data: any) => alert("Payment success: " + JSON.stringify(data)),
        onCancel: () => alert("Payment cancelled"),
        onError: (err: any) => alert("Error: " + err.message),
      });
    }
  }, [sdkLoaded, amount, memo, color]);

  return (
    <div className="space-y-8">
      <Script src="/sdk.js" onLoad={() => setSdkLoaded(true)} />

      <div>
        <h1 className="text-4xl font-bold">JavaScript SDK</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Add a "Pay with BCH" button to any website in minutes.
        </p>
      </div>

      {/* Live Demo */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live Preview</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center min-h-[120px]">
            <div id="sdk-demo-button" ref={buttonRef}>
              {!sdkLoaded && <p className="text-sm text-muted-foreground">Loading SDK...</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Amount (cents USD)</label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Memo</label>
              <Input value={memo} onChange={(e) => setMemo(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Button Color</label>
              <div className="flex gap-2 mt-1">
                <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-9 p-1" />
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integration Guide */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Quick Start</h2>
        <div className="space-y-2">
          <Badge variant="outline">Step 1</Badge>
          <p className="text-muted-foreground">Include the SDK script on your page:</p>
          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">{`<script src="https://bchpay.app/sdk.js"></script>`}</pre>
        </div>
        <div className="space-y-2">
          <Badge variant="outline">Step 2</Badge>
          <p className="text-muted-foreground">Add a container element and initialize:</p>
        </div>
      </section>

      {/* Code Snippets */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Code Examples</h2>
        <Tabs defaultValue="html">
          <TabsList>
            <TabsTrigger value="html">HTML</TabsTrigger>
            <TabsTrigger value="js">JavaScript</TabsTrigger>
            <TabsTrigger value="react">React</TabsTrigger>
          </TabsList>
          <TabsContent value="html">
            <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">{`<!DOCTYPE html>
<html>
<body>
  <div id="pay-button"></div>

  <script src="https://bchpay.app/sdk.js"></script>
  <script>
    BCHPay.button({
      merchant: "bitcoincash:qz...",
      amount: ${amount},
      memo: "${memo}",
      containerId: "pay-button",
      apiKey: "bchpay_xxx...",
      onSuccess: function(tx) {
        console.log("Paid!", tx);
      }
    });
  </script>
</body>
</html>`}</pre>
          </TabsContent>
          <TabsContent value="js">
            <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">{`// Using the SDK programmatically
const session = await BCHPay.createCheckout(
  "bchpay_xxx...", // API key
  ${amount},         // amount in USD cents
  {
    memo: "${memo}",
    successUrl: "https://yoursite.com/success",
    cancelUrl: "https://yoursite.com/cancel",
  }
);

// Open the checkout modal
BCHPay.openModal(session.checkout_url, {
  onSuccess: (data) => console.log("Paid!", data),
  onCancel: () => console.log("Cancelled"),
});`}</pre>
          </TabsContent>
          <TabsContent value="react">
            <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">{`import { useEffect, useRef } from "react";
import Script from "next/script";

export function PayButton() {
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded || !ref.current) return;
    window.BCHPay.button({
      merchant: "bitcoincash:qz...",
      amount: ${amount},
      memo: "${memo}",
      containerId: "bch-pay-btn",
      apiKey: "bchpay_xxx...",
      onSuccess: (tx) => console.log("Paid!", tx),
    });
  }, [loaded]);

  return (
    <>
      <Script src="/sdk.js" onLoad={() => setLoaded(true)} />
      <div id="bch-pay-btn" ref={ref} />
    </>
  );
}`}</pre>
          </TabsContent>
        </Tabs>
      </section>

      {/* Checkout Session Flow */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Checkout Session Flow</h2>
        <div className="rounded-lg border p-6 space-y-3">
          <div className="flex items-center gap-3">
            <Badge>1</Badge>
            <p className="text-sm">Your server creates a checkout session via <code>POST /api/v1/checkout/sessions</code></p>
          </div>
          <div className="flex items-center gap-3">
            <Badge>2</Badge>
            <p className="text-sm">Redirect user to <code>checkout_url</code> or open it in the SDK modal</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge>3</Badge>
            <p className="text-sm">User pays via QR code or wallet link on the checkout page</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge>4</Badge>
            <p className="text-sm">On payment confirmation, user is redirected to <code>success_url</code> with session ID</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge>5</Badge>
            <p className="text-sm">Your server verifies the session status via <code>GET /api/v1/checkout/:sessionId</code></p>
          </div>
        </div>
      </section>
    </div>
  );
}
