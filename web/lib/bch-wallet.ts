/**
 * BCH wallet utilities — BIP39 mnemonic generation, BIP44 key derivation,
 * CashAddr encoding, and message signing for Bitcoin Cash.
 *
 * Uses @scure/bip39 + @scure/bip32 for key derivation (audited, minimal deps).
 * Uses @bitauth/libauth for CashAddr encoding and secp256k1 signing.
 */

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HDKey } from "@scure/bip32";
import {
  encodeCashAddress,
  CashAddressType,
  CashAddressNetworkPrefix,
  hash160,
  sha256,
  secp256k1,
} from "@bitauth/libauth";

// BIP44 coin type: 145 for BCH mainnet, 145 for chipnet too
const BIP44_PATH = "m/44'/145'/0'/0/0";

export interface WalletKeys {
  mnemonic: string;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  address: string;
}

/**
 * Generate a new 12-word BIP39 mnemonic and derive the first BCH address.
 */
export function createWallet(): WalletKeys {
  const mnemonic = generateMnemonic(wordlist, 128); // 128 bits = 12 words
  return deriveFromMnemonic(mnemonic);
}

/**
 * Derive BCH address + keys from an existing mnemonic seed phrase.
 */
export function deriveFromMnemonic(mnemonic: string): WalletKeys {
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error("Invalid seed phrase");
  }

  const seed = mnemonicToSeedSync(mnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  const child = hdKey.derive(BIP44_PATH);

  if (!child.privateKey || !child.publicKey) {
    throw new Error("Failed to derive keys from seed");
  }

  const pubKeyHash = hash160(child.publicKey);
  if (typeof pubKeyHash === "string") {
    throw new Error("hash160 returned error");
  }

  // Encode as CashAddr — use testnet prefix for chipnet
  const result = encodeCashAddress({
    prefix: CashAddressNetworkPrefix.testnet,
    type: CashAddressType.p2pkh,
    payload: pubKeyHash,
  });

  // encodeCashAddress returns { address: string } or an error string
  const address = typeof result === "string" ? result : result.address;

  return {
    mnemonic,
    privateKey: child.privateKey,
    publicKey: child.publicKey,
    address,
  };
}

/**
 * Sign a message with the wallet's private key.
 * Uses Bitcoin Signed Message format: sha256(sha256(prefix + varint(len) + message))
 */
export function signMessage(privateKey: Uint8Array, message: string): string {
  const prefix = "\x18Bitcoin Signed Message:\n";
  const msgBytes = new TextEncoder().encode(message);
  const prefixBytes = new TextEncoder().encode(prefix);

  // Varint encoding for message length (simplified — supports up to 252 bytes)
  const lenByte = new Uint8Array([msgBytes.length & 0xff]);

  // Construct: prefix + varint(len) + message
  const fullMsg = new Uint8Array(prefixBytes.length + lenByte.length + msgBytes.length);
  fullMsg.set(prefixBytes, 0);
  fullMsg.set(lenByte, prefixBytes.length);
  fullMsg.set(msgBytes, prefixBytes.length + lenByte.length);

  const hash1 = sha256.hash(fullMsg);
  const messageHash = sha256.hash(hash1);

  const sig = secp256k1.signMessageHashRecoverableCompact(privateKey, messageHash);

  if (typeof sig === "string") {
    throw new Error("Signing failed: " + sig);
  }

  // Return base64-encoded signature (65 bytes: recovery_id + compact_sig)
  const combined = new Uint8Array(65);
  combined[0] = sig.recoveryId + 27 + 4; // compressed key flag
  combined.set(sig.signature, 1);

  return uint8ToBase64(combined);
}

/**
 * Validate a seed phrase without deriving keys.
 */
export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic, wordlist);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
