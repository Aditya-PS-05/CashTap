enum InvoiceStatus {
  draft,
  sent,
  paid,
  overdue,
  cancelled;

  static InvoiceStatus fromString(String value) {
    switch (value.toLowerCase()) {
      case 'sent':
        return InvoiceStatus.sent;
      case 'paid':
        return InvoiceStatus.paid;
      case 'overdue':
        return InvoiceStatus.overdue;
      case 'cancelled':
        return InvoiceStatus.cancelled;
      default:
        return InvoiceStatus.draft;
    }
  }

  String get displayName {
    switch (this) {
      case InvoiceStatus.draft:
        return 'Draft';
      case InvoiceStatus.sent:
        return 'Sent';
      case InvoiceStatus.paid:
        return 'Paid';
      case InvoiceStatus.overdue:
        return 'Overdue';
      case InvoiceStatus.cancelled:
        return 'Cancelled';
    }
  }
}

class InvoiceItem {
  final String description;
  final int quantity;
  final double unitPriceUsd;

  InvoiceItem({
    required this.description,
    required this.quantity,
    required this.unitPriceUsd,
  });

  double get totalUsd => quantity * unitPriceUsd;

  factory InvoiceItem.fromJson(Map<String, dynamic> json) {
    return InvoiceItem(
      description: json['description'] as String? ?? '',
      quantity: json['quantity'] as int? ?? 1,
      unitPriceUsd: (json['unit_price_usd'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'description': description,
      'quantity': quantity,
      'unit_price_usd': unitPriceUsd,
    };
  }
}

class Invoice {
  final String id;
  final String merchantId;
  final String customerEmail;
  final String customerName;
  final List<InvoiceItem> items;
  final double totalUsd;
  final double? totalBch;
  final InvoiceStatus status;
  final String? paymentLinkId;
  final String memo;
  final DateTime createdAt;
  final DateTime dueDate;

  Invoice({
    required this.id,
    required this.merchantId,
    required this.customerEmail,
    required this.customerName,
    required this.items,
    required this.totalUsd,
    this.totalBch,
    this.status = InvoiceStatus.draft,
    this.paymentLinkId,
    this.memo = '',
    DateTime? createdAt,
    DateTime? dueDate,
  })  : createdAt = createdAt ?? DateTime.now(),
        dueDate = dueDate ?? DateTime.now().add(const Duration(days: 30));

  factory Invoice.fromJson(Map<String, dynamic> json) {
    return Invoice(
      id: json['id'] as String? ?? '',
      merchantId: json['merchant_id'] as String? ?? '',
      customerEmail: json['customer_email'] as String? ?? '',
      customerName: json['customer_name'] as String? ?? '',
      items: (json['items'] as List<dynamic>?)
              ?.map((e) => InvoiceItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      totalUsd: (json['total_usd'] as num?)?.toDouble() ?? 0.0,
      totalBch: (json['total_bch'] as num?)?.toDouble(),
      status: InvoiceStatus.fromString(json['status'] as String? ?? 'draft'),
      paymentLinkId: json['payment_link_id'] as String?,
      memo: json['memo'] as String? ?? '',
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : null,
      dueDate: json['due_date'] != null
          ? DateTime.parse(json['due_date'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'merchant_id': merchantId,
      'customer_email': customerEmail,
      'customer_name': customerName,
      'items': items.map((e) => e.toJson()).toList(),
      'total_usd': totalUsd,
      'total_bch': totalBch,
      'status': status.name,
      'payment_link_id': paymentLinkId,
      'memo': memo,
      'created_at': createdAt.toIso8601String(),
      'due_date': dueDate.toIso8601String(),
    };
  }
}
