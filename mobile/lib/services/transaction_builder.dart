import 'dart:typed_data';
import 'package:pointycastle/export.dart';

import 'api_service.dart';
import 'wallet_crypto_service.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/constants.dart';

/// Builds and broadcasts a BCH transaction using the wallet's seed phrase.
///
/// Steps:
/// 1. Fetch UTXOs from the API
/// 2. Coin selection (greedy)
/// 3. Build P2PKH outputs
/// 4. BIP143 sighash (BCH uses SIGHASH_ALL | SIGHASH_FORKID = 0x41)
/// 5. Sign with secp256k1
/// 6. Serialize and broadcast
class TransactionBuilder {
  static const int _sighashAll = 0x01;
  static const int _sighashForkId = 0x40;

  /// Build, sign and broadcast a BCH transaction.
  /// Returns the transaction ID on success.
  static Future<String> buildAndBroadcast({
    required String senderAddress,
    required String recipientAddress,
    required int amountSatoshis,
    int feePerByte = 1,
  }) async {
    final api = ApiService();

    // Get seed phrase from secure storage
    const storage = FlutterSecureStorage();
    final seedPhrase = await storage.read(key: AppConstants.seedPhraseKey);
    if (seedPhrase == null) {
      throw Exception('Wallet seed not found. Please log in again.');
    }

    // Derive keys
    final keys = WalletCryptoService.deriveFromMnemonic(seedPhrase);

    // Fetch UTXOs
    final utxos = await api.getUtxos(senderAddress);
    if (utxos.isEmpty) throw Exception('No UTXOs available');

    // Sort by value descending for greedy selection
    utxos.sort((a, b) =>
        ((b['satoshis'] as num).toInt()).compareTo((a['satoshis'] as num).toInt()));

    // Estimate fee: ~148 bytes/input + ~34 bytes/output + 10 bytes overhead
    int estimateSize(int inputs, int outputs) => inputs * 148 + outputs * 34 + 10;

    // Greedy coin selection
    final selectedUtxos = <Map<String, dynamic>>[];
    int totalInput = 0;

    for (final utxo in utxos) {
      selectedUtxos.add(utxo);
      totalInput += (utxo['satoshis'] as num).toInt();

      final estimatedFee = estimateSize(selectedUtxos.length, 2) * feePerByte;
      if (totalInput >= amountSatoshis + estimatedFee) break;
    }

    final fee = estimateSize(selectedUtxos.length, 2) * feePerByte;
    final totalNeeded = amountSatoshis + fee;

    if (totalInput < totalNeeded) {
      throw Exception('Insufficient funds. Have $totalInput sats, need $totalNeeded sats');
    }

    final change = totalInput - amountSatoshis - fee;

    // Build the raw transaction
    final rawTx = _buildRawTransaction(
      inputs: selectedUtxos,
      recipientAddress: recipientAddress,
      senderAddress: senderAddress,
      amountSatoshis: amountSatoshis,
      changeSatoshis: change > 546 ? change : 0,
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
    );

    // Broadcast
    final txid = await api.broadcastTransaction(
      _bytesToHex(rawTx),
      senderAddress: senderAddress,
    );

    // Record transaction in the database
    try {
      await api.recordTransaction(
        txHash: txid,
        senderAddress: senderAddress,
        recipientAddress: recipientAddress,
        amountSatoshis: amountSatoshis,
      );
    } catch (_) {
      // Don't fail the send if recording fails — tx is already on-chain
    }

    return txid;
  }

