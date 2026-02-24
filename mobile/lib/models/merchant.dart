class Merchant {
  final String id;
  final String? businessName;
  final String email;
  final String? bchAddress;
  final String? merchantAddress;
  final String? role;
  final String? logoUrl;
  final String? webhookUrl;
  final String displayCurrency;
  final DateTime createdAt;
  final DateTime updatedAt;

  Merchant({
    required this.id,
    this.businessName,
    required this.email,
    this.bchAddress,
    this.merchantAddress,
    this.role,
    this.logoUrl,
    this.webhookUrl,
    this.displayCurrency = 'BCH',
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  factory Merchant.fromJson(Map<String, dynamic> json) {
    return Merchant(
      id: json['id'] as String? ?? '',
      businessName: json['business_name'] as String?,
      email: json['email'] as String? ?? '',
      bchAddress: json['bch_address'] as String?,
      merchantAddress: json['merchant_address'] as String?,
      role: json['role'] as String?,
      logoUrl: json['logo_url'] as String?,
      webhookUrl: json['webhook_url'] as String?,
      displayCurrency: json['display_currency'] as String? ?? 'BCH',
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'business_name': businessName,
      'email': email,
      'bch_address': bchAddress,
      'merchant_address': merchantAddress,
      'role': role,
      'logo_url': logoUrl,
      'webhook_url': webhookUrl,
      'display_currency': displayCurrency,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  Merchant copyWith({
    String? id,
    String? businessName,
    String? email,
    String? bchAddress,
    String? merchantAddress,
    String? role,
    String? logoUrl,
    String? webhookUrl,
    String? displayCurrency,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Merchant(
      id: id ?? this.id,
      businessName: businessName ?? this.businessName,
      email: email ?? this.email,
      bchAddress: bchAddress ?? this.bchAddress,
      merchantAddress: merchantAddress ?? this.merchantAddress,
      role: role ?? this.role,
      logoUrl: logoUrl ?? this.logoUrl,
      webhookUrl: webhookUrl ?? this.webhookUrl,
      displayCurrency: displayCurrency ?? this.displayCurrency,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
