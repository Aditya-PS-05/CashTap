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
  decodeCashAddress,
  CashAddressType,
  CashAddressNetworkPrefix,
  hash160,
  sha256,
  secp256k1,
} from "@bitauth/libauth";

// BIP44 coin type: 145 for BCH mainnet, 145 for chipnet too
const BIP44_PATH = "m/44'/145'/0'/0/0";
const BIP44_MERCHANT_PATH = "m/44'/145'/1'/0/0";

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
 * Derive a merchant BCH address from an existing mnemonic using account index 1.
 * Path: m/44'/145'/1'/0/0 (instead of account 0)
 */
export function deriveMerchantAddress(mnemonic: string): WalletKeys {
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error("Invalid seed phrase");
  }

  const seed = mnemonicToSeedSync(mnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  const child = hdKey.derive(BIP44_MERCHANT_PATH);

  if (!child.privateKey || !child.publicKey) {
    throw new Error("Failed to derive keys from seed");
  }

  const pubKeyHash = hash160(child.publicKey);
  if (typeof pubKeyHash === "string") {
    throw new Error("hash160 returned error");
  }

  const result = encodeCashAddress({
    prefix: CashAddressNetworkPrefix.testnet,
    type: CashAddressType.p2pkh,
    payload: pubKeyHash,
  });

  const address = typeof result === "string" ? result : result.address;

  return {
    mnemonic,
    privateKey: child.privateKey,
    publicKey: child.publicKey,
    address,
  };
}

/**
 * Validate a seed phrase without deriving keys.
 */
export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic, wordlist);
}

// ---------------------------------------------------------------------------
// Transaction builder — build, sign and broadcast a BCH transaction
// ---------------------------------------------------------------------------

const API_BASE_WALLET = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3456";

interface BuildTxParams {
  senderAddress: string;
  recipientAddress: string;
  amountSatoshis: number;
  mnemonic: string;
  feePerByte?: number;
}

interface BuildTxResult {
  txid: string;
  rawTx: string;
}

interface Utxo {
  txid: string;
  vout: number;
  satoshis: number;
}

/**
 * Build, sign and broadcast a BCH transaction.
 *
 * 1. Fetch UTXOs from the API
 * 2. Coin selection (greedy)
 * 3. Build P2PKH outputs
 * 4. BIP143 sighash (BCH uses SIGHASH_ALL | SIGHASH_FORKID = 0x41)
 * 5. Sign with secp256k1
 * 6. Serialize and broadcast
 */
