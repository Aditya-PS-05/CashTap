// BCH Transaction Monitor Service
// Watches BCH addresses for incoming payments using the ElectrumX/Fulcrum protocol.
// Uses the electrum-cash library for connecting to Fulcrum/ElectrumX servers.

// @ts-ignore -- electrum-cash types exist but package.json "exports" doesn't expose them
import { ElectrumClient, ElectrumTransport } from "electrum-cash";
import { prisma } from "../lib/prisma.js";

const NETWORK = process.env.BCH_NETWORK || "chipnet";

// Public Fulcrum electrum servers (SSL/WSS on port 50004)
const ELECTRUM_SERVERS = {
  chipnet: { host: "chipnet.imaginary.cash", port: 50004 },
  mainnet: { host: "electrum.imaginary.cash", port: 50004 },
};

// 0-conf threshold: payments at or below this amount (in satoshis) are accepted
// immediately with zero confirmations. Default: 0.05 BCH = 5,000,000 sats.
const ZERO_CONF_THRESHOLD = BigInt(
  process.env.ZERO_CONF_THRESHOLD_SATS || "5000000"
);

interface WatchInfo {
  paymentLinkId: string;
  merchantId: string;
  expectedAmount: bigint;
}

interface AddressCheckResult {
  received: boolean;
  txHash?: string;
  amount?: bigint;
  confirmations?: number;
}

interface ElectrumNotification {
  method: string;
  params: unknown[];
}

class TransactionMonitor {
  private client: ElectrumClient | null = null;
  private watchedAddresses: Map<string, WatchInfo> = new Map();
  private isConnected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  // ---------------------------------------------------------------
  // Connection management
  // ---------------------------------------------------------------

