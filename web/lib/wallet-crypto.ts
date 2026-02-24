/**
 * Wallet encryption utilities using Web Crypto API.
 * PBKDF2 (100k iterations, SHA-256) + AES-256-GCM.
 * No external dependencies.
 */

/**
 * Encrypt a mnemonic seed phrase with a password.
 * Returns: base64(salt[16] + iv[12] + ciphertext)
 */
export async function encryptMnemonic(mnemonic: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(mnemonic)
  );

  // Combine: salt (16) + iv (12) + ciphertext
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a mnemonic seed phrase from an encrypted blob.
 * Input: base64(salt[16] + iv[12] + ciphertext)
 */
export async function decryptMnemonic(blob: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const combined = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0));

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return dec.decode(plaintext);
}
