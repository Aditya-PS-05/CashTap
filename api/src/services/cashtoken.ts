import { prisma } from "../lib/prisma.js";

/**
 * CashToken service for managing merchant loyalty tokens and receipt NFTs.
 *
 * CashTokens are native BCH protocol tokens (not smart contracts on top).
 * - Fungible Tokens (FTs): used for loyalty/reward points
 * - Non-Fungible Tokens (NFTs): used for payment receipts
 *
 * Token operations require mainnet-js with CashToken support.
 * BCMR (Bitcoin Cash Metadata Registries) is used for token metadata.
 */

// BCMR metadata schema for token registration
interface BCMRIdentity {
  name: string;
  description: string;
  token: {
    category: string;
    symbol: string;
    decimals: number;
  };
  uris?: {
    icon?: string;
    web?: string;
  };
}

class CashTokenService {
  /**
   * Create a new fungible loyalty token for a merchant.
   * This mints a genesis transaction that creates the token category.
   */
  async createLoyaltyToken(
    merchantId: string,
    name: string,
    symbol: string,
    decimals: number = 0,
    initialSupply: bigint = 1_000_000_000n
  ): Promise<{
    tokenCategory: string;
    txHash: string;
    config: any;
  }> {
    // In production, this would:
    // 1. Create a genesis TX with the merchant's wallet
    // 2. The TXID of the genesis becomes the token category
    // 3. Mint initialSupply tokens
    // 4. Register BCMR metadata

    // For now, generate a placeholder category ID
    const tokenCategory = `${Date.now().toString(16)}${"0".repeat(48)}`.slice(
      0,
      64
    );
    const txHash = tokenCategory; // genesis tx hash = category

    // Store config in DB
    const config = await prisma.cashtokenConfig.create({
      data: {
        merchant_id: merchantId,
        token_category: tokenCategory,
        token_name: name,
        token_symbol: symbol,
        token_decimals: decimals,
        purpose: "LOYALTY",
        active: true,
      },
    });

    console.log(
      `[CashToken] Created loyalty token "${symbol}" for merchant ${merchantId}`
    );
    console.log(`[CashToken] Category: ${tokenCategory}`);

    return { tokenCategory, txHash, config };
  }

  /**
   * Issue loyalty tokens to a customer after a purchase.
   * Rate: configurable tokens per satoshi spent.
   */
  async issueLoyaltyTokens(
    merchantId: string,
    customerAddress: string,
    purchaseAmountSats: bigint
  ): Promise<{
    tokensIssued: bigint;
    txHash: string | null;
    tokenSymbol: string;
  }> {
    // Find active loyalty token config for this merchant
    const config = await prisma.cashtokenConfig.findFirst({
      where: {
        merchant_id: merchantId,
        purpose: "LOYALTY",
        active: true,
      },
    });

    if (!config) {
      return { tokensIssued: 0n, txHash: null, tokenSymbol: "" };
    }

    // Calculate tokens to issue (default: 1 token per 1000 sats)
    const REWARD_RATE = BigInt(process.env.LOYALTY_REWARD_RATE || "1000"); // sats per token
    const tokensToIssue = purchaseAmountSats / REWARD_RATE;

    if (tokensToIssue <= 0n) {
      return {
        tokensIssued: 0n,
        txHash: null,
        tokenSymbol: config.token_symbol,
      };
    }

    // Try wallet transfer, fall back to stub tx hash
    let txHash: string | null = null;
    try {
      const { walletService } = await import("./wallet.js");
      const result = await walletService.sendTokens(
        customerAddress,
        config.token_category,
        tokensToIssue
      );
      txHash = result?.txId || null;
    } catch {
      // Wallet not available — use stub
      txHash = `loyalty_${Date.now().toString(16)}`;
    }

    // Persist issuance to DB
    await prisma.tokenIssuance.create({
      data: {
        config_id: config.id,
        merchant_id: merchantId,
        customer_address: customerAddress,
        amount: tokensToIssue,
        tx_hash: txHash,
      },
    });

    console.log(
      `[CashToken] Issued ${tokensToIssue} ${config.token_symbol} to ${customerAddress.slice(0, 20)}...`
    );

    return {
      tokensIssued: tokensToIssue,
      txHash,
      tokenSymbol: config.token_symbol,
    };
  }

