enum PaymentLinkStatus {
  active,
  paid,
  expired,
  cancelled;

  static PaymentLinkStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'paid':
        return PaymentLinkStatus.paid;
      case 'expired':
        return PaymentLinkStatus.expired;
      case 'cancelled':
        return PaymentLinkStatus.cancelled;
      default:
        return PaymentLinkStatus.active;
    }
  }
}

class PaymentLink {
  final String id;
  final String slug;
  final String merchantId;
  final double amountBch;
  final double amountUsd;
  final String paymentAddress;
  final String memo;
  final PaymentLinkStatus status;
  final String? transactionId;
  final DateTime createdAt;
  final DateTime expiresAt;

  PaymentLink({
    required this.id,
    required this.slug,
    required this.merchantId,
    required this.amountBch,
    required this.amountUsd,
    required this.paymentAddress,
    this.memo = '',
    this.status = PaymentLinkStatus.active,
    this.transactionId,
    DateTime? createdAt,
    DateTime? expiresAt,
  })  : createdAt = createdAt ?? DateTime.now(),
        expiresAt = expiresAt ?? DateTime.now().add(const Duration(minutes: 15));

  factory PaymentLink.fromJson(Map<String, dynamic> json) {
    return PaymentLink(
      id: json['id'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      merchantId: json['merchant_id'] as String? ?? '',
      amountBch: (json['amount_bch'] as num?)?.toDouble() ?? 0.0,
      amountUsd: (json['amount_usd'] as num?)?.toDouble() ?? 0.0,
      paymentAddress: json['payment_address'] as String? ?? '',
      memo: json['memo'] as String? ?? '',
      status: PaymentLinkStatus.fromString(json['status'] as String? ?? 'active'),
      transactionId: json['transaction_id'] as String?,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      expiresAt: json['expires_at'] != null
          ? DateTime.parse(json['expires_at'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'slug': slug,
      'merchant_id': merchantId,
      'amount_bch': amountBch,
      'amount_usd': amountUsd,
      'payment_address': paymentAddress,
      'memo': memo,
      'status': status.name,
      'transaction_id': transactionId,
      'created_at': createdAt.toIso8601String(),
      'expires_at': expiresAt.toIso8601String(),
    };
  }

  bool get isExpired => DateTime.now().isAfter(expiresAt);
  bool get isPaid => status == PaymentLinkStatus.paid;

  String get paymentUri =>
      'bitcoincash:$paymentAddress?amount=$amountBch${memo.isNotEmpty ? '&message=${Uri.encodeComponent(memo)}' : ''}';
}
