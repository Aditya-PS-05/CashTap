/**
 * Integration test script — tests all major API flows on chipnet.
 *
 * Run: npx tsx scripts/integration-test.ts
 */

const BASE_URL = process.env.API_URL || "http://localhost:3456";
const TEST_ADDRESS = "bitcoincash:qr95sy3j9xwd2ap32xkykttr4cvcu7as5y27u39gc2";

async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  return { status: res.status, data };
}

function log(label: string, pass: boolean, detail?: string) {
  const icon = pass ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  console.log(`  ${icon} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failures++;
}

let failures = 0;

async function main() {
  console.log("\n========================================");
  console.log("  BCH Pay — Integration Tests");
  console.log(`  Target: ${BASE_URL}`);
  console.log("========================================\n");

  // ---------------------------------------------------------------
  // 1. Health check
  // ---------------------------------------------------------------
  console.log("1. Health Check");
  const health = await api("GET", "/api/health");
  log("GET /api/health returns 200", health.status === 200);
  log("Status is 'ok'", health.data.status === "ok");

  // ---------------------------------------------------------------
  // 2. Auth flow: challenge → verify → JWT
  // ---------------------------------------------------------------
  console.log("\n2. Auth Flow");

  const challenge = await api("POST", "/api/auth/challenge", {
    address: TEST_ADDRESS,
  });
  log("POST /api/auth/challenge returns 200", challenge.status === 200);
  log("Returns nonce", !!challenge.data.nonce, challenge.data.nonce?.slice(0, 16) + "...");

  const verify = await api("POST", "/api/auth/verify", {
    address: TEST_ADDRESS,
    signature: "test-signature-dev-mode",
    nonce: challenge.data.nonce,
  });
  log("POST /api/auth/verify returns 200", verify.status === 200);
  log("Returns access_token", !!verify.data.access_token);
  log("Returns merchant.id", !!verify.data.merchant?.id, verify.data.merchant?.id);

  const TOKEN = verify.data.access_token;
  const MERCHANT_ID = verify.data.merchant?.id;

  if (!TOKEN) {
    console.error("\n  FATAL: No JWT token — cannot continue tests.");
    process.exit(1);
  }

  // ---------------------------------------------------------------
  // 3. Merchant profile
  // ---------------------------------------------------------------
  console.log("\n3. Merchant Profile");

  const me = await api("GET", "/api/merchants/me", undefined, TOKEN);
  log("GET /api/merchants/me returns 200", me.status === 200);
  log("Merchant has bch_address", !!me.data.merchant?.bch_address);

  const update = await api(
    "PUT",
    `/api/merchants/${MERCHANT_ID}`,
    { business_name: "Integration Test Store" },
    TOKEN
  );
  log("PUT /api/merchants/:id returns 200", update.status === 200);
  log(
    "Business name updated",
    update.data.merchant?.business_name === "Integration Test Store"
  );

  // ---------------------------------------------------------------
  // 4. Payment Link flow
  // ---------------------------------------------------------------
  console.log("\n4. Payment Link Flow");

  const createLink = await api(
    "POST",
    "/api/payment-links",
    {
      amount_satoshis: 50000,
      memo: "Integration test payment",
      type: "SINGLE",
    },
    TOKEN
  );
  log("POST /api/payment-links returns 201", createLink.status === 201);
  log("Returns payment_link.id", !!createLink.data.payment_link?.id);
  log("Returns payment_link.slug", !!createLink.data.payment_link?.slug);
  log("Returns pay_url", !!createLink.data.pay_url, createLink.data.pay_url);

  const slug = createLink.data.payment_link?.slug;
  if (slug) {
    const getLink = await api("GET", `/api/payment-links/${slug}`);
    log("GET /api/payment-links/:slug returns 200 (public)", getLink.status === 200);
    log(
      "Payment amount matches",
      getLink.data.payment_link?.amount_satoshis === "50000"
    );
  }

  const listLinks = await api("GET", "/api/payment-links", undefined, TOKEN);
  log("GET /api/payment-links returns 200", listLinks.status === 200);
  log(
    "Returns payment_links array",
    Array.isArray(listLinks.data.payment_links)
  );
  log("Returns pagination", !!listLinks.data.pagination);

  // ---------------------------------------------------------------
  // 5. Invoice flow
  // ---------------------------------------------------------------
  console.log("\n5. Invoice Flow");

  const createInvoice = await api(
    "POST",
    "/api/invoices",
    {
      customer_email: "test@example.com",
      items: [
        { description: "Widget A", quantity: 2, unit_price: 10000 },
        { description: "Widget B", quantity: 1, unit_price: 25000 },
      ],
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    },
    TOKEN
  );
  log(
    "POST /api/invoices returns 201",
    createInvoice.status === 201,
    `total: ${createInvoice.data.invoice?.total_satoshis}`
  );
  log("Returns invoice.id", !!createInvoice.data.invoice?.id);

  const invoiceId = createInvoice.data.invoice?.id;
  if (invoiceId) {
    const getInvoice = await api(
      "GET",
      `/api/invoices/${invoiceId}`,
      undefined,
      TOKEN
    );
    log("GET /api/invoices/:id returns 200", getInvoice.status === 200);
    log(
      "Invoice status is DRAFT",
      getInvoice.data.invoice?.status === "DRAFT"
    );
  }

  const listInvoices = await api("GET", "/api/invoices", undefined, TOKEN);
  log("GET /api/invoices returns 200", listInvoices.status === 200);
  log(
    "Returns invoices array",
    Array.isArray(listInvoices.data.invoices)
  );

  // ---------------------------------------------------------------
  // 6. Transaction endpoints
  // ---------------------------------------------------------------
  console.log("\n6. Transactions");

  const listTx = await api("GET", "/api/transactions", undefined, TOKEN);
  log("GET /api/transactions returns 200", listTx.status === 200);
  log(
    "Returns transactions array",
    Array.isArray(listTx.data.transactions)
  );

  const stats = await api("GET", "/api/transactions/stats", undefined, TOKEN);
  log("GET /api/transactions/stats returns 200", stats.status === 200);

  // ---------------------------------------------------------------
  // 7. Contract endpoints
  // ---------------------------------------------------------------
  console.log("\n7. Contract Endpoints");

  const types = await api("GET", "/api/contracts/types", undefined, TOKEN);
  log("GET /api/contracts/types returns 200", types.status === 200);
  log(
    "Returns 4 contract types",
    types.data.contract_types?.length === 4,
    types.data.contract_types?.map((t: { type: string }) => t.type).join(", ")
  );

  // Test escrow creation
  const DUMMY_PKH = "0000000000000000000000000000000000000000";
  const createEscrow = await api(
    "POST",
    "/api/contracts/escrow",
    {
      buyer_pkh: DUMMY_PKH,
      seller_pkh: DUMMY_PKH,
      arbiter_pkh: DUMMY_PKH,
      timeout: Math.floor(Date.now() / 1000) + 86400,
    },
    TOKEN
  );
  log(
    "POST /api/contracts/escrow returns 201",
    createEscrow.status === 201,
    createEscrow.data.contract?.address?.slice(0, 30) + "..."
  );
  log("Returns contract.id", !!createEscrow.data.contract?.id);
  log("Returns contract.address", !!createEscrow.data.contract?.address);

  // Test split payment creation
  const createSplit = await api(
    "POST",
    "/api/contracts/split-payment",
    {
      recipient1_pkh: DUMMY_PKH,
      recipient2_pkh: DUMMY_PKH,
      split1_percent: 60,
      split2_percent: 40,
    },
    TOKEN
  );
  log(
    "POST /api/contracts/split-payment returns 201",
    createSplit.status === 201,
    createSplit.data.contract?.address?.slice(0, 30) + "..."
  );

  // Test savings vault creation
  const createVault = await api(
    "POST",
    "/api/contracts/savings-vault",
    {
      owner_pkh: DUMMY_PKH,
      locktime: Math.floor(Date.now() / 1000) + 86400 * 30,
    },
    TOKEN
  );
  log(
    "POST /api/contracts/savings-vault returns 201",
    createVault.status === 201,
    createVault.data.contract?.address?.slice(0, 30) + "..."
  );

  // Get contract instance by ID
  const contractId = createEscrow.data.contract?.id;
  if (contractId) {
    const getContract = await api(
      "GET",
      `/api/contracts/${contractId}`,
      undefined,
      TOKEN
    );
    log("GET /api/contracts/:id returns 200", getContract.status === 200);
    log(
      "Contract type is ESCROW",
      getContract.data.contract?.type === "ESCROW"
    );
    log(
      "Contract status is ACTIVE",
      getContract.data.contract?.status === "ACTIVE"
    );
  }

  // ---------------------------------------------------------------
  // 8. Device registration
  // ---------------------------------------------------------------
  console.log("\n8. Device Registration");

  const registerDevice = await api(
    "POST",
    "/api/devices/register",
    {
      device_token: "test-fcm-token-12345",
      platform: "ANDROID",
    },
    TOKEN
  );
  log(
    "POST /api/devices/register returns 200/201",
    registerDevice.status === 200 || registerDevice.status === 201
  );

  // ---------------------------------------------------------------
  // 9. Auth edge cases
  // ---------------------------------------------------------------
  console.log("\n9. Auth Edge Cases");

  const noAuth = await api("GET", "/api/merchants/me");
  log("GET without auth returns 401", noAuth.status === 401);

  const badToken = await api("GET", "/api/merchants/me", undefined, "bad-token");
  log("GET with invalid token returns 401", badToken.status === 401);

  const refreshRes = await api("POST", "/api/auth/refresh", {
    refresh_token: verify.data.refresh_token,
  });
  log("POST /api/auth/refresh returns 200", refreshRes.status === 200);
  log("Returns new access_token", !!refreshRes.data.access_token);

  // ---------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------
  console.log("\n========================================");
  if (failures === 0) {
    console.log("  \x1b[32mAll tests passed!\x1b[0m");
  } else {
    console.log(`  \x1b[31m${failures} test(s) failed\x1b[0m`);
  }
  console.log("========================================\n");

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
