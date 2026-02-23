import 'dart:convert';
import 'dart:typed_data';

import 'package:bip39/bip39.dart' as bip39;
import 'package:bip32/bip32.dart' as bip32;
import 'package:pointycastle/export.dart';

/// Wallet key bundle produced by create/import.
class WalletKeys {
  final String mnemonic;
  final Uint8List privateKey;
  final Uint8List publicKey;
  final String address;

  WalletKeys({
    required this.mnemonic,
    required this.privateKey,
    required this.publicKey,
    required this.address,
  });
}

/// BIP39 mnemonic generation, BIP44 key derivation, CashAddr encoding,
/// and Bitcoin Signed Message signing for Bitcoin Cash.
///
/// Mirrors the web's `lib/bch-wallet.ts` implementation.
class WalletCryptoService {
  WalletCryptoService._();

  // BIP44 coin type 145 = BCH
  static const _bip44Path = "m/44'/145'/0'/0/0";
  static const _cashAddrCharset = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

  /// Generate a new 12-word BIP39 mnemonic and derive the first BCH address.
  static WalletKeys createWallet() {
    final mnemonic = bip39.generateMnemonic();
    return deriveFromMnemonic(mnemonic);
  }

  /// Derive BCH address + keys from an existing mnemonic seed phrase.
  static WalletKeys deriveFromMnemonic(String mnemonic) {
    if (!bip39.validateMnemonic(mnemonic)) {
      throw Exception('Invalid seed phrase');
    }

    final seed = bip39.mnemonicToSeed(mnemonic);
    final root = bip32.BIP32.fromSeed(seed);
    final child = root.derivePath(_bip44Path);

    if (child.privateKey == null) {
      throw Exception('Failed to derive private key from seed');
    }

    final pubKeyHash = _hash160(child.publicKey);
    // Use testnet prefix to match the web wallet (chipnet)
    final address = _encodeCashAddress('bchtest', 0, pubKeyHash);

    return WalletKeys(
      mnemonic: mnemonic,
      privateKey: child.privateKey!,
      publicKey: child.publicKey,
      address: address,
    );
  }

  /// Validate a mnemonic seed phrase.
  static bool isValidMnemonic(String mnemonic) {
    return bip39.validateMnemonic(mnemonic);
  }