export async function buildAndSignTransaction(params: BuildTxParams): Promise<BuildTxResult> {
  const { senderAddress, recipientAddress, amountSatoshis, mnemonic, feePerByte = 1 } = params;

  // Derive keys from mnemonic
  const wallet = deriveFromMnemonic(mnemonic);

  // Fetch UTXOs
  const utxoRes = await fetch(`${API_BASE_WALLET}/api/wallet/utxos?address=${encodeURIComponent(senderAddress)}`);
  if (!utxoRes.ok) throw new Error("Failed to fetch UTXOs");
  const { utxos } = await utxoRes.json() as { utxos: Utxo[] };

  if (utxos.length === 0) throw new Error("No UTXOs available");

  // Estimate fee: ~148 bytes/input + ~34 bytes/output + 10 bytes overhead
  const estimateSize = (inputs: number, outputs: number) => inputs * 148 + outputs * 34 + 10;

  // Greedy coin selection
  let selectedUtxos: Utxo[] = [];
  let totalInput = 0;
  const sortedUtxos = [...utxos].sort((a, b) => b.satoshis - a.satoshis);

  for (const utxo of sortedUtxos) {
    selectedUtxos.push(utxo);
    totalInput += utxo.satoshis;

    const estimatedFee = estimateSize(selectedUtxos.length, 2) * feePerByte;
    if (totalInput >= amountSatoshis + estimatedFee) break;
  }

  const fee = estimateSize(selectedUtxos.length, 2) * feePerByte;
  const totalNeeded = amountSatoshis + fee;

  if (totalInput < totalNeeded) {
    throw new Error(`Insufficient funds. Have ${totalInput} sats, need ${totalNeeded} sats`);
  }

  const change = totalInput - amountSatoshis - fee;

  // Build the transaction
  const rawTx = buildRawTransaction({
    inputs: selectedUtxos,
    recipientAddress,
    senderAddress,
    amountSatoshis,
    changeSatoshis: change > 546 ? change : 0, // dust threshold
    privateKey: wallet.privateKey,
    publicKey: wallet.publicKey,
  });

  // Broadcast
  const broadcastRes = await fetch(`${API_BASE_WALLET}/api/wallet/broadcast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_tx: rawTx }),
  });

  if (!broadcastRes.ok) {
    const err = await broadcastRes.json().catch(() => ({ error: "Broadcast failed" }));
    throw new Error(err.error || "Broadcast failed");
  }

  const { txid } = await broadcastRes.json();
  return { txid, rawTx };
}

// --- Low-level transaction building ---

function addressToHash160(address: string): Uint8Array {
  const decoded = decodeCashAddress(address);
  if (typeof decoded === "string") throw new Error(`Invalid address: ${decoded}`);
  return decoded.payload;
}

function buildP2PKHOutputScript(pubkeyHash: Uint8Array): Uint8Array {
  // OP_DUP OP_HASH160 <20 bytes hash> OP_EQUALVERIFY OP_CHECKSIG
  return new Uint8Array([0x76, 0xa9, 0x14, ...pubkeyHash, 0x88, 0xac]);
}

function writeVarInt(value: number): Uint8Array {
  if (value < 0xfd) return new Uint8Array([value]);
  if (value <= 0xffff) {
    const buf = new Uint8Array(3);
    buf[0] = 0xfd;
    buf[1] = value & 0xff;
    buf[2] = (value >> 8) & 0xff;
    return buf;
  }
  const buf = new Uint8Array(5);
  buf[0] = 0xfe;
  buf[1] = value & 0xff;
  buf[2] = (value >> 8) & 0xff;
  buf[3] = (value >> 16) & 0xff;
  buf[4] = (value >> 24) & 0xff;
  return buf;
}

function writeUint32LE(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = value & 0xff;
  buf[1] = (value >> 8) & 0xff;
  buf[2] = (value >> 16) & 0xff;
  buf[3] = (value >> 24) & 0xff;
  return buf;
}

function writeUint64LE(value: number): Uint8Array {
  const buf = new Uint8Array(8);
  // Safe for values up to 2^53
  buf[0] = value & 0xff;
  buf[1] = (value >> 8) & 0xff;
  buf[2] = (value >> 16) & 0xff;
  buf[3] = (value >> 24) & 0xff;
  const high = Math.floor(value / 0x100000000);
  buf[4] = high & 0xff;
  buf[5] = (high >> 8) & 0xff;
  buf[6] = (high >> 16) & 0xff;
  buf[7] = (high >> 24) & 0xff;
  return buf;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function reverseBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes).reverse();
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

interface BuildRawTxParams {
  inputs: Utxo[];
  recipientAddress: string;
  senderAddress: string;
  amountSatoshis: number;
  changeSatoshis: number;
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

function buildRawTransaction(params: BuildRawTxParams): string {
  const { inputs, recipientAddress, senderAddress, amountSatoshis, changeSatoshis, privateKey, publicKey } = params;

  const SIGHASH_ALL = 0x01;
  const SIGHASH_FORKID = 0x40;
  const hashType = SIGHASH_ALL | SIGHASH_FORKID;

  const recipientHash = addressToHash160(recipientAddress);
  const senderHash = addressToHash160(senderAddress);
  const senderOutputScript = buildP2PKHOutputScript(senderHash);

  // Build outputs
  const outputs: { script: Uint8Array; value: number }[] = [
    { script: buildP2PKHOutputScript(recipientHash), value: amountSatoshis },
  ];
  if (changeSatoshis > 0) {
    outputs.push({ script: buildP2PKHOutputScript(senderHash), value: changeSatoshis });
  }

  // BIP143 preimage components
  // hashPrevouts = SHA256(SHA256(all input outpoints))
  const prevoutsData = concat(
    ...inputs.map((inp) => concat(reverseBytes(hexToBytes(inp.txid)), writeUint32LE(inp.vout)))
  );
  const hashPrevouts = sha256.hash(sha256.hash(prevoutsData));

  // hashSequence = SHA256(SHA256(all input sequences))
  const sequenceData = concat(...inputs.map(() => writeUint32LE(0xffffffff)));
  const hashSequence = sha256.hash(sha256.hash(sequenceData));

  // hashOutputs = SHA256(SHA256(all outputs))
  const outputsData = concat(
    ...outputs.map((out) =>
      concat(writeUint64LE(out.value), writeVarInt(out.script.length), out.script)
    )
  );
  const hashOutputs = sha256.hash(sha256.hash(outputsData));

  // Sign each input using BIP143
  const signatures: Uint8Array[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const inp = inputs[i];

    // BIP143 preimage
    const preimage = concat(
      writeUint32LE(2), // version
      hashPrevouts,
      hashSequence,
      reverseBytes(hexToBytes(inp.txid)), // outpoint txid
      writeUint32LE(inp.vout), // outpoint index
      writeVarInt(senderOutputScript.length),
      senderOutputScript, // scriptCode
      writeUint64LE(inp.satoshis), // value
      writeUint32LE(0xffffffff), // sequence
      hashOutputs,
      writeUint32LE(0), // locktime
      writeUint32LE(hashType), // sighash type
    );

    const sighash = sha256.hash(sha256.hash(preimage));

    // Sign
    const sig = secp256k1.signMessageHashDER(privateKey, sighash);
    if (typeof sig === "string") throw new Error("Signing failed: " + sig);

    // Append hash type byte
    signatures.push(concat(sig, new Uint8Array([hashType])));
  }

  // Serialize the full transaction
  const txParts: Uint8Array[] = [];

  // Version
  txParts.push(writeUint32LE(2));

  // Input count
  txParts.push(writeVarInt(inputs.length));

  // Inputs
  for (let i = 0; i < inputs.length; i++) {
    const inp = inputs[i];
    const sig = signatures[i];

    // scriptSig: <sig_len> <sig+hashtype> <pubkey_len> <pubkey>
    const scriptSig = concat(
      new Uint8Array([sig.length]),
      sig,
      new Uint8Array([publicKey.length]),
      publicKey
    );

    txParts.push(reverseBytes(hexToBytes(inp.txid))); // prevout hash
    txParts.push(writeUint32LE(inp.vout)); // prevout index
    txParts.push(writeVarInt(scriptSig.length)); // scriptSig length
    txParts.push(scriptSig); // scriptSig
    txParts.push(writeUint32LE(0xffffffff)); // sequence
  }

  // Output count
  txParts.push(writeVarInt(outputs.length));

  // Outputs
  for (const out of outputs) {
    txParts.push(writeUint64LE(out.value));
    txParts.push(writeVarInt(out.script.length));
    txParts.push(out.script);
  }

  // Locktime
  txParts.push(writeUint32LE(0));

  const rawTx = concat(...txParts);
  return bytesToHex(rawTx);
}

// Also need decodeCashAddress imported at the top - it's already there

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
