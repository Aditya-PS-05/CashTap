import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SATOSHIS_PER_BCH = 100_000_000n;

export function satoshisToBch(sats: bigint): string {
  const whole = sats / SATOSHIS_PER_BCH;
  const frac = sats % SATOSHIS_PER_BCH;
  const fracStr = frac.toString().padStart(8, "0").replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

export function formatBch(sats: bigint): string {
  return `${satoshisToBch(sats)} BCH`;
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function shortenAddress(addr: string): string {
  if (addr.length <= 16) return addr;
  const prefix = addr.startsWith("bitcoincash:") ? "bitcoincash:" : "";
  const hash = addr.replace("bitcoincash:", "");
  return `${prefix}${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

export function generatePaymentURI(
  address: string,
  amountBch?: string,
  memo?: string
): string {
  const params = new URLSearchParams();
  if (amountBch) params.set("amount", amountBch);
  if (memo) params.set("message", memo);
  const qs = params.toString();
  return `${address}${qs ? "?" + qs : ""}`;
}
