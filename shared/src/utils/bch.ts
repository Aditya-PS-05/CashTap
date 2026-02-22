import {
  BCH_DECIMALS,
  SATOSHIS_PER_BCH,
  CASHADDR_PREFIX,
  CASHADDR_PREFIX_MAINNET,
  CASHADDR_PREFIX_CHIPNET,
} from "../constants/index.js";

// ============================================================================
// Satoshi / BCH Conversion
// ============================================================================

/**
 * Convert satoshis to a BCH decimal string.
 *
 * @example satoshisToBch(50_000_000n) // "0.50000000"
 */
export function satoshisToBch(sats: bigint): string {
  const negative = sats < 0n;
  const absSats = negative ? -sats : sats;

  const whole = absSats / SATOSHIS_PER_BCH;
  const fractional = absSats % SATOSHIS_PER_BCH;

  const fractionalStr = fractional.toString().padStart(BCH_DECIMALS, "0");
  const sign = negative ? "-" : "";

  return `${sign}${whole}.${fractionalStr}`;
}

/**
 * Convert a BCH decimal string to satoshis.
 *
 * @example bchToSatoshis("0.5") // 50_000_000n
 * @throws {Error} If the string is not a valid BCH amount.
 */
export function bchToSatoshis(bch: string): bigint {
  const trimmed = bch.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid BCH amount: "${bch}"`);
  }

  const negative = trimmed.startsWith("-");
  const abs = negative ? trimmed.slice(1) : trimmed;

  const [wholePart, fracPart = ""] = abs.split(".");

  if (fracPart.length > BCH_DECIMALS) {
    throw new Error(
      `BCH amount has too many decimal places (max ${BCH_DECIMALS}): "${bch}"`
    );
  }

  const paddedFrac = fracPart.padEnd(BCH_DECIMALS, "0");
  const totalStr = wholePart + paddedFrac;

  // Strip leading zeros to avoid BigInt("00...") issues, but keep at least "0"
  const cleaned = totalStr.replace(/^0+/, "") || "0";
  const result = BigInt(cleaned);

  return negative ? -result : result;
}

// ============================================================================
// Formatting
// ============================================================================

/**
 * Format a satoshi amount as a human-readable BCH string with trailing zeros
 * trimmed and the "BCH" suffix.
 *
 * @example formatBchAmount(50_000_000n) // "0.5 BCH"
 * @example formatBchAmount(100_000n)    // "0.001 BCH"
 * @example formatBchAmount(100_000_000n) // "1 BCH"
 */
export function formatBchAmount(sats: bigint): string {
  const raw = satoshisToBch(sats);

  // Trim trailing zeros but keep at least one decimal digit
  let trimmed = raw.replace(/0+$/, "");
  if (trimmed.endsWith(".")) {
    trimmed = trimmed.slice(0, -1);
  }

  return `${trimmed} BCH`;
}

/**
 * Format a USD amount given in cents.
 *
 * @example formatUsd(1299) // "$12.99"
 * @example formatUsd(500)  // "$5.00"
 * @example formatUsd(-750) // "-$7.50"
 */
export function formatUsd(cents: number): string {
  const negative = cents < 0;
  const absCents = Math.abs(cents);
  const dollars = Math.floor(absCents / 100);
  const remainder = absCents % 100;
  const sign = negative ? "-" : "";

  return `${sign}$${dollars.toLocaleString("en-US")}.${remainder.toString().padStart(2, "0")}`;
}

/**
 * Shorten a BCH address for display purposes.
 *
 * @example shortenAddress("bitcoincash:qzm3...xyz") // "bitcoincash:qzm3...xyz"
 *          (keeps prefix + first 4 of hash + ... + last 4)
 */
export function shortenAddress(address: string, chars: number = 4): string {
  // Handle addresses with a prefix (e.g. "bitcoincash:qz...")
  const colonIdx = address.indexOf(":");
  if (colonIdx !== -1) {
    const prefix = address.slice(0, colonIdx + 1);
    const hash = address.slice(colonIdx + 1);

    if (hash.length <= chars * 2 + 3) {
      return address;
    }

    return `${prefix}${hash.slice(0, chars)}...${hash.slice(-chars)}`;
  }

  // Plain hash with no prefix
  if (address.length <= chars * 2 + 3) {
    return address;
  }

  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// ============================================================================
// Address Validation
// ============================================================================

/**
 * Basic validation for a CashAddr-format BCH address.
 *
 * Checks:
 * - Has a valid prefix ("bitcoincash:" or "bchtest:")
 * - The payload portion is lowercase alphanumeric (base32) and a reasonable length
 *
 * NOTE: This does NOT verify the checksum. For full validation use libauth
 * or a dedicated library. This is a lightweight sanity check for UI use.
 */
export function isValidBchAddress(address: string): boolean {
  const lower = address.toLowerCase();

  // Must start with a known prefix
  const hasMainnetPrefix = lower.startsWith(
    CASHADDR_PREFIX_MAINNET + ":"
  );
  const hasChipnetPrefix = lower.startsWith(
    CASHADDR_PREFIX_CHIPNET + ":"
  );

  if (!hasMainnetPrefix && !hasChipnetPrefix) {
    return false;
  }

  const prefix = hasMainnetPrefix
    ? CASHADDR_PREFIX_MAINNET
    : CASHADDR_PREFIX_CHIPNET;
  const payload = lower.slice(prefix.length + 1); // +1 for the ":"

  // CashAddr base32 character set: qpzry9x8gf2tvdw0s3jn54khce6mua7l
  const cashAddrBase32 = /^[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/;

  if (!cashAddrBase32.test(payload)) {
    return false;
  }

  // P2PKH addresses are 42 chars after the prefix, P2SH are 42 chars.
  // Reasonable range: 34-50 characters for the payload.
  if (payload.length < 34 || payload.length > 50) {
    return false;
  }

  return true;
}

// ============================================================================
// Payment URI
// ============================================================================

/**
 * Generate a BIP21-compatible Bitcoin Cash payment URI.
 *
 * @param address  - The recipient BCH address (CashAddr format)
 * @param amount   - Amount in satoshis (optional)
 * @param memo     - A short description / message (optional)
 *
 * @example
 * generatePaymentURI("bitcoincash:qz...", 500000n, "Coffee")
 * // "bitcoincash:qz...?amount=0.005&message=Coffee"
 */
export function generatePaymentURI(
  address: string,
  amount?: bigint,
  memo?: string
): string {
  // The address itself serves as the base — for BIP21 the format is
  // <scheme>:<address>?amount=<bch>&message=<text>
  // CashAddr addresses already include the "bitcoincash:" prefix, so we can
  // use the address directly as the URI base.

  let uri: string;

  // If the address already has the prefix, use it directly.
  // Otherwise prepend the active prefix.
  const lower = address.toLowerCase();
  if (
    lower.startsWith(CASHADDR_PREFIX_MAINNET + ":") ||
    lower.startsWith(CASHADDR_PREFIX_CHIPNET + ":")
  ) {
    uri = address;
  } else {
    uri = `${CASHADDR_PREFIX}:${address}`;
  }

  const params: string[] = [];

  if (amount !== undefined && amount > 0n) {
    // BIP21 amount is in BCH (not satoshis)
    const bchAmount = satoshisToBch(amount);
    // Trim trailing zeros for a cleaner URI
    let trimmed = bchAmount.replace(/0+$/, "");
    if (trimmed.endsWith(".")) {
      trimmed = trimmed.slice(0, -1);
    }
    params.push(`amount=${trimmed}`);
  }

  if (memo !== undefined && memo.length > 0) {
    params.push(`message=${encodeURIComponent(memo)}`);
  }

  if (params.length > 0) {
    uri += `?${params.join("&")}`;
  }

  return uri;
}
