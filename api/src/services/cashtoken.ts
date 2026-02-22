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

    // In production: build a TX that sends fungible CashTokens to customerAddress
    // Using mainnet-js: wallet.send([{ cashaddr: customerAddress, value: 546, token: { category, amount: tokensToIssue } }])
    const txHash = `loyalty_${Date.now().toString(16)}`;

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
    // wallet.send([{ cashaddr: customerAddress, value: 546, token: { category, commitment: commitmentHex, capability: "none" } }])
    const nftCategory = config?.token_category || `receipt_${Date.now().toString(16)}${"0".repeat(48)}`.slice(0, 64);
    const mintTxHash = `nft_${Date.now().toString(16)}`;

    console.log(
      `[CashToken] Minted receipt NFT for ${paymentData.txHash.slice(0, 12)}... → ${customerAddress.slice(0, 20)}...`
    );

    return {
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
   * Get merchant's token stats.
   */
  async getTokenStats(merchantId: string): Promise<{
    loyaltyTokens: {
      configured: boolean;
      symbol?: string;
      totalIssued: number;
    };
    receiptNFTs: {
      configured: boolean;
      totalMinted: number;
    };
  }> {
    const loyaltyConfig = await prisma.cashtokenConfig.findFirst({
      where: { merchant_id: merchantId, purpose: "LOYALTY", active: true },
    });

    const receiptConfig = await prisma.cashtokenConfig.findFirst({
      where: { merchant_id: merchantId, purpose: "RECEIPT", active: true },
    });

    return {
      loyaltyTokens: {
        configured: !!loyaltyConfig,
        symbol: loyaltyConfig?.token_symbol,
        totalIssued: 0, // TODO: track in a separate table
      },
      receiptNFTs: {
        configured: !!receiptConfig,
        totalMinted: 0, // TODO: track in a separate table
      },
    };
  }
}

export const cashTokenService = new CashTokenService();
