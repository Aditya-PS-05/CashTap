/**
 * Tests for src/services/monitor.ts
 *
 * Mock electrum-cash and prisma. Test the TransactionMonitor class methods.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../helpers/mock-prisma.js";
import { paymentLinkFixture, transactionFixture, contractInstanceFixture } from "../helpers/fixtures.js";

// Undo the global mock from setup.ts so we test the REAL implementation
vi.unmock("../../src/services/monitor.js");

// Use vi.hoisted so mockClient is available inside hoisted vi.mock() calls
const { mockClient } = vi.hoisted(() => {
  const mockClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    request: vi.fn(),
    on: vi.fn(),
  };
  return { mockClient };
});

// Mock electrum-cash — ElectrumClient must be a class (used with `new`)
vi.mock("electrum-cash", () => {
  class MockElectrumClient {
    connect = mockClient.connect;
    disconnect = mockClient.disconnect;
    subscribe = mockClient.subscribe;
    request = mockClient.request;
    on = mockClient.on;
    constructor(..._args: any[]) {}
  }
  return {
    ElectrumClient: MockElectrumClient,
    ElectrumTransport: { WSS: { Scheme: "wss" } },
  };
});

// Mock webhook service (dynamically imported by monitor)
vi.mock("../../src/services/webhook.js", () => ({
  webhookService: {
    deliver: vi.fn(),
  },
}));

const { transactionMonitor } = await import("../../src/services/monitor.js");

describe("transactionMonitor.connect", () => {
  beforeEach(() => {
    mockClient.connect.mockReset().mockResolvedValue(undefined);
    mockClient.on.mockReset();
    mockClient.subscribe.mockReset().mockResolvedValue(undefined);
    mockClient.request.mockReset();
    mockClient.disconnect.mockReset().mockResolvedValue(undefined);
  });

  it("connects to electrum server", async () => {
    await transactionMonitor.connect();
    expect(mockClient.connect).toHaveBeenCalled();
  });

  it("registers notification and disconnected handlers", async () => {
    await transactionMonitor.connect();
    const eventNames = mockClient.on.mock.calls.map((c: any[]) => c[0]);
    expect(eventNames).toContain("notification");
    expect(eventNames).toContain("disconnected");
  });
});

describe("transactionMonitor.watchAddress", () => {
  it("registers address for watching", async () => {
    await transactionMonitor.watchAddress("bchtest:qtest", "pl1", "m1", 50000n);
    // No error = success — address stored internally
  });
});

describe("transactionMonitor.watchContractAddress", () => {
  it("registers contract address for watching", async () => {
    await transactionMonitor.watchContractAddress("bchtest:ptest", "ci1", "m1");
    // No error = success
  });
});

describe("transactionMonitor.unwatch", () => {
  it("removes an address from watching", () => {
    transactionMonitor.unwatch("bchtest:qtest");
    // No error = success
  });
});

describe("transactionMonitor.checkAddress", () => {
  it("returns { received: false } when not connected", async () => {
    // Disconnect first
    await transactionMonitor.disconnect();
    const result = await transactionMonitor.checkAddress("bchtest:q1");
    expect(result.received).toBe(false);
  });
});

describe("transactionMonitor.processPayment", () => {
  it("creates transaction record for new payment", async () => {
    await transactionMonitor.watchAddress("bchtest:qpay1", "pl1", "m1", 50000n);

    prismaMock.transaction.findUnique.mockResolvedValue(null);
    prismaMock.transaction.create.mockResolvedValue(transactionFixture());
    prismaMock.paymentLink.findUnique.mockResolvedValue(
      paymentLinkFixture({ type: "MULTI" })
    );

    await transactionMonitor.processPayment("bchtest:qpay1", "txhash1", 50000n, 1);

    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tx_hash: "txhash1",
          status: "CONFIRMED",
        }),
      })
    );
  });

  it("skips duplicate transactions", async () => {
    await transactionMonitor.watchAddress("bchtest:qpay2", "pl2", "m1", 50000n);
    prismaMock.transaction.findUnique.mockResolvedValue(
      transactionFixture({ confirmations: 1 })
    );

    await transactionMonitor.processPayment("bchtest:qpay2", "txhash1", 50000n, 1);
    expect(prismaMock.transaction.create).not.toHaveBeenCalled();
  });

  it("updates confirmations for existing transaction", async () => {
    await transactionMonitor.watchAddress("bchtest:qpay3", "pl3", "m1", 50000n);
    prismaMock.transaction.findUnique.mockResolvedValue(
      transactionFixture({ confirmations: 0 })
    );
    prismaMock.transaction.update.mockResolvedValue(transactionFixture({ confirmations: 1 }));

    await transactionMonitor.processPayment("bchtest:qpay3", "txhash1", 50000n, 1);
    expect(prismaMock.transaction.update).toHaveBeenCalled();
  });

  it("deactivates SINGLE payment link after payment", async () => {
    await transactionMonitor.watchAddress("bchtest:qpay4", "pl4", "m1", 50000n);
    prismaMock.transaction.findUnique.mockResolvedValue(null);
    prismaMock.transaction.create.mockResolvedValue(transactionFixture());
    prismaMock.paymentLink.findUnique.mockResolvedValue(
      paymentLinkFixture({ type: "SINGLE" })
    );
    prismaMock.paymentLink.update.mockResolvedValue(
      paymentLinkFixture({ status: "INACTIVE" })
    );

    await transactionMonitor.processPayment("bchtest:qpay4", "txhash2", 50000n, 1);
    expect(prismaMock.paymentLink.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "INACTIVE" } })
    );
  });

  it("accepts small 0-conf payments as CONFIRMED", async () => {
    await transactionMonitor.watchAddress("bchtest:qpay5", "pl5", "m1", 1000n);
    prismaMock.transaction.findUnique.mockResolvedValue(null);
    prismaMock.transaction.create.mockResolvedValue(transactionFixture());
    prismaMock.paymentLink.findUnique.mockResolvedValue(
      paymentLinkFixture({ type: "MULTI" })
    );

    await transactionMonitor.processPayment("bchtest:qpay5", "txhash3", 1000n, 0);
    expect(prismaMock.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CONFIRMED" }),
      })
    );
  });

  it("does nothing for unwatched address", async () => {
    await transactionMonitor.processPayment("bchtest:qunknown", "tx", 1000n, 1);
    expect(prismaMock.transaction.findUnique).not.toHaveBeenCalled();
  });
});

describe("transactionMonitor.loadActivePaymentLinks", () => {
  it("loads active links from database", async () => {
    prismaMock.paymentLink.findMany.mockResolvedValue([
      paymentLinkFixture({ payment_address: "bchtest:qloaded1" }),
    ]);

    await transactionMonitor.loadActivePaymentLinks();
    expect(prismaMock.paymentLink.findMany).toHaveBeenCalled();
  });

  it("handles empty results", async () => {
    prismaMock.paymentLink.findMany.mockResolvedValue([]);
    await transactionMonitor.loadActivePaymentLinks();
    // No error
  });
});

describe("transactionMonitor.loadActiveContracts", () => {
  it("loads active contracts from database", async () => {
    prismaMock.contractInstance.findMany.mockResolvedValue([
      contractInstanceFixture(),
    ]);
    await transactionMonitor.loadActiveContracts();
    expect(prismaMock.contractInstance.findMany).toHaveBeenCalled();
  });
});

describe("transactionMonitor.startPolling / disconnect", () => {
  it("starts and stops polling without error", () => {
    transactionMonitor.startPolling(60000);
  });

  it("disconnect cleans up", async () => {
    await transactionMonitor.disconnect();
    // No error = success
  });
});