  /**
   * Mint an NFT receipt for a payment transaction.
   * The NFT commitment contains purchase details.
   */
  async mintReceiptNFT(
    merchantId: string,
    customerAddress: string,
    paymentData: {
      txHash: string;
      amountSats: bigint;
      memo?: string;
      timestamp: Date;
    }
  ): Promise<{
    receiptId: string;
    nftCategory: string;
    commitment: string;
    txHash: string | null;
  }> {
    // Find active receipt token config
    const config = await prisma.cashtokenConfig.findFirst({
      where: {
        merchant_id: merchantId,
        purpose: "RECEIPT",
        active: true,
      },
    });

    // Build NFT commitment data (max 40 bytes on-chain)
    // Format: [merchant_id_short(4)] [amount(8)] [timestamp(4)] [memo_hash(4)]
    const commitment = Buffer.alloc(20);
    // First 4 bytes: merchant ID hash
    const merchantHash = Buffer.from(merchantId).slice(0, 4);
    merchantHash.copy(commitment, 0);
    // Next 8 bytes: amount in satoshis (big-endian)
    commitment.writeBigUInt64BE(paymentData.amountSats, 4);
    // Next 4 bytes: unix timestamp
    commitment.writeUInt32BE(
      Math.floor(paymentData.timestamp.getTime() / 1000),
      12
    );
    // Next 4 bytes: memo hash (first 4 bytes of sha256)
    if (paymentData.memo) {
      const crypto = await import("crypto");
      const memoHash = crypto
        .createHash("sha256")
        .update(paymentData.memo)
        .digest();
      memoHash.copy(commitment, 16, 0, 4);
    }

    const commitmentHex = commitment.toString("hex");

    // In production: mint NFT using mainnet-js
    const nftCategory = config?.token_category || `receipt_${Date.now().toString(16)}${"0".repeat(48)}`.slice(0, 64);

    // Try wallet NFT mint, fall back to stub
    let mintTxHash: string | null = null;
    try {
      const { walletService } = await import("./wallet.js");
      const result = await walletService.sendNFT(
        customerAddress,
        nftCategory,
        commitmentHex
      );
      mintTxHash = result?.txId || null;
    } catch {
      mintTxHash = `nft_${Date.now().toString(16)}`;
    }

    // Persist receipt NFT to DB
    const receipt = await prisma.receiptNFT.create({
      data: {
        config_id: config?.id || null,
        merchant_id: merchantId,
        customer_address: customerAddress,
        nft_category: nftCategory,
        commitment: commitmentHex,
        tx_hash: paymentData.txHash,
        mint_tx_hash: mintTxHash,
        amount_satoshis: paymentData.amountSats,
        memo: paymentData.memo || null,
      },
    });

    console.log(
      `[CashToken] Minted receipt NFT for ${paymentData.txHash.slice(0, 12)}... → ${customerAddress.slice(0, 20)}...`
    );

    return {
      receiptId: receipt.id,
      nftCategory,
      commitment: commitmentHex,
      txHash: mintTxHash,
    };
  }

  /**
   * Create a receipt token config for a merchant (enables NFT receipts).
   */
  async enableReceiptNFTs(
    merchantId: string,
    name: string = "Payment Receipt"
  ): Promise<any> {
    const tokenCategory = `receipt_${Date.now().toString(16)}${"0".repeat(48)}`.slice(0, 64);

    const config = await prisma.cashtokenConfig.create({
      data: {
        merchant_id: merchantId,
        token_category: tokenCategory,
        token_name: name,
        token_symbol: "RCPT",
        token_decimals: 0,
        purpose: "RECEIPT",
        active: true,
      },
    });

    console.log(
      `[CashToken] Enabled receipt NFTs for merchant ${merchantId}`
    );
    return config;
  }

  /**
   * Generate BCMR metadata JSON for a token.
   * This should be hosted at a public URL for wallets to discover.
   */
  generateBCMR(config: {
    token_category: string;
    token_name: string;
    token_symbol: string;
    token_decimals: number;
    purpose: string;
  }): BCMRIdentity {
    return {
      name: config.token_name,
      description:
        config.purpose === "LOYALTY"
          ? `Loyalty rewards token for BCH Pay merchants. Earn ${config.token_symbol} with every purchase.`
          : `On-chain payment receipt. Proof of purchase stored as a CashToken NFT.`,
      token: {
        category: config.token_category,
        symbol: config.token_symbol,
        decimals: config.token_decimals,
      },
      uris: {
        web: `https://bchpay.app/token/${config.token_category}`,
      },
    };
  }

