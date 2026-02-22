/**
 * JWT token generators for test auth.
 */
import jwt from "jsonwebtoken";

const JWT_SECRET = "bch-pay-dev-secret-change-me";

export const TEST_MERCHANT_ID = "cltest000000000000001";
export const TEST_ADDRESS = "bchtest:qr95sy3j9xwd2ap32xkykttr4cvcu7as5yg42lrhk3";

export function makeToken(
  merchantId = TEST_MERCHANT_ID,
  address = TEST_ADDRESS,
  expiresIn = "24h"
): string {
  return jwt.sign({ merchantId, address }, JWT_SECRET, { expiresIn });
}

export function makeExpiredToken(
  merchantId = TEST_MERCHANT_ID,
  address = TEST_ADDRESS
): string {
  return jwt.sign({ merchantId, address }, JWT_SECRET, { expiresIn: "0s" });
}

export function makeRefreshToken(
  merchantId = TEST_MERCHANT_ID,
  address = TEST_ADDRESS
): string {
  return jwt.sign({ merchantId, address }, JWT_SECRET, { expiresIn: "7d" });
}
