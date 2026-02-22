/**
 * Tests for src/services/contracts.ts
 *
 * The module imports CashScript and JSON artifacts.
 * We mock cashscript to avoid network calls and artifact parsing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Undo the global mock from setup.ts so we test the REAL implementation
vi.unmock("../../src/services/contracts.js");

// Mock cashscript before importing the module under test
vi.mock("cashscript", () => {
  class MockContract {
    address: string;
    tokenAddress: string;
    constructor(_artifact: any, _args: any, _opts: any) {
      this.address = "bchtest:pzmockaddr000000000000000000000000000000000";
      this.tokenAddress = "bchtest:zzmockaddr000000000000000000000000000000000";
    }
  }

  return {
    ElectrumNetworkProvider: vi.fn(),
    Contract: MockContract,
  };
});

// Mock the JSON artifact imports
vi.mock("../../src/contracts/payment-gateway.json", () => ({
  default: { contractName: "PaymentGateway", constructorInputs: [{ name: "merchantPkh", type: "bytes20" }], abi: [] },
}));
vi.mock("../../src/contracts/escrow.json", () => ({
  default: { contractName: "Escrow", constructorInputs: [], abi: [] },
}));
vi.mock("../../src/contracts/split-payment.json", () => ({
  default: { contractName: "SplitPayment", constructorInputs: [], abi: [] },
}));
vi.mock("../../src/contracts/savings-vault.json", () => ({
  default: { contractName: "SavingsVault", constructorInputs: [], abi: [] },
}));

// Now import — the mocks are already in place
const mod = await import("../../src/services/contracts.js");
const { contractService } = mod;

describe("contractService", () => {
  describe("getAllContractTypes", () => {
    it("returns 4 contract types", () => {
      const types = contractService.getAllContractTypes();
      expect(types).toHaveLength(4);
      const names = types.map((t) => t.type);
      expect(names).toContain("PAYMENT_GATEWAY");
      expect(names).toContain("ESCROW");
      expect(names).toContain("SPLIT_PAYMENT");
      expect(names).toContain("SAVINGS_VAULT");
    });

    it("each type has contractName and abi", () => {
      const types = contractService.getAllContractTypes();
      for (const t of types) {
        expect(t.contractName).toBeDefined();
        expect(t.abi).toBeDefined();
      }
    });
  });

  describe("getContractInfo", () => {
    it("returns info for ESCROW", () => {
      const info = contractService.getContractInfo("ESCROW");
      expect(info.contractName).toBe("Escrow");
    });
  });

  describe("getPaymentGatewayAddress", () => {
    it("returns address and tokenAddress", () => {
      const result = contractService.getPaymentGatewayAddress("0".repeat(40));
      expect(result.address).toBeDefined();
      expect(result.tokenAddress).toBeDefined();
    });
  });

  describe("createEscrow", () => {
    it("returns address and tokenAddress", () => {
      const result = contractService.createEscrow("a".repeat(40), "b".repeat(40), "c".repeat(40), 1000n);
      expect(result.address).toBeDefined();
      expect(result.tokenAddress).toBeDefined();
    });
  });

  describe("createSplitPayment", () => {
    it("returns address and tokenAddress", () => {
      const result = contractService.createSplitPayment("a".repeat(40), "b".repeat(40), 60n, 40n);
      expect(result.address).toBeDefined();
      expect(result.tokenAddress).toBeDefined();
    });
  });

  describe("createSavingsVault", () => {
    it("returns address and tokenAddress", () => {
      const result = contractService.createSavingsVault("a".repeat(40), 999999n);
      expect(result.address).toBeDefined();
      expect(result.tokenAddress).toBeDefined();
    });
  });
});