  static Uint8List _buildRawTransaction({
    required List<Map<String, dynamic>> inputs,
    required String recipientAddress,
    required String senderAddress,
    required int amountSatoshis,
    required int changeSatoshis,
    required Uint8List privateKey,
    required Uint8List publicKey,
  }) {
    final hashType = _sighashAll | _sighashForkId;

    final recipientHash = WalletCryptoService.addressToHash160(recipientAddress);
    final senderHash = WalletCryptoService.addressToHash160(senderAddress);
    final senderOutputScript = _buildP2PKHScript(senderHash);

    // Build outputs
    final outputs = <_TxOutput>[
      _TxOutput(script: _buildP2PKHScript(recipientHash), value: amountSatoshis),
    ];
    if (changeSatoshis > 0) {
      outputs.add(_TxOutput(script: _buildP2PKHScript(senderHash), value: changeSatoshis));
    }

    // BIP143 preimage components
    final prevoutsData = _concat(inputs.map((inp) => _concat([
      _reverseBytes(_hexToBytes(inp['txid'] as String)),
      _writeUint32LE(inp['vout'] as int),
    ])).toList());
    final hashPrevouts = _doubleSha256(prevoutsData);

    final sequenceData = _concat(inputs.map((_) => _writeUint32LE(0xffffffff)).toList());
    final hashSequence = _doubleSha256(sequenceData);

    final outputsData = _concat(outputs.map((out) => _concat([
      _writeUint64LE(out.value),
      _writeVarInt(out.script.length),
      out.script,
    ])).toList());
    final hashOutputs = _doubleSha256(outputsData);

    // Sign each input
    final signatures = <Uint8List>[];
    for (final inp in inputs) {
      final preimage = _concat([
        _writeUint32LE(2), // version
        hashPrevouts,
        hashSequence,
        _reverseBytes(_hexToBytes(inp['txid'] as String)),
        _writeUint32LE(inp['vout'] as int),
        _writeVarInt(senderOutputScript.length),
        senderOutputScript,
        _writeUint64LE((inp['satoshis'] as num).toInt()),
        _writeUint32LE(0xffffffff), // sequence
        hashOutputs,
        _writeUint32LE(0), // locktime
        _writeUint32LE(hashType),
      ]);

      final sighash = _doubleSha256(preimage);
      final sig = _signDER(privateKey, sighash);
      signatures.add(Uint8List.fromList([...sig, hashType]));
    }

    // Serialize full transaction
    final txParts = <Uint8List>[];
    txParts.add(_writeUint32LE(2)); // version
    txParts.add(_writeVarInt(inputs.length));

    for (int i = 0; i < inputs.length; i++) {
      final inp = inputs[i];
      final sig = signatures[i];

      final scriptSig = Uint8List.fromList([
        sig.length, ...sig,
        publicKey.length, ...publicKey,
      ]);

      txParts.add(_reverseBytes(_hexToBytes(inp['txid'] as String)));
      txParts.add(_writeUint32LE(inp['vout'] as int));
      txParts.add(_writeVarInt(scriptSig.length));
      txParts.add(scriptSig);
      txParts.add(_writeUint32LE(0xffffffff));
    }

    txParts.add(_writeVarInt(outputs.length));
    for (final out in outputs) {
      txParts.add(_writeUint64LE(out.value));
      txParts.add(_writeVarInt(out.script.length));
      txParts.add(out.script);
    }

    txParts.add(_writeUint32LE(0)); // locktime
    return _concat(txParts);
  }

  // --- Helpers ---

  static Uint8List _buildP2PKHScript(Uint8List pubkeyHash) {
    // OP_DUP OP_HASH160 <20 bytes> OP_EQUALVERIFY OP_CHECKSIG
    return Uint8List.fromList([0x76, 0xa9, 0x14, ...pubkeyHash, 0x88, 0xac]);
  }

  static Uint8List _writeVarInt(int value) {
    if (value < 0xfd) return Uint8List.fromList([value]);
    if (value <= 0xffff) {
      return Uint8List.fromList([0xfd, value & 0xff, (value >> 8) & 0xff]);
    }
    return Uint8List.fromList([
      0xfe,
      value & 0xff,
      (value >> 8) & 0xff,
      (value >> 16) & 0xff,
      (value >> 24) & 0xff,
    ]);
  }

