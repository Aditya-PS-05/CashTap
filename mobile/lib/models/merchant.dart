class Merchant {
  final String id;
  final String businessName;
  final String email;
  final String walletAddress;
  final bool zeroConfEnabled;
  final double minimumAmount;
  final String? avatarUrl;
  final DateTime createdAt;
  final DateTime updatedAt;

  Merchant({
    required this.id,
    required this.businessName,
    required this.email,
    required this.walletAddress,
    this.zeroConfEnabled = true,
    this.minimumAmount = 0.0001,
    this.avatarUrl,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : createdAt = createdAt ?? DateTime.now(),
        updatedAt = updatedAt ?? DateTime.now();

  factory Merchant.fromJson(Map<String, dynamic> json) {
    return Merchant(
      id: json['id'] as String? ?? '',
      businessName: json['business_name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      walletAddress: json['wallet_address'] as String? ?? '',
      zeroConfEnabled: json['zero_conf_enabled'] as bool? ?? true,
      minimumAmount: (json['minimum_amount'] as num?)?.toDouble() ?? 0.0001,
      avatarUrl: json['avatar_url'] as String?,
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
      'wallet_address': walletAddress,
      'zero_conf_enabled': zeroConfEnabled,
      'minimum_amount': minimumAmount,
      'avatar_url': avatarUrl,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
    };
  }

  Merchant copyWith({
    String? id,
    String? businessName,
    String? email,
    String? walletAddress,
    bool? zeroConfEnabled,
    double? minimumAmount,
    String? avatarUrl,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Merchant(
      id: id ?? this.id,
      businessName: businessName ?? this.businessName,
      email: email ?? this.email,
      walletAddress: walletAddress ?? this.walletAddress,
      zeroConfEnabled: zeroConfEnabled ?? this.zeroConfEnabled,
      minimumAmount: minimumAmount ?? this.minimumAmount,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