  /**
   * Connect to a Fulcrum/ElectrumX server over WSS.
   */
  async connect(): Promise<void> {
    const server =
      ELECTRUM_SERVERS[NETWORK as keyof typeof ELECTRUM_SERVERS] ||
      ELECTRUM_SERVERS.chipnet;

    try {
      this.client = new ElectrumClient(
        "BCH Pay Monitor",
        "1.4.1",
        server.host,
        server.port,
        ElectrumTransport.WSS.Scheme
      );

      // Listen for notifications (address status changes, block headers, etc.)
      this.client.on("notification", (data: ElectrumNotification) => {
        this.handleNotification(data);
      });

      // Handle disconnect events so we can reconnect
      this.client.on("disconnected", () => {
        console.log("[Monitor] Disconnected from electrum server");
        this.isConnected = false;
        this.scheduleReconnect();
      });

      await this.client.connect();
      this.isConnected = true;
      console.log(
        `[Monitor] Connected to ${server.host}:${server.port} (${NETWORK})`
      );

      // Re-subscribe to all currently watched addresses after (re)connect
      for (const [address] of this.watchedAddresses) {
        await this.subscribeToAddress(address);
      }
    } catch (err) {
      console.error("[Monitor] Connection failed:", err);
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule a reconnection attempt after a delay.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    console.log("[Monitor] Scheduling reconnect in 5 s...");
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.connect();
    }, 5000);
  }

  /**
   * Gracefully disconnect from the electrum server.
   */
  async disconnect(): Promise<void> {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      try {
        await this.client.disconnect();
      } catch {
        // Ignore errors during shutdown
      }
      this.client = null;
      this.isConnected = false;
      console.log("[Monitor] Disconnected");
    }
  }

  // ---------------------------------------------------------------
  // Address subscription / watching
  // ---------------------------------------------------------------

  /**
   * Subscribe to status change notifications for an address.
   * When the address receives (or sends) a transaction its status hash changes
   * and the server pushes a `blockchain.address.subscribe` notification.
   */
  private async subscribeToAddress(address: string): Promise<void> {
    if (!this.client || !this.isConnected) return;
    try {
      await this.client.subscribe(
        "blockchain.address.subscribe",
        address
      );
      console.log(
        `[Monitor] Subscribed to ${address.slice(0, 25)}...`
      );
    } catch (err) {
      console.error(`[Monitor] Subscribe failed for ${address}:`, err);
    }
  }

  /**
   * Start watching an address for incoming payments.
   */
  async watchAddress(
    address: string,
    paymentLinkId: string,
    merchantId: string,
    expectedAmount: bigint
  ): Promise<void> {
    this.watchedAddresses.set(address, {
      paymentLinkId,
      merchantId,
      expectedAmount,
    });
    if (this.isConnected) {
      await this.subscribeToAddress(address);
    }
  }

  /**
   * Stop watching an address.
   */
  unwatch(address: string): void {
    this.watchedAddresses.delete(address);
  }

  // ---------------------------------------------------------------
  // Notification handling
  // ---------------------------------------------------------------

  /**
   * Handle incoming notifications from the electrum server.
   * When an address we are watching changes status, we fetch the latest
   * transaction details and process the payment.
   */
  private async handleNotification(data: ElectrumNotification): Promise<void> {
    if (data.method !== "blockchain.address.subscribe") return;

    // params: [address, statusHash]
    const address = data.params?.[0] as string | undefined;
    if (!address || !this.watchedAddresses.has(address)) return;

    console.log(`[Monitor] Status change for ${address.slice(0, 25)}...`);

    // Fetch the latest transaction for this address
    const result = await this.checkAddress(address);
    if (result.received && result.txHash && result.amount !== undefined) {
      await this.processPayment(
        address,
        result.txHash,
        result.amount,
        result.confirmations || 0
      );
    }
  }

  // ---------------------------------------------------------------
  // Address querying
  // ---------------------------------------------------------------

  /**
   * Check an address for received payments by querying its transaction history.
   * Returns information about the most recent transaction that sends funds to
   * this address.
   */
  async checkAddress(address: string): Promise<AddressCheckResult> {
    if (!this.client || !this.isConnected) {
      return { received: false };
    }

    try {
      // Get full address history (array of { tx_hash, height })
      const history = (await this.client.request(
        "blockchain.address.get_history",
        address
      )) as Array<{ tx_hash: string; height: number }> | null;

      if (!history || history.length === 0) {
        return { received: false };
      }

      // Take the most recent transaction
      const latestTx = history[history.length - 1];
      const txHash = latestTx.tx_hash;

      // height > 0 means confirmed, height === 0 means in mempool,
      // height === -1 means unconfirmed with unconfirmed parents
      const confirmations = latestTx.height > 0 ? 1 : 0;

      // Fetch verbose transaction to inspect outputs
      const rawTx = (await this.client.request(
        "blockchain.transaction.get",
        txHash,
        true
      )) as {
        vout?: Array<{
          value: number;
          scriptPubKey?: { addresses?: string[] };
        }>;
      } | null;

      // Sum outputs paying to our address
      let receivedAmount = 0n;
      if (rawTx?.vout) {
        for (const output of rawTx.vout) {
          const outputAddresses = output.scriptPubKey?.addresses;
          if (outputAddresses?.includes(address)) {
            // value is in BCH (floating point); convert to satoshis
            receivedAmount += BigInt(Math.round(output.value * 1e8));
          }
        }
      }

      return {
        received: receivedAmount > 0n,
        txHash,
        amount: receivedAmount,
        confirmations,
      };
    } catch (err) {
      console.error(`[Monitor] checkAddress failed for ${address}:`, err);
      return { received: false };
    }
  }

  // ---------------------------------------------------------------
  // Payment processing
  // ---------------------------------------------------------------

  /**
   * Record a detected payment in the database and trigger downstream actions
   * (webhook delivery, deactivating single-use payment links, etc.).
   */
  async processPayment(
    address: string,
    txHash: string,
    amount: bigint,
    confirmations: number
  ): Promise<void> {
    const watchInfo = this.watchedAddresses.get(address);
    if (!watchInfo) return;

    const { paymentLinkId, merchantId, expectedAmount } = watchInfo;

    try {
      // Check if this transaction was already recorded
      const existing = await prisma.transaction.findUnique({
        where: { tx_hash: txHash },
      });

      if (existing) {
        // Update confirmations if they increased
        if (existing.confirmations < confirmations) {
          await prisma.transaction.update({
            where: { tx_hash: txHash },
            data: {
              confirmations,
              status: confirmations >= 1 ? "CONFIRMED" : existing.status,
            },
          });
          console.log(
            `[Monitor] Updated confirmations for ${txHash}: ${confirmations}`
          );
        }
        return;
      }

      // Decide status: small amounts get instant 0-conf acceptance
      const status: "CONFIRMED" | "PENDING" =
        confirmations >= 1
          ? "CONFIRMED"
          : amount <= ZERO_CONF_THRESHOLD
            ? "CONFIRMED"
            : "PENDING";

      // Create the transaction record
      const tx = await prisma.transaction.create({
        data: {
          tx_hash: txHash,
          payment_link_id: paymentLinkId,
          merchant_id: merchantId,
          sender_address: "unknown", // Would require parsing tx inputs
          recipient_address: address,
          amount_satoshis: amount,
          confirmations,
          status,
        },
      });

      console.log(
        `[Monitor] Payment recorded: ${txHash} - ${amount} sats - ${status}`
      );

      // If this is a single-use payment link, deactivate it
      const paymentLink = await prisma.paymentLink.findUnique({
        where: { id: paymentLinkId },
      });
      if (paymentLink?.type === "SINGLE") {
        await prisma.paymentLink.update({
          where: { id: paymentLinkId },
          data: { status: "INACTIVE" },
        });
        // No longer need to watch this address
        this.unwatch(address);
      }

      // Deliver webhook notification
      await this.deliverWebhook(merchantId, status, {
        transaction_id: tx.id,
        tx_hash: txHash,
        amount_satoshis: amount.toString(),
        confirmations,
        payment_link_id: paymentLinkId,
        status,
      });
    } catch (err) {
      console.error(`[Monitor] processPayment failed for ${txHash}:`, err);
    }
  }

  /**
   * Attempt to deliver a webhook notification for a payment event.
   * Fails silently if the webhook service is not available.
   */
  private async deliverWebhook(
    merchantId: string,
    status: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    try {
      const { webhookService } = await import("./webhook.js");
      const eventType =
        status === "CONFIRMED" ? "payment.confirmed" : "payment.received";
      await webhookService.deliver(merchantId, eventType, payload);
    } catch {
      // Webhook service may not exist yet -- that is fine
    }
  }

  // ---------------------------------------------------------------
  // Polling fallback
  // ---------------------------------------------------------------

  /**
   * Poll all watched addresses for new transactions. This serves as a
   * fallback when WebSocket push notifications are unreliable.
   */
  async pollAll(): Promise<void> {
    for (const [address] of this.watchedAddresses) {
      try {
        const result = await this.checkAddress(address);
        if (result.received && result.txHash && result.amount !== undefined) {
          await this.processPayment(
            address,
            result.txHash,
            result.amount,
            result.confirmations || 0
          );
        }
      } catch (err) {
        console.error(`[Monitor] Poll error for ${address}:`, err);
      }
    }
  }

  /**
   * Start the periodic polling loop.
   * @param intervalMs  Polling interval in milliseconds (default: 5000).
   */
  startPolling(intervalMs: number = 5000): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
    }
    this.pollingTimer = setInterval(() => {
      this.pollAll();
    }, intervalMs);
    console.log(`[Monitor] Polling started (every ${intervalMs} ms)`);
  }

  // ---------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------

  /**
   * Load all active payment links from the database and start watching
   * their payment addresses.
   */
  async loadActivePaymentLinks(): Promise<void> {
    const activeLinks = await prisma.paymentLink.findMany({
      where: {
        status: "ACTIVE",
        payment_address: { not: null },
      },
    });

    for (const link of activeLinks) {
      if (link.payment_address) {
        await this.watchAddress(
          link.payment_address,
          link.id,
          link.merchant_id,
          link.amount_satoshis
        );
      }
    }

    console.log(
      `[Monitor] Loaded ${activeLinks.length} active payment link(s) to watch`
    );
  }
}

// Singleton instance
export const transactionMonitor = new TransactionMonitor();
