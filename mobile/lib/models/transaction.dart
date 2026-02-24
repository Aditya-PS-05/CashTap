enum TransactionStatus {
  pending,
  instant,   // 0-conf
  confirmed, // 1+ confirmations
  failed;

  static TransactionStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'instant':
        return TransactionStatus.instant;
      case 'confirmed':
        return TransactionStatus.confirmed;
      case 'failed':
        return TransactionStatus.failed;
      default:
        return TransactionStatus.pending;
    }
  }

  String get displayName {
    switch (this) {
      case TransactionStatus.pending:
        return 'Pending';
      case TransactionStatus.instant:
        return 'Instant';
      case TransactionStatus.confirmed:
        return 'Confirmed';
      case TransactionStatus.failed:
        return 'Failed';
    }
  }
}

enum TransactionType {
  incoming,
  outgoing;

  static TransactionType fromString(String value) {
    switch (value.toLowerCase()) {
      case 'outgoing':
        return TransactionType.outgoing;
      default:
        return TransactionType.incoming;
    }
  }
}

class LoyaltyTokenInfo {
  final String tokenName;
  final String tokenSymbol;
  final double amount;
  final String? tokenCategory;

  LoyaltyTokenInfo({
    required this.tokenName,
    required this.tokenSymbol,
    required this.amount,
    this.tokenCategory,
  });

  factory LoyaltyTokenInfo.fromJson(Map<String, dynamic> json) {
    return LoyaltyTokenInfo(
      tokenName: json['token_name'] as String? ?? '',
      tokenSymbol: json['token_symbol'] as String? ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0,
      tokenCategory: json['token_category'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    'token_name': tokenName,
    'token_symbol': tokenSymbol,
    'amount': amount,
    'token_category': tokenCategory,
  };
}

class ReceiptNftInfo {
  final String tokenCategory;
  final String commitment;
  final String? merchantName;
  final double? amountBch;
  final DateTime? timestamp;

  ReceiptNftInfo({
    required this.tokenCategory,
    required this.commitment,
    this.merchantName,
    this.amountBch,
    this.timestamp,
  });

  factory ReceiptNftInfo.fromJson(Map<String, dynamic> json) {
    return ReceiptNftInfo(
      tokenCategory: json['token_category'] as String? ?? '',
      commitment: json['commitment'] as String? ?? '',
      merchantName: json['merchant_name'] as String?,
      amountBch: (json['amount_bch'] as num?)?.toDouble(),
      timestamp: json['timestamp'] != null
          ? DateTime.parse(json['timestamp'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'token_category': tokenCategory,
    'commitment': commitment,
    'merchant_name': merchantName,
    'amount_bch': amountBch,
    'timestamp': timestamp?.toIso8601String(),
  };
}

class Transaction {
  final String id;
  final String txHash;
  final String merchantId;
  final double amountBch;
  final double amountUsd;
  final String senderAddress;
  final String recipientAddress;
  final TransactionStatus status;
  final TransactionType type;
  final int confirmations;
  final String memo;
  final String? paymentLinkId;
  final DateTime createdAt;
  final DateTime? confirmedAt;
  final LoyaltyTokenInfo? loyaltyTokens;
  final ReceiptNftInfo? receiptNft;

  Transaction({
    required this.id,
    required this.txHash,
    required this.merchantId,
    required this.amountBch,
    required this.amountUsd,
    required this.senderAddress,
    required this.recipientAddress,
    this.status = TransactionStatus.pending,
    this.type = TransactionType.incoming,
    this.confirmations = 0,
    this.memo = '',
    this.paymentLinkId,
    DateTime? createdAt,
    this.confirmedAt,
    this.loyaltyTokens,
    this.receiptNft,
  }) : createdAt = createdAt ?? DateTime.now();

  factory Transaction.fromJson(Map<String, dynamic> json) {
    // API returns amount_satoshis (BigInt string) — compute BCH and USD
    final amountSats =
        int.tryParse(json['amount_satoshis']?.toString() ?? '0') ?? 0;
    final computedBch = amountSats / 100000000.0;
    final usdRate = (json['usd_rate_at_time'] as num?)?.toDouble();
    final computedUsd = usdRate != null ? computedBch * usdRate : 0.0;

    // Memo comes from nested payment_link if present
    final paymentLink = json['payment_link'] as Map<String, dynamic>?;
    final memo = json['memo'] as String? ??
        paymentLink?['memo'] as String? ??
        '';

    return Transaction(
      id: json['id'] as String? ?? '',
      txHash: json['tx_hash'] as String? ?? '',
      merchantId: json['merchant_id'] as String? ?? '',
      amountBch: (json['amount_bch'] as num?)?.toDouble() ?? computedBch,
      amountUsd: (json['amount_usd'] as num?)?.toDouble() ?? computedUsd,
      senderAddress: json['sender_address'] as String? ?? '',
      recipientAddress: json['recipient_address'] as String? ?? '',
      status: TransactionStatus.fromString(json['status'] as String? ?? 'pending'),
      type: TransactionType.fromString(json['type'] as String? ?? 'incoming'),
      confirmations: json['confirmations'] as int? ?? 0,
      memo: memo,
      paymentLinkId: json['payment_link_id'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      confirmedAt: json['confirmed_at'] != null
          ? DateTime.parse(json['confirmed_at'] as String)
          : null,
      loyaltyTokens: json['loyalty_tokens'] != null
          ? LoyaltyTokenInfo.fromJson(json['loyalty_tokens'] as Map<String, dynamic>)
          : null,
      receiptNft: json['receipt_nft'] != null
          ? ReceiptNftInfo.fromJson(json['receipt_nft'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'tx_hash': txHash,
      'merchant_id': merchantId,
      'amount_bch': amountBch,
      'amount_usd': amountUsd,
      'sender_address': senderAddress,
      'recipient_address': recipientAddress,
      'status': status.name,
      'type': type.name,
      'confirmations': confirmations,
      'memo': memo,
      'payment_link_id': paymentLinkId,
      'created_at': createdAt.toIso8601String(),
      'confirmed_at': confirmedAt?.toIso8601String(),
      'loyalty_tokens': loyaltyTokens?.toJson(),
      'receipt_nft': receiptNft?.toJson(),
    };
  }

  String get shortTxHash {
    if (txHash.length <= 16) return txHash;
    return '${txHash.substring(0, 8)}...${txHash.substring(txHash.length - 8)}';
  }

  String get shortSenderAddress {
    if (senderAddress.length <= 20) return senderAddress;
    return '${senderAddress.substring(0, 12)}...${senderAddress.substring(senderAddress.length - 6)}';
  }
}