  /// Sign a message using Bitcoin Signed Message format.
  /// Returns a base64-encoded 65-byte compact recoverable signature.
  static String signMessage(
    Uint8List privateKey,
    Uint8List publicKey,
    String message,
  ) {
    // Bitcoin Signed Message format:
    // sha256(sha256("\x18Bitcoin Signed Message:\n" + varint(len) + message))
    const prefix = '\x18Bitcoin Signed Message:\n';
    final prefixBytes = utf8.encode(prefix);
    final msgBytes = utf8.encode(message);

    // Varint encoding (simplified — up to 252 bytes)
    final lenByte = Uint8List(1)..[0] = msgBytes.length & 0xff;

    final fullMsg = Uint8List(prefixBytes.length + 1 + msgBytes.length);
    fullMsg.setAll(0, prefixBytes);
    fullMsg.setAll(prefixBytes.length, lenByte);
    fullMsg.setAll(prefixBytes.length + 1, msgBytes);

    // Double SHA256
    final hash1 = SHA256Digest().process(Uint8List.fromList(fullMsg));
    final messageHash = SHA256Digest().process(hash1);

    // Sign with secp256k1 using deterministic nonce (RFC 6979)
    final ecParams = ECDomainParameters('secp256k1');
    final privKeyBigInt = _bytesToBigInt(privateKey);
    final ecPrivateKey = ECPrivateKey(privKeyBigInt, ecParams);

    final signer = ECDSASigner(null, HMac(SHA256Digest(), 64));
    signer.init(true, PrivateKeyParameter<ECPrivateKey>(ecPrivateKey));
    final ecSig = signer.generateSignature(messageHash) as ECSignature;

    // Normalize s to low-s form (BIP 62 / BIP 146)
    final halfOrder = ecParams.n >> 1;
    final normalizedS =
        ecSig.s > halfOrder ? ecParams.n - ecSig.s : ecSig.s;

    // Determine recovery ID by trying each candidate
    int recoveryId = 0;
    for (int i = 0; i < 4; i++) {
      final recovered =
          _recoverPublicKey(i, ecSig.r, normalizedS, messageHash, ecParams);
      if (recovered != null) {
        final recoveredBytes = recovered.getEncoded(true);
        if (_uint8ListEquals(
                Uint8List.fromList(recoveredBytes), publicKey)) {
          recoveryId = i;
          break;
        }
      }
    }

    // 65-byte signature: [recovery_flag] [r (32 bytes)] [s (32 bytes)]
    // recovery_flag = 27 + recoveryId + 4 (compressed key flag)
    final sig = Uint8List(65);
    sig[0] = 27 + recoveryId + 4;
    sig.setRange(1, 33, _bigIntToBytes(ecSig.r, 32));
    sig.setRange(33, 65, _bigIntToBytes(normalizedS, 32));

    return base64.encode(sig);
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /// RIPEMD160(SHA256(data))
  static Uint8List _hash160(Uint8List data) {
    final sha256Hash = SHA256Digest().process(data);
    return RIPEMD160Digest().process(sha256Hash);
  }

  /// Recover a public key from an ECDSA signature + message hash.
  static ECPoint? _recoverPublicKey(
    int recId,
    BigInt r,
    BigInt s,
    Uint8List hash,
    ECDomainParameters params,
  ) {
    final n = params.n;
    // secp256k1 field prime
    final p = BigInt.parse(
      'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F',
      radix: 16,
    );

    final i = BigInt.from(recId ~/ 2);
    final x = r + i * n;
    if (x >= p) return null;

    // y² = x³ + 7 mod p  (secp256k1: a = 0, b = 7)
    final y2 = (x.modPow(BigInt.from(3), p) + BigInt.from(7)) % p;

    // Square root via Fermat's little theorem (p ≡ 3 mod 4)
    final y = y2.modPow((p + BigInt.one) >> 2, p);
    if ((y * y) % p != y2) return null;

    final isOdd = recId & 1 == 1;
    final yFinal = y.isOdd == isOdd ? y : p - y;

    final R = params.curve.createPoint(x, yFinal);

    // Q = r⁻¹ · (s·R − e·G)
    final e = _bytesToBigInt(hash) % n;
    final rInv = r.modInverse(n);

    final sR = R * (s * rInv % n);
    final eG = params.G * ((n - e) * rInv % n);

    if (sR == null || eG == null) return null;
    return sR + eG;
  }

  /// CashAddr encoding (BCH address format).
  static String _encodeCashAddress(
      String prefix, int hashType, Uint8List hash) {
    // Version byte: (hashType << 3) | sizeCode
    // sizeCode 0 = 20-byte hash (P2PKH)
    final versionByte = hashType << 3;
    final payload = <int>[versionByte, ...hash];

    // Convert 8-bit payload to 5-bit groups
    final payload5 = _convertBits(payload, 8, 5, true);

    // Prefix expansion for polymod: lower 5 bits of each char + separator
    final prefixData = <int>[
      for (final c in prefix.codeUnits) c & 0x1f,
      0,
    ];

    // Compute polymod checksum (8 zero-bytes as placeholder)
    final template = [
      ...prefixData,
      ...payload5,
      0, 0, 0, 0, 0, 0, 0, 0,
    ];
    final checksum = _polymod(template);
    final checksumValues = <int>[
      for (int i = 0; i < 8; i++) (checksum >> (5 * (7 - i))) & 0x1f,
    ];

    final encoded = StringBuffer();
    for (final v in [...payload5, ...checksumValues]) {
      encoded.write(_cashAddrCharset[v]);
    }

    return '$prefix:${encoded.toString()}';
  }

  /// Convert between bit widths (e.g., 8-bit bytes → 5-bit groups).
  static List<int> _convertBits(
      List<int> data, int fromBits, int toBits, bool pad) {
    int acc = 0;
    int bits = 0;
    final result = <int>[];
    final maxv = (1 << toBits) - 1;

    for (final value in data) {
      acc = (acc << fromBits) | value;
      bits += fromBits;
      while (bits >= toBits) {
        bits -= toBits;
        result.add((acc >> bits) & maxv);
      }
    }

    if (pad && bits > 0) {
      result.add((acc << (toBits - bits)) & maxv);
    }

    return result;
  }

  /// CashAddr polymod checksum.
  static int _polymod(List<int> values) {
    int c = 1;
    for (final d in values) {
      final c0 = c >> 35;
      c = ((c & 0x07ffffffff) << 5) ^ d;
      if (c0 & 0x01 != 0) c ^= 0x98f2bc8e61;
      if (c0 & 0x02 != 0) c ^= 0x79b76d99e2;
      if (c0 & 0x04 != 0) c ^= 0xf33e5fb3c4;
      if (c0 & 0x08 != 0) c ^= 0xae2eabe2a8;
      if (c0 & 0x10 != 0) c ^= 0x1e4f43e470;
    }
    return c ^ 1;
  }

  static BigInt _bytesToBigInt(Uint8List bytes) {
    BigInt result = BigInt.zero;
    for (int i = 0; i < bytes.length; i++) {
      result = (result << 8) | BigInt.from(bytes[i]);
    }
    return result;
  }

  static Uint8List _bigIntToBytes(BigInt n, int length) {
    final bytes = Uint8List(length);
    BigInt val = n;
    for (int i = length - 1; i >= 0; i--) {
      bytes[i] = (val & BigInt.from(0xff)).toInt();
      val >>= 8;
    }
    return bytes;
  }

  static bool _uint8ListEquals(Uint8List a, Uint8List b) {
    if (a.length != b.length) return false;
    for (int i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}
