enum ContractType {
  escrow,
  splitPayment,
  savingsVault;

  static ContractType fromString(String value) {
    switch (value.toUpperCase()) {
      case 'SPLIT_PAYMENT':
        return ContractType.splitPayment;
      case 'SAVINGS_VAULT':
        return ContractType.savingsVault;
      default:
        return ContractType.escrow;
    }
  }

  String get apiValue {
    switch (this) {
      case ContractType.escrow:
        return 'ESCROW';
      case ContractType.splitPayment:
        return 'SPLIT_PAYMENT';
      case ContractType.savingsVault:
        return 'SAVINGS_VAULT';
    }
  }

  String get displayName {
    switch (this) {
      case ContractType.escrow:
        return 'Escrow';
      case ContractType.splitPayment:
        return 'Split Payment';
      case ContractType.savingsVault:
        return 'Savings Vault';
    }
  }
}

enum ContractStatus {
  active,
  completed,
  expired;

  static ContractStatus fromString(String value) {
    switch (value.toUpperCase()) {
      case 'COMPLETED':
        return ContractStatus.completed;
      case 'EXPIRED':
        return ContractStatus.expired;
      default:
        return ContractStatus.active;
    }
  }

  String get displayName {
    switch (this) {
      case ContractStatus.active:
        return 'Active';
      case ContractStatus.completed:
        return 'Completed';
      case ContractStatus.expired:
        return 'Expired';
    }
  }

  String get apiValue => name.toUpperCase();
}

class ContractInstance {
  final String id;
  final ContractType type;
  final String address;
  final String? tokenAddress;
  final Map<String, dynamic> constructorArgs;
  final ContractStatus status;
  final DateTime createdAt;

  ContractInstance({
    required this.id,
    required this.type,
    required this.address,
    this.tokenAddress,
    this.constructorArgs = const {},
    this.status = ContractStatus.active,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  factory ContractInstance.fromJson(Map<String, dynamic> json) {
    return ContractInstance(
      id: json['id'] as String? ?? '',
      type: ContractType.fromString(json['type'] as String? ?? 'ESCROW'),
      address: json['address'] as String? ?? '',
      tokenAddress: json['token_address'] as String?,
      constructorArgs: json['constructor_args'] as Map<String, dynamic>? ?? {},
      status: ContractStatus.fromString(json['status'] as String? ?? 'ACTIVE'),
      createdAt: json['created_at'] != null
          ? DateTime.tryParse(json['created_at'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'type': type.apiValue,
      'address': address,
      'token_address': tokenAddress,
      'constructor_args': constructorArgs,
      'status': status.apiValue,
      'created_at': createdAt.toIso8601String(),
    };
  }

  String get shortAddress {
    if (address.length <= 20) return address;
    return '${address.substring(0, 16)}...${address.substring(address.length - 6)}';
  }
}
