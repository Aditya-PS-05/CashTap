/**
 * Global test setup — runs before every test file.
 * Mocks external dependencies so tests are fully isolated.
 */
import { vi, beforeEach } from "vitest";
import { prismaMock, resetPrismaMock } from "./helpers/mock-prisma.js";

// ---------------------------------------------------------------------------
// Mock: Prisma
// ---------------------------------------------------------------------------
vi.mock("../src/lib/prisma.js", () => ({
  prisma: prismaMock,
}));

// ---------------------------------------------------------------------------
// Mock: contractService (static import in routes/contracts.ts)
// ---------------------------------------------------------------------------
vi.mock("../src/services/contracts.js", () => ({
  contractService: {
    getAllContractTypes: vi.fn().mockReturnValue([
      { type: "PAYMENT_GATEWAY", contractName: "PaymentGateway", constructorInputs: [], abi: [] },
      { type: "ESCROW", contractName: "Escrow", constructorInputs: [], abi: [] },
      { type: "SPLIT_PAYMENT", contractName: "SplitPayment", constructorInputs: [], abi: [] },
      { type: "SAVINGS_VAULT", contractName: "SavingsVault", constructorInputs: [], abi: [] },
    ]),
    createEscrow: vi.fn().mockReturnValue({
      address: "bchtest:pzmockescrow000000000000000000000000000000000",
      tokenAddress: "bchtest:zzmockescrow000000000000000000000000000000000",
    }),
    createSplitPayment: vi.fn().mockReturnValue({
      address: "bchtest:pzmocksplit0000000000000000000000000000000000",
      tokenAddress: "bchtest:zzmocksplit0000000000000000000000000000000000",
    }),
    createSavingsVault: vi.fn().mockReturnValue({
      address: "bchtest:pzmockvault000000000000000000000000000000000",
      tokenAddress: "bchtest:zzmockvault000000000000000000000000000000000",
    }),
    getContractInfo: vi.fn(),
    getPaymentGatewayAddress: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock: walletService (dynamic import in routes)
// ---------------------------------------------------------------------------
vi.mock("../src/services/wallet.js", () => ({
  walletService: {
    isInitialised: vi.fn().mockReturnValue(false),
    initMasterWallet: vi.fn(),
    getAddress: vi.fn(),
    getBalance: vi.fn(),
    derivePaymentAddress: vi.fn(),
    getNextDerivationIndex: vi.fn(),
    sendBch: vi.fn(),
    sendTokens: vi.fn(),
    sendNFT: vi.fn(),
    sendBchWithTokens: vi.fn(),
    checkAddressBalance: vi.fn(),
    generatePaymentURI: vi.fn(),
    getTokenBalance: vi.fn(),
    getAllTokenBalances: vi.fn(),
    getTokenUtxos: vi.fn(),
    getWalletInfo: vi.fn(),
    getNetwork: vi.fn().mockReturnValue("chipnet"),
  },
}));

// ---------------------------------------------------------------------------
// Mock: transactionMonitor (dynamic import in routes)
// ---------------------------------------------------------------------------
vi.mock("../src/services/monitor.js", () => ({
  transactionMonitor: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    watchAddress: vi.fn(),
    watchContractAddress: vi.fn(),
    unwatch: vi.fn(),
    checkAddress: vi.fn(),
    processPayment: vi.fn(),
    pollAll: vi.fn(),
    startPolling: vi.fn(),
    loadActivePaymentLinks: vi.fn(),
    loadActiveContracts: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock: webhookService (dynamic import in routes)
// ---------------------------------------------------------------------------
vi.mock("../src/services/webhook.js", () => ({
  webhookService: {
    deliver: vi.fn(),
    sendTest: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock: pushService (dynamic import in routes)
// ---------------------------------------------------------------------------
vi.mock("../src/services/push.js", () => ({
  pushService: {
    sendToMerchant: vi.fn().mockResolvedValue({ sent: 1, failed: 0 }),
    notifyPaymentReceived: vi.fn(),
    notifyPaymentLinkUsed: vi.fn(),
    sendTest: vi.fn().mockResolvedValue({ success: true, sent: 1 }),
  },
}));

// ---------------------------------------------------------------------------
// Reset all mocks between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  resetPrismaMock();
  vi.clearAllMocks();
});
