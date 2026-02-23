enum PaymentLinkStatus {
  active,
  paid,
  inactive,
  expired,
  cancelled;

  static PaymentLinkStatus fromString(String value) {
    switch (value.toUpperCase()) {
      case 'PAID':
        return PaymentLinkStatus.paid;
      case 'INACTIVE':
        return PaymentLinkStatus.inactive;
      case 'EXPIRED':
        return PaymentLinkStatus.expired;
      case 'CANCELLED':
        return PaymentLinkStatus.cancelled;
      default:
        return PaymentLinkStatus.active;
    }
  }

  String get displayName {
    switch (this) {
      case PaymentLinkStatus.active:
        return 'Active';
      case PaymentLinkStatus.paid:
        return 'Paid';
      case PaymentLinkStatus.inactive:
        return 'Inactive';
      case PaymentLinkStatus.expired:
        return 'Expired';
      case PaymentLinkStatus.cancelled:
        return 'Cancelled';
    }
  }
}

enum PaymentLinkType {
  single,
  multi,
  recurring;

  static PaymentLinkType fromString(String value) {
    switch (value.toUpperCase()) {
      case 'MULTI':
        return PaymentLinkType.multi;
      case 'RECURRING':
        return PaymentLinkType.recurring;
      default:
        return PaymentLinkType.single;
    }
  }

  String get displayName {
    switch (this) {
      case PaymentLinkType.single:
        return 'Single';
      case PaymentLinkType.multi:
        return 'Multi';
      case PaymentLinkType.recurring:
        return 'Recurring';
    }
  }

  String get apiValue {
    switch (this) {
      case PaymentLinkType.single:
        return 'SINGLE';
      case PaymentLinkType.multi:
        return 'MULTI';
      case PaymentLinkType.recurring:
        return 'RECURRING';
    }
  }
}

class PaymentLink {
  final String id;
  final String slug;
  final String merchantId;
  final double amountBch;
  final double amountUsd;
  final int amountSatoshis;
  final String paymentAddress;
  final String memo;
  final PaymentLinkStatus status;
  final PaymentLinkType type;
  final String? recurringInterval;
  final int recurringCount;
  final DateTime? lastPaidAt;
  final String? transactionId;
  final DateTime createdAt;
  final DateTime expiresAt;

  PaymentLink({
    required this.id,
    required this.slug,
    required this.merchantId,
    this.amountBch = 0.0,
    this.amountUsd = 0.0,
    this.amountSatoshis = 0,
    required this.paymentAddress,
    this.memo = '',
    this.status = PaymentLinkStatus.active,
    this.type = PaymentLinkType.single,
    this.recurringInterval,
    this.recurringCount = 0,
    this.lastPaidAt,
    this.transactionId,
    DateTime? createdAt,
    DateTime? expiresAt,
  })  : createdAt = createdAt ?? DateTime.now(),
        expiresAt = expiresAt ?? DateTime.now().add(const Duration(minutes: 15));

  factory PaymentLink.fromJson(Map<String, dynamic> json) {
    // Handle nested payment_link response from API
    final data = json.containsKey('payment_link')
        ? json['payment_link'] as Map<String, dynamic>
        : json;

    final amountSats = int.tryParse(data['amount_satoshis']?.toString() ?? '0') ?? 0;

    return PaymentLink(
      id: data['id'] as String? ?? '',
      slug: data['slug'] as String? ?? '',
      merchantId: data['merchant_id'] as String? ?? '',
      amountBch: (data['amount_bch'] as num?)?.toDouble() ?? amountSats / 100000000.0,
      amountUsd: (data['amount_usd'] as num?)?.toDouble() ?? 0.0,
      amountSatoshis: amountSats,
      paymentAddress: data['payment_address'] as String? ?? '',
      memo: data['memo'] as String? ?? '',
      status: PaymentLinkStatus.fromString(data['status'] as String? ?? 'ACTIVE'),
      type: PaymentLinkType.fromString(data['type'] as String? ?? 'SINGLE'),
      recurringInterval: data['recurring_interval'] as String?,
      recurringCount: data['recurring_count'] as int? ?? 0,
      lastPaidAt: data['last_paid_at'] != null
          ? DateTime.tryParse(data['last_paid_at'] as String)
          : null,
      transactionId: data['transaction_id'] as String?,
      createdAt: data['created_at'] != null
          ? DateTime.tryParse(data['created_at'] as String)
          : null,
      expiresAt: data['expires_at'] != null
          ? DateTime.tryParse(data['expires_at'] as String)
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
      'amount_satoshis': amountSatoshis,
      'payment_address': paymentAddress,
      'memo': memo,
      'status': status.name.toUpperCase(),
      'type': type.apiValue,
      'recurring_interval': recurringInterval,
      'recurring_count': recurringCount,
      'last_paid_at': lastPaidAt?.toIso8601String(),
      'transaction_id': transactionId,
      'created_at': createdAt.toIso8601String(),
      'expires_at': expiresAt.toIso8601String(),
    };
  }

  bool get isExpired => DateTime.now().isAfter(expiresAt);
  bool get isPaid => status == PaymentLinkStatus.paid;
  bool get isRecurring => type == PaymentLinkType.recurring;

  String get paymentUri =>
      'bitcoincash:$paymentAddress?amount=$amountBch${memo.isNotEmpty ? '&message=${Uri.encodeComponent(memo)}' : ''}';
}