  static Uint8List _writeUint32LE(int value) {
    final buf = Uint8List(4);
    buf[0] = value & 0xff;
    buf[1] = (value >> 8) & 0xff;
    buf[2] = (value >> 16) & 0xff;
    buf[3] = (value >> 24) & 0xff;
    return buf;
  }

  static Uint8List _writeUint64LE(int value) {
    final buf = Uint8List(8);
    buf[0] = value & 0xff;
    buf[1] = (value >> 8) & 0xff;
    buf[2] = (value >> 16) & 0xff;
    buf[3] = (value >> 24) & 0xff;
    final high = value ~/ 0x100000000;
    buf[4] = high & 0xff;
    buf[5] = (high >> 8) & 0xff;
    buf[6] = (high >> 16) & 0xff;
    buf[7] = (high >> 24) & 0xff;
    return buf;
  }

  static Uint8List _hexToBytes(String hex) {
    final bytes = Uint8List(hex.length ~/ 2);
    for (int i = 0; i < hex.length; i += 2) {
      bytes[i ~/ 2] = int.parse(hex.substring(i, i + 2), radix: 16);
    }
    return bytes;
  }

  static String _bytesToHex(Uint8List bytes) {
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  static Uint8List _reverseBytes(Uint8List bytes) {
    return Uint8List.fromList(bytes.reversed.toList());
  }

  static Uint8List _concat(List<Uint8List> arrays) {
    final totalLen = arrays.fold<int>(0, (s, a) => s + a.length);
    final result = Uint8List(totalLen);
    int offset = 0;
    for (final arr in arrays) {
      result.setAll(offset, arr);
      offset += arr.length;
    }
    return result;
  }

  static Uint8List _doubleSha256(Uint8List data) {
    final d1 = SHA256Digest();
    final hash1 = Uint8List(32);
    d1.update(data, 0, data.length);
    d1.doFinal(hash1, 0);

    final d2 = SHA256Digest();
    final hash2 = Uint8List(32);
    d2.update(hash1, 0, hash1.length);
    d2.doFinal(hash2, 0);

    return hash2;
  }

  /// DER-encode an ECDSA signature using secp256k1.
  static Uint8List _signDER(Uint8List privateKey, Uint8List hash) {
    final params = ECDomainParameters('secp256k1');
    final signer = ECDSASigner(null, HMac(SHA256Digest(), 64));
    signer.init(true, PrivateKeyParameter<ECPrivateKey>(
      ECPrivateKey(
        _bytesToBigInt(privateKey),
        params,
      ),
    ));

    final sig = signer.generateSignature(hash) as ECSignature;

    // Low-S normalization (BIP 62/146)
    final halfOrder = params.n >> 1;
    BigInt s = sig.s;
    if (s > halfOrder) {
      s = params.n - s;
    }

    // DER encode
    final rBytes = _bigIntToBytes(sig.r);
    final sBytes = _bigIntToBytes(s);

    final rLen = rBytes.length;
    final sLen = sBytes.length;
    final totalLen = 2 + rLen + 2 + sLen;

    return Uint8List.fromList([
      0x30, totalLen,
      0x02, rLen, ...rBytes,
      0x02, sLen, ...sBytes,
    ]);
  }

  static BigInt _bytesToBigInt(Uint8List bytes) {
    BigInt result = BigInt.zero;
    for (int i = 0; i < bytes.length; i++) {
      result = (result << 8) | BigInt.from(bytes[i]);
    }
    return result;
  }

  static Uint8List _bigIntToBytes(BigInt value) {
    final hexStr = value.toRadixString(16);
    final hex = hexStr.length.isOdd ? '0$hexStr' : hexStr;
    final bytes = _hexToBytes(hex);
    // Add leading zero if high bit is set (DER requirement)
    if (bytes.isNotEmpty && bytes[0] >= 0x80) {
      return Uint8List.fromList([0x00, ...bytes]);
    }
    return bytes;
  }
}

class _TxOutput {
  final Uint8List script;
  final int value;
  _TxOutput({required this.script, required this.value});
}
