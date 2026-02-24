import {
  HDWallet,
  TestNetHDWallet,
  WatchWallet,
  TestNetWatchWallet,
  SendRequest,
  TokenSendRequest,
} from "mainnet-js";
import type { Utxo } from "mainnet-js";
import { prisma } from "../lib/prisma.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const NETWORK = process.env.BCH_NETWORK || "chipnet"; // "mainnet" or "chipnet"
const HDWalletClass = NETWORK === "mainnet" ? HDWallet : TestNetHDWallet;
const WatchWalletClass =
  NETWORK === "mainnet" ? WatchWallet : TestNetWatchWallet;

// ---------------------------------------------------------------------------
// WalletService
// ---------------------------------------------------------------------------

class WalletService {
  private masterWallet: InstanceType<typeof HDWallet> | null = null;
  private derivationCounter: number = 0;

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  /**
   * Initialize (or restore) the master HD wallet.
   *
   * - When a `seedPhrase` is supplied the wallet is restored from that mnemonic.
   * - Otherwise a brand-new random wallet is generated.
   *
   * The wallet uses the HD derivation path so that each payment link can
   * receive funds on its own unique address via `derivePaymentAddress(index)`.
   *
   * @returns The primary deposit address and the BIP-39 seed phrase.
   */
  async initMasterWallet(
    seedPhrase?: string
  ): Promise<{ address: string; seed: string }> {
    try {
      if (seedPhrase) {
        this.masterWallet = (await HDWalletClass.fromSeed(
          seedPhrase
        )) as InstanceType<typeof HDWallet>;
      } else {
        this.masterWallet = (await HDWalletClass.newRandom()) as InstanceType<
          typeof HDWallet
        >;
      }

      const address = this.masterWallet.getDepositAddress();
      const seed = this.masterWallet.mnemonic;

      console.log(
        `[WalletService] Master wallet initialised on ${NETWORK}: ${address}`
      );

      return { address, seed };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[WalletService] Failed to initialise master wallet: ${message}`
      );
      throw new Error(`Wallet initialisation failed: ${message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Address helpers
  // -------------------------------------------------------------------------

  /**
   * Return the primary deposit address of the master wallet, or `null` if the
   * wallet has not been initialised yet.
   */
  getAddress(): string | null {
    try {
      return this.masterWallet?.getDepositAddress() ?? null;
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Balance
  // -------------------------------------------------------------------------

  /**
   * Query the balance of the master wallet.
   *
   * @returns An object with `bch` (floating-point BCH) and `sat` (integer
   *          satoshis) representations of the confirmed balance.
   */
  async getBalance(): Promise<{ bch: number; sat: number }> {
    if (!this.masterWallet) {
      throw new Error("Master wallet not initialised");
    }

    try {
      const balanceSat = await this.masterWallet.getBalance();
      const sat = Number(balanceSat);
      const bch = sat / 100_000_000;

      return { bch, sat };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[WalletService] Failed to fetch balance: ${message}`
      );
      throw new Error(`Balance query failed: ${message}`);
    }
  }

  // -------------------------------------------------------------------------
  // HD Derivation
  // -------------------------------------------------------------------------

  /**
   * Derive a unique payment address for a payment link.
   *
   * Uses the HD wallet's built-in `getDepositAddress(index)` which generates
   * addresses along the derivation path `m/44'/145'/0'/0/<index>` (chipnet)
   * or `m/44'/0'/0'/0/<index>` (mainnet).
   *
   * If the HD wallet does not support indexed derivation (fallback), a
   * deterministic watch-only wallet is created from the master seed combined
   * with the index.
   *
   * @param index  The derivation index (typically the payment-link row counter).
   * @returns      A cash-address string unique to this index.
   */
  async derivePaymentAddress(index: number): Promise<string> {
    if (!this.masterWallet) {
      throw new Error("Master wallet not initialised");
    }

    try {
      // HDWallet.getDepositAddress(index) returns the address at the given
      // deposit derivation index.
      const address = this.masterWallet.getDepositAddress(index);
      return address;
    } catch (primaryError) {
      // Fallback: derive via fromSeed with a custom derivation path that
      // includes the index, producing a deterministic unique address.
      console.warn(
        `[WalletService] Indexed getDepositAddress failed, using seed derivation fallback for index ${index}`
      );

      try {
        const derivationPath = `m/44'/145'/0'/0/${index}`;
        const seed = this.masterWallet.mnemonic;

        if (!seed) {
          throw new Error("Master wallet has no mnemonic for fallback derivation");
        }

        const childWallet = await HDWalletClass.fromSeed(seed, derivationPath);
        const address = childWallet.getDepositAddress();
        return address;
      } catch (fallbackError) {
        const message =
          fallbackError instanceof Error
            ? fallbackError.message
            : "Unknown error";
        throw new Error(
          `Address derivation failed for index ${index}: ${message}`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Derivation index management
  // -------------------------------------------------------------------------

  /**
   * Determine the next available derivation index.
   *
   * Queries the `payment_links` table for the maximum `derivation_index`
   * already in use and returns max + 1. Falls back to an internal counter
   * when the database query fails.
   */
  async getNextDerivationIndex(): Promise<number> {
    try {
      const result = await prisma.paymentLink.aggregate({
        _max: { derivation_index: true },
      });

      const maxIndex = result._max.derivation_index;

      if (maxIndex !== null && maxIndex !== undefined) {
        const next = maxIndex + 1;
        // Keep internal counter in sync
        this.derivationCounter = Math.max(this.derivationCounter, next);
        return next;
      }
    } catch (error) {
      console.warn(
        "[WalletService] DB query for derivation index failed, using internal counter"
      );
    }

    // Fallback: use and increment internal counter
    return this.derivationCounter++;
  }

  // -------------------------------------------------------------------------
  // Sending BCH
  // -------------------------------------------------------------------------

  /**
   * Build, sign and broadcast a BCH transaction.
   *
   * @param toAddress       Destination cash-address.
   * @param amountSatoshis  Amount to send in satoshis.
   * @returns               The broadcast transaction hash.
   */
  async sendBch(
    toAddress: string,
    amountSatoshis: number
  ): Promise<{ txId: string }> {
    if (!this.masterWallet) {
      throw new Error("Master wallet not initialised");
    }

    if (amountSatoshis <= 0) {
      throw new Error("Amount must be a positive number of satoshis");
    }

    try {
      const sendRequest = new SendRequest({
        cashaddr: toAddress,
        value: BigInt(amountSatoshis),
      });

      const response = await this.masterWallet.send([sendRequest]);

      if (!response.txId) {
        throw new Error("Transaction broadcast succeeded but no txId was returned");
      }

      console.log(
        `[WalletService] Sent ${amountSatoshis} sat to ${toAddress} — txId: ${response.txId}`
      );

      return { txId: response.txId };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[WalletService] sendBch failed: ${message}`);
      throw new Error(`Send transaction failed: ${message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Address balance inspection
  // -------------------------------------------------------------------------

  /**
   * Check the balance and UTXOs of an arbitrary address.
   *
   * Creates a temporary watch-only wallet for the given address and queries
   * the network via the Electrum provider.
   *
   * @param address  The cash-address to inspect.
   * @returns        Balance in satoshis and the raw UTXO set.
   */
  async checkAddressBalance(
    address: string
  ): Promise<{ balance: number; utxos: Utxo[] }> {
    try {
      const watchWallet = await WatchWalletClass.watchOnly(address);

      const [balanceBigInt, utxos] = await Promise.all([
        watchWallet.getBalance(),
        watchWallet.getUtxos(),
      ]);

      const balance = Number(balanceBigInt);

      return { balance, utxos };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[WalletService] checkAddressBalance failed for ${address}: ${message}`
      );

      // Return zero balance rather than throwing — the caller can decide
      // whether an error is fatal.
      return { balance: 0, utxos: [] };
    }
  }

  // -------------------------------------------------------------------------
  // BIP-21 Payment URI
  // -------------------------------------------------------------------------

  /**
   * Generate a BIP-21 payment URI.
   *
   * Format: `<address>?amount=<bch>&message=<memo>`
   *
   * The `amount` parameter is denominated in BCH (not satoshis) per BIP-21.
   * Trailing zeros are stripped for readability.
   *
   * @param address         Cash-address of the recipient.
   * @param amountSatoshis  Requested payment amount in satoshis.
   * @param memo            Optional human-readable payment description.
   * @returns               A fully-formed BIP-21 URI string.
   */
  generatePaymentURI(
    address: string,
    amountSatoshis: number,
    memo?: string
  ): string {
    const params = new URLSearchParams();

    if (amountSatoshis > 0) {
      const amountBch = amountSatoshis / 100_000_000;
      // Strip unnecessary trailing zeros while keeping at least one decimal
      const formatted = amountBch
        .toFixed(8)
        .replace(/0+$/, "")
        .replace(/\.$/, "");
      params.set("amount", formatted);
    }

    if (memo) {
      params.set("message", memo);
    }

    const qs = params.toString();
    return `${address}${qs ? "?" + qs : ""}`;
  }

  // -------------------------------------------------------------------------
  // CashToken transfers
  // -------------------------------------------------------------------------

  /**
   * Send fungible CashTokens to an address.
   *
   * @param toAddress       Destination cash-address.
   * @param tokenCategory   The token category (genesis txid).
   * @param amount          Number of fungible tokens to send.
   * @returns               The broadcast transaction hash.
   */
  async sendTokens(
    toAddress: string,
    tokenCategory: string,
    amount: bigint
  ): Promise<{ txId: string }> {
    if (!this.masterWallet) {
      throw new Error("Master wallet not initialised");
    }

    if (amount <= 0n) {
      throw new Error("Token amount must be positive");
    }

    try {
      const tokenRequest = new TokenSendRequest({
        cashaddr: toAddress,
        category: tokenCategory,
        amount,
      });

      const response = await this.masterWallet.send([tokenRequest]);

      if (!response.txId) {
        throw new Error("Token transfer broadcast succeeded but no txId returned");
      }

      console.log(
        `[WalletService] Sent ${amount} tokens (${tokenCategory.slice(0, 12)}...) to ${toAddress}`
      );

      return { txId: response.txId };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[WalletService] sendTokens failed: ${message}`);
      throw new Error(`Token transfer failed: ${message}`);
    }
  }

  /**
   * Send an NFT (non-fungible CashToken) to an address.
   *
   * @param toAddress       Destination cash-address.
   * @param tokenCategory   The NFT token category.
   * @param commitment      Hex-encoded NFT commitment data.
   * @param capability      NFT capability: "none", "mutable", or "minting".
   * @returns               The broadcast transaction hash.
   */
  async sendNFT(
    toAddress: string,
    tokenCategory: string,
    commitment: string,
    capability: "none" | "mutable" | "minting" = "none"
  ): Promise<{ txId: string }> {
    if (!this.masterWallet) {
      throw new Error("Master wallet not initialised");
    }

    try {
      const tokenRequest = new TokenSendRequest({
        cashaddr: toAddress,
        category: tokenCategory,
        amount: 0n,
        nft: {
          capability,
          commitment,
        },
      });

      const response = await this.masterWallet.send([tokenRequest]);

      if (!response.txId) {
        throw new Error("NFT transfer broadcast succeeded but no txId returned");
      }

      console.log(
        `[WalletService] Sent NFT (${tokenCategory.slice(0, 12)}...) to ${toAddress}`
      );

      return { txId: response.txId };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[WalletService] sendNFT failed: ${message}`);
      throw new Error(`NFT transfer failed: ${message}`);
    }
  }

  /**
   * Send BCH and fungible CashTokens together in a single transaction.
   *
   * @param toAddress       Destination cash-address.
   * @param amountSatoshis  BCH amount in satoshis.
   * @param tokenCategory   The token category.
   * @param tokenAmount     Number of fungible tokens to send.
   * @returns               The broadcast transaction hash.
   */
  async sendBchWithTokens(
    toAddress: string,
    amountSatoshis: number,
    tokenCategory: string,
    tokenAmount: bigint
  ): Promise<{ txId: string }> {
    if (!this.masterWallet) {
      throw new Error("Master wallet not initialised");
    }

    try {
      const requests: (SendRequest | TokenSendRequest)[] = [];

      if (amountSatoshis > 0) {
        requests.push(
          new SendRequest({
            cashaddr: toAddress,
            value: BigInt(amountSatoshis),
          })
        );
      }

      if (tokenAmount > 0n) {
        requests.push(
          new TokenSendRequest({
            cashaddr: toAddress,
            category: tokenCategory,
            amount: tokenAmount,
          })
        );
      }

      if (requests.length === 0) {
        throw new Error("Must specify either BCH amount or token amount");
      }

      const response = await this.masterWallet.send(requests);

      if (!response.txId) {
        throw new Error("Broadcast succeeded but no txId returned");
      }

      console.log(
        `[WalletService] Sent ${amountSatoshis} sat + ${tokenAmount} tokens to ${toAddress}`
      );

      return { txId: response.txId };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[WalletService] sendBchWithTokens failed: ${message}`);
      throw new Error(`Combined transfer failed: ${message}`);
    }
  }

  /**
   * Get the fungible token balance for a specific category.
   */
  async getTokenBalance(tokenCategory: string): Promise<bigint> {
    if (!this.masterWallet) {
      throw new Error("Master wallet not initialised");
    }

    try {
      return await this.masterWallet.getTokenBalance(tokenCategory);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[WalletService] getTokenBalance failed: ${message}`);
      return 0n;
    }
  }

  /**
   * Get all fungible token balances held by the wallet.
   */
  async getAllTokenBalances(): Promise<Record<string, bigint>> {
    if (!this.masterWallet) {
      throw new Error("Master wallet not initialised");
    }

    try {
      return await this.masterWallet.getAllTokenBalances();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[WalletService] getAllTokenBalances failed: ${message}`);
      return {};
    }
  }

  /**
   * Get token-bearing UTXOs, optionally filtered by category.
   */
  async getTokenUtxos(tokenCategory?: string): Promise<Utxo[]> {
    if (!this.masterWallet) {
      throw new Error("Master wallet not initialised");
    }

    try {
      return await this.masterWallet.getTokenUtxos(tokenCategory);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[WalletService] getTokenUtxos failed: ${message}`);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Raw transaction broadcast
  // -------------------------------------------------------------------------

  /**
   * Broadcast a raw signed transaction hex to the network.
   *
   * @param rawTxHex  The fully-signed raw transaction in hex format.
   * @returns         The transaction ID.
   */
  async broadcastRawTransaction(
    rawTxHex: string,
    senderAddress?: string
  ): Promise<string> {
    try {
      // Use masterWallet if initialized, otherwise create a watch wallet
      // (ElectrumNetworkProvider.connect() is broken in this mainnet-js version,
      //  but wallet instances get working Electrum connections)
      if (this.masterWallet) {
        const txId = await this.masterWallet.submitTransaction(
          Uint8Array.from(Buffer.from(rawTxHex, "hex"))
        );
        console.log(`[WalletService] Broadcast tx: ${txId}`);
        return txId;
      }

      if (!senderAddress) {
        throw new Error("No wallet available for broadcasting — provide sender_address");
      }

      const watchWallet = await WatchWalletClass.watchOnly(senderAddress);
      const txId = await watchWallet.submitTransaction(
        Uint8Array.from(Buffer.from(rawTxHex, "hex"))
      );
      console.log(`[WalletService] Broadcast tx: ${txId}`);
      return txId;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`[WalletService] broadcastRawTransaction failed: ${message}`);
      throw new Error(`Broadcast failed: ${message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Introspection helpers
  // -------------------------------------------------------------------------

  /**
   * Whether the master wallet has been initialised and is ready for use.
   */
  isInitialised(): boolean {
    return this.masterWallet !== null;
  }

  /**
   * Return the wallet info object from mainnet-js (address, network, seed,
   * derivation path, etc.).  Returns `null` when the wallet is not yet
   * initialised.
   */
  getWalletInfo(): Record<string, unknown> | null {
    if (!this.masterWallet) {
      return null;
    }

    try {
      return this.masterWallet.getInfo() as unknown as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /**
   * Return the current network label ("mainnet" or "chipnet").
   */
  getNetwork(): string {
    return NETWORK;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const walletService = new WalletService();
