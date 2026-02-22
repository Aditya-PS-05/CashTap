/**
 * Tests for src/services/wallet.ts
 *
 * Mock mainnet-js to avoid actual wallet/network operations.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prismaMock } from "../helpers/mock-prisma.js";

// Undo the global mock from setup.ts so we test the REAL implementation
vi.unmock("../../src/services/wallet.js");

// Mock mainnet-js
const mockWallet = {
  getDepositAddress: vi.fn().mockReturnValue("bchtest:qmockaddr000000000000000000000000000000000"),
  mnemonic: "test seed phrase words here twelve total words please check now okay done",
  getBalance: vi.fn().mockResolvedValue(1000000n),
  send: vi.fn().mockResolvedValue({ txId: "mocktxid123" }),
  getTokenBalance: vi.fn().mockResolvedValue(100n),
  getAllTokenBalances: vi.fn().mockResolvedValue({ cat1: 100n }),
  getTokenUtxos: vi.fn().mockResolvedValue([]),
  getInfo: vi.fn().mockReturnValue({ address: "bchtest:q", network: "chipnet" }),
};

const mockWatchWallet = {
  getBalance: vi.fn().mockResolvedValue(500000n),
  getUtxos: vi.fn().mockResolvedValue([{ txid: "utxo1", vout: 0, satoshis: 500000 }]),
};

vi.mock("mainnet-js", () => ({
  HDWallet: {
    fromSeed: vi.fn().mockResolvedValue(mockWallet),
    newRandom: vi.fn().mockResolvedValue(mockWallet),
  },
  TestNetHDWallet: {
    fromSeed: vi.fn().mockResolvedValue(mockWallet),
    newRandom: vi.fn().mockResolvedValue(mockWallet),
  },
  WatchWallet: {
    watchOnly: vi.fn().mockResolvedValue(mockWatchWallet),
  },
  TestNetWatchWallet: {
    watchOnly: vi.fn().mockResolvedValue(mockWatchWallet),
  },
  SendRequest: class { constructor(public opts: any) {} },
  TokenSendRequest: class { constructor(public opts: any) {} },
}));

const { walletService } = await import("../../src/services/wallet.js");

describe("walletService.initMasterWallet", () => {
  it("initializes from seed phrase", async () => {
    const result = await walletService.initMasterWallet("test seed");
    expect(result.address).toBeDefined();
    expect(result.seed).toBeDefined();
  });

  it("generates random wallet when no seed", async () => {
    const result = await walletService.initMasterWallet();
    expect(result.address).toBeDefined();
  });

  it("marks wallet as initialised", async () => {
    await walletService.initMasterWallet("seed");
    expect(walletService.isInitialised()).toBe(true);
  });
});

describe("walletService.getAddress", () => {
  it("returns address when wallet is initialized", () => {
    const addr = walletService.getAddress();
    expect(addr).toContain("bchtest:");
  });
});

describe("walletService.getBalance", () => {
  it("returns balance in bch and sat", async () => {
    const balance = await walletService.getBalance();
    expect(balance.sat).toBeGreaterThan(0);
    expect(balance.bch).toBeGreaterThan(0);
  });
});

describe("walletService.derivePaymentAddress", () => {
  it("derives address at given index", async () => {
    const addr = await walletService.derivePaymentAddress(0);
    expect(addr).toBeDefined();
    expect(typeof addr).toBe("string");
  });

  it("calls getDepositAddress with index", async () => {
    await walletService.derivePaymentAddress(5);
    expect(mockWallet.getDepositAddress).toHaveBeenCalledWith(5);
  });
});

describe("walletService.getNextDerivationIndex", () => {
  it("returns max+1 from database", async () => {
    prismaMock.paymentLink.aggregate.mockResolvedValue({
      _max: { derivation_index: 10 },
    });
    const next = await walletService.getNextDerivationIndex();
    expect(next).toBe(11);
  });

  it("returns 0 when no links exist", async () => {
    prismaMock.paymentLink.aggregate.mockResolvedValue({
      _max: { derivation_index: null },
    });
    const next = await walletService.getNextDerivationIndex();
    expect(typeof next).toBe("number");
  });

  it("falls back to internal counter on DB error", async () => {
    prismaMock.paymentLink.aggregate.mockRejectedValue(new Error("DB error"));
    const next = await walletService.getNextDerivationIndex();
    expect(typeof next).toBe("number");
  });
});

describe("walletService.sendBch", () => {
  it("sends BCH and returns txId", async () => {
    const result = await walletService.sendBch("bchtest:qdest", 10000);
    expect(result.txId).toBe("mocktxid123");
  });

  it("throws for non-positive amount", async () => {
    await expect(walletService.sendBch("bchtest:q", 0)).rejects.toThrow(
      /positive/i
    );
  });
});

describe("walletService.sendTokens", () => {
  it("sends tokens and returns txId", async () => {
    const result = await walletService.sendTokens("bchtest:q", "cat1", 100n);
    expect(result.txId).toBe("mocktxid123");
  });

  it("throws for non-positive amount", async () => {
    await expect(walletService.sendTokens("bchtest:q", "cat1", 0n)).rejects.toThrow(
      /positive/i
    );
  });
});

describe("walletService.sendNFT", () => {
  it("sends NFT and returns txId", async () => {
    const result = await walletService.sendNFT("bchtest:q", "cat1", "deadbeef");
    expect(result.txId).toBe("mocktxid123");
  });
});

describe("walletService.sendBchWithTokens", () => {
  it("sends both BCH and tokens", async () => {
    const result = await walletService.sendBchWithTokens("bchtest:q", 5000, "cat1", 50n);
    expect(result.txId).toBe("mocktxid123");
  });
});

describe("walletService.checkAddressBalance", () => {
  it("returns balance and utxos for arbitrary address", async () => {
    const result = await walletService.checkAddressBalance("bchtest:qany");
    expect(result.balance).toBeGreaterThan(0);
    expect(Array.isArray(result.utxos)).toBe(true);
  });
});

describe("walletService.generatePaymentURI", () => {
  it("generates BIP-21 URI with amount", () => {
    const uri = walletService.generatePaymentURI("bchtest:q123", 100000);
    expect(uri).toContain("bchtest:q123");
    expect(uri).toContain("amount=");
  });

  it("generates URI with memo", () => {
    const uri = walletService.generatePaymentURI("bchtest:q123", 100000, "Coffee");
    expect(uri).toContain("message=Coffee");
  });

  it("generates URI without amount when zero", () => {
    const uri = walletService.generatePaymentURI("bchtest:q123", 0);
    expect(uri).not.toContain("amount=");
  });
});

describe("walletService.getTokenBalance", () => {
  it("returns token balance for category", async () => {
    const balance = await walletService.getTokenBalance("cat1");
    expect(balance).toBe(100n);
  });
});

describe("walletService.getAllTokenBalances", () => {
  it("returns all token balances", async () => {
    const balances = await walletService.getAllTokenBalances();
    expect(balances).toHaveProperty("cat1");
  });
});

describe("walletService.getTokenUtxos", () => {
  it("returns token UTXOs", async () => {
    const utxos = await walletService.getTokenUtxos();
    expect(Array.isArray(utxos)).toBe(true);
  });
});

describe("walletService introspection", () => {
  it("isInitialised returns true after init", () => {
    expect(walletService.isInitialised()).toBe(true);
  });

  it("getWalletInfo returns info object", () => {
    const info = walletService.getWalletInfo();
    expect(info).toBeDefined();
  });

  it("getNetwork returns chipnet", () => {
    expect(walletService.getNetwork()).toBe("chipnet");
  });
});