  /**
   * Get merchant's token stats with real DB counts.
   */
  async getTokenStats(merchantId: string): Promise<{
    loyaltyTokens: {
      configured: boolean;
      symbol?: string;
      category?: string;
      totalIssued: number;
      issuanceCount: number;
    };
    receiptNFTs: {
      configured: boolean;
      category?: string;
      totalMinted: number;
    };
  }> {
    const loyaltyConfig = await prisma.cashtokenConfig.findFirst({
      where: { merchant_id: merchantId, purpose: "LOYALTY", active: true },
    });

    const receiptConfig = await prisma.cashtokenConfig.findFirst({
      where: { merchant_id: merchantId, purpose: "RECEIPT", active: true },
    });

    // Real aggregate queries
    const issuanceAgg = await prisma.tokenIssuance.aggregate({
      where: { merchant_id: merchantId },
      _sum: { amount: true },
      _count: { id: true },
    });

    const receiptCount = await prisma.receiptNFT.count({
      where: { merchant_id: merchantId },
    });

    return {
      loyaltyTokens: {
        configured: !!loyaltyConfig,
        symbol: loyaltyConfig?.token_symbol,
        category: loyaltyConfig?.token_category,
        totalIssued: Number(issuanceAgg._sum.amount || 0),
        issuanceCount: issuanceAgg._count.id,
      },
      receiptNFTs: {
        configured: !!receiptConfig,
        category: receiptConfig?.token_category,
        totalMinted: receiptCount,
      },
    };
  }

  /**
   * Redeem loyalty tokens (records a negative issuance).
   */
  async redeemLoyaltyTokens(
    merchantId: string,
    customerAddress: string,
    amount: bigint,
    description?: string
  ): Promise<{
    redeemed: bigint;
    txHash: string | null;
    tokenSymbol: string;
  }> {
    const config = await prisma.cashtokenConfig.findFirst({
      where: {
        merchant_id: merchantId,
        purpose: "LOYALTY",
        active: true,
      },
    });

    if (!config) {
      return { redeemed: 0n, txHash: null, tokenSymbol: "" };
    }

    const txHash = `redeem_${Date.now().toString(16)}`;

    // Record negative amount for redemption
    await prisma.tokenIssuance.create({
      data: {
        config_id: config.id,
        merchant_id: merchantId,
        customer_address: customerAddress,
        amount: -amount,
        tx_hash: txHash,
      },
    });

    console.log(
      `[CashToken] Redeemed ${amount} ${config.token_symbol} from ${customerAddress.slice(0, 20)}...`
    );

    return {
      redeemed: amount,
      txHash,
      tokenSymbol: config.token_symbol,
    };
  }

  /**
   * Get comprehensive analytics for a merchant's CashToken activity.
   */
  async getAnalytics(merchantId: string): Promise<{
    stats: Awaited<ReturnType<CashTokenService["getTokenStats"]>>;
    recentIssuances: any[];
    recentReceipts: any[];
    topHolders: { customerAddress: string; totalTokens: bigint }[];
    redemptionRate: number;
  }> {
    const stats = await this.getTokenStats(merchantId);

    const recentIssuances = await prisma.tokenIssuance.findMany({
      where: { merchant_id: merchantId },
      orderBy: { created_at: "desc" },
      take: 10,
    });

    const recentReceipts = await prisma.receiptNFT.findMany({
      where: { merchant_id: merchantId },
      orderBy: { created_at: "desc" },
      take: 10,
    });

    // Top holders by customer address
    const holderGroups = await prisma.tokenIssuance.groupBy({
      by: ["customer_address"],
      where: { merchant_id: merchantId },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    });

    const topHolders = holderGroups.map((g) => ({
      customerAddress: g.customer_address,
      totalTokens: g._sum.amount || 0n,
    }));

    // Redemption rate: negative issuances / total positive issuances
    const totalPositive = await prisma.tokenIssuance.aggregate({
      where: { merchant_id: merchantId, amount: { gt: 0 } },
      _sum: { amount: true },
    });
    const totalNegative = await prisma.tokenIssuance.aggregate({
      where: { merchant_id: merchantId, amount: { lt: 0 } },
      _sum: { amount: true },
    });

    const positiveSum = Number(totalPositive._sum.amount || 0);
    const negativeSum = Math.abs(Number(totalNegative._sum.amount || 0));
    const redemptionRate = positiveSum > 0 ? negativeSum / positiveSum : 0;

    return {
      stats,
      recentIssuances,
      recentReceipts,
      topHolders,
      redemptionRate,
    };
  }

  /**
   * Get a single receipt NFT by ID (public).
   */
  async getReceipt(receiptId: string): Promise<any | null> {
    return prisma.receiptNFT.findUnique({
      where: { id: receiptId },
      include: { merchant: true },
    });
  }
}

export const cashTokenService = new CashTokenService();
