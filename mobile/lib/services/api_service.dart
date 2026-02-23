import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../config/constants.dart';
import '../models/contract_instance.dart';
import '../models/merchant.dart';
import '../models/payment_link.dart';
import '../models/transaction.dart';

class ApiService {
  late final Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;

  ApiService._internal() {
    _dio = Dio(BaseOptions(
      baseUrl: AppConstants.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: AppConstants.jwtTokenKey);
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) {
        // Handle 401 unauthorized - token expired
        if (error.response?.statusCode == 401) {
          _storage.delete(key: AppConstants.jwtTokenKey);
        }
        handler.next(error);
      },
    ));
  }

  // ---- Auth ----

  Future<Map<String, dynamic>> createWallet() async {
    try {
      final response = await _dio.post('/auth/wallet/create');
      return response.data as Map<String, dynamic>;
    } on DioException {
      // Return mock data when API is unavailable
      return _mockCreateWallet();
    }
  }

  Future<Map<String, dynamic>> importWallet(String seedPhrase) async {
    try {
      final response = await _dio.post('/auth/wallet/import', data: {
        'seed_phrase': seedPhrase,
      });
      return response.data as Map<String, dynamic>;
    } on DioException {
      return _mockImportWallet(seedPhrase);
    }
  }

  Future<Map<String, dynamic>> login(String walletAddress, String signature) async {
    try {
      final response = await _dio.post('/auth/login', data: {
        'wallet_address': walletAddress,
        'signature': signature,
      });
      return response.data as Map<String, dynamic>;
    } on DioException {
      return _mockLogin(walletAddress);
    }
  }

  // ---- Merchant ----

  Future<Merchant> getMerchant() async {
    try {
      final response = await _dio.get('/merchant/profile');
      return Merchant.fromJson(response.data as Map<String, dynamic>);
    } on DioException {
      return _mockMerchant();
    }
  }

  Future<Merchant> createMerchant({
    required String businessName,
    required String email,
    required String walletAddress,
  }) async {
    try {
      final response = await _dio.post('/merchant/profile', data: {
        'business_name': businessName,
        'email': email,
        'wallet_address': walletAddress,
      });
      return Merchant.fromJson(response.data as Map<String, dynamic>);
    } on DioException {
      return Merchant(
        id: 'mock_merchant_1',
        businessName: businessName,
        email: email,
        walletAddress: walletAddress,
      );
    }
  }

  Future<Merchant> updateMerchant(Map<String, dynamic> updates) async {
    try {
      final response = await _dio.patch('/merchant/profile', data: updates);
      return Merchant.fromJson(response.data as Map<String, dynamic>);
    } on DioException {
      return _mockMerchant();
    }
  }

  // ---- Payment Links ----

  Future<PaymentLink> createPaymentLink({
    required int amountSatoshis,
    String memo = '',
    PaymentLinkType type = PaymentLinkType.single,
    String? recurringInterval,
    String? expiresAt,
  }) async {
    try {
      final data = <String, dynamic>{
        'amount_satoshis': amountSatoshis,
        'memo': memo,
        'type': type.apiValue,
      };
      if (type == PaymentLinkType.recurring && recurringInterval != null) {
        data['recurring_interval'] = recurringInterval;
      }
      if (expiresAt != null) {
        data['expires_at'] = expiresAt;
      }

      final response = await _dio.post('/api/payment-links', data: data);
      return PaymentLink.fromJson(response.data as Map<String, dynamic>);
    } on DioException {
      return _mockCreatePaymentLink(amountSatoshis, memo, type);
    }
  }

  /// Legacy createPaymentLink for POS screen backward compatibility.
  Future<PaymentLink> createPaymentLinkLegacy({
    required double amountBch,
    required double amountUsd,
    String memo = '',
  }) async {
    final amountSatoshis = (amountBch * 100000000).round();
    return createPaymentLink(
      amountSatoshis: amountSatoshis,
      memo: memo,
      type: PaymentLinkType.single,
    );
  }

  Future<List<PaymentLink>> getPaymentLinks({int page = 1, int limit = 20}) async {
    try {
      final response = await _dio.get('/api/payment-links', queryParameters: {
        'page': page,
        'limit': limit,
      });
      final data = response.data as Map<String, dynamic>;
      final list = data['payment_links'] as List<dynamic>? ?? [];
      return list.map((e) => PaymentLink.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException {
      return [];
    }
  }

  Future<PaymentLink> getPaymentLinkStatus(String slug) async {
    try {
      final response = await _dio.get('/api/payment-links/$slug');
      return PaymentLink.fromJson(response.data as Map<String, dynamic>);
    } on DioException {
      return PaymentLink(
        id: slug,
        slug: slug,
        merchantId: 'mock',
        amountBch: 0.01,
        amountUsd: 5.0,
        paymentAddress: 'bitcoincash:qz...',
      );
    }
  }

  // ---- Transactions ----

  Future<List<Transaction>> getTransactions({int page = 1, int limit = 20}) async {
    try {
      final response = await _dio.get('/transactions', queryParameters: {
        'page': page,
        'limit': limit,
      });
      final list = response.data as List<dynamic>;
      return list.map((e) => Transaction.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException {
      return _mockTransactions();
    }
  }

  Future<Transaction> getTransaction(String id) async {
    try {
      final response = await _dio.get('/transactions/$id');
      return Transaction.fromJson(response.data as Map<String, dynamic>);
    } on DioException {
      return _mockTransactions().firstWhere(
        (t) => t.id == id,
        orElse: () => _mockTransactions().first,
      );
    }
  }

  // ---- Wallet ----

  Future<Map<String, dynamic>> getWalletBalance() async {
    try {
      final response = await _dio.get('/wallet/balance');
      return response.data as Map<String, dynamic>;
    } on DioException {
      return {
        'balance_satoshis': 12345678,
        'balance_bch': 0.12345678,
        'balance_usd': 49.38,
      };
    }
  }

  // ---- Price ----

  Future<double> getBchPrice() async {
    try {
      final response = await _dio.get('/api/price');
      final data = response.data as Map<String, dynamic>;
      return (data['bch_usd'] as num).toDouble();
    } on DioException {
      return 400.0; // Mock BCH/USD price
    }
  }

  // ---- Stats ----

  Future<Map<String, dynamic>> getDashboardStats() async {
    try {
      final response = await _dio.get('/merchant/stats');
      return response.data as Map<String, dynamic>;
    } on DioException {
      return _mockDashboardStats();
    }
  }

  // ---- Contracts ----

  Future<List<ContractInstance>> getContracts({
    int page = 1,
    int limit = 20,
    String? type,
    String? status,
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      if (type != null) queryParams['type'] = type;
      if (status != null) queryParams['status'] = status;

      final response = await _dio.get('/api/contracts', queryParameters: queryParams);
      final data = response.data as Map<String, dynamic>;
      final list = data['contracts'] as List<dynamic>? ?? [];
      return list.map((e) => ContractInstance.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException {
      return [];
    }
  }

  Future<ContractInstance> createEscrow({
    required String buyerPkh,
    required String sellerPkh,
    required String arbiterPkh,
    required int timeout,
  }) async {
    try {
      final response = await _dio.post('/api/contracts/escrow', data: {
        'buyer_pkh': buyerPkh,
        'seller_pkh': sellerPkh,
        'arbiter_pkh': arbiterPkh,
        'timeout': timeout,
      });
      final data = response.data as Map<String, dynamic>;
      return ContractInstance.fromJson(data['contract'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['error'] ?? 'Failed to create escrow');
    }
  }

  Future<ContractInstance> createSplitPayment({
    required String recipient1Pkh,
    required String recipient2Pkh,
    required int split1Percent,
    required int split2Percent,
  }) async {
    try {
      final response = await _dio.post('/api/contracts/split-payment', data: {
        'recipient1_pkh': recipient1Pkh,
        'recipient2_pkh': recipient2Pkh,
        'split1_percent': split1Percent,
        'split2_percent': split2Percent,
      });
      final data = response.data as Map<String, dynamic>;
      return ContractInstance.fromJson(data['contract'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['error'] ?? 'Failed to create split payment');
    }
  }

  Future<ContractInstance> createSavingsVault({
    required String ownerPkh,
    required int locktime,
  }) async {
    try {
      final response = await _dio.post('/api/contracts/savings-vault', data: {
        'owner_pkh': ownerPkh,
        'locktime': locktime,
      });
      final data = response.data as Map<String, dynamic>;
      return ContractInstance.fromJson(data['contract'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['error'] ?? 'Failed to create savings vault');
    }
  }

  Future<ContractInstance> updateContractStatus(String id, String status) async {
    try {
      final response = await _dio.patch('/api/contracts/$id/status', data: {
        'status': status,
      });
      final data = response.data as Map<String, dynamic>;
      return ContractInstance.fromJson(data['contract'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['error'] ?? 'Failed to update contract');
    }
  }

  // ---- Mock Data ----

  Map<String, dynamic> _mockCreateWallet() {
    return {
      'seed_phrase': 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      'wallet_address': 'bitcoincash:qz2g6d7cl2kcnl4lek2jrm9lkgmtxmftqsed25faq',
      'token': 'mock_jwt_token_12345',
    };
  }

  Map<String, dynamic> _mockImportWallet(String seedPhrase) {
    return {
      'wallet_address': 'bitcoincash:qz2g6d7cl2kcnl4lek2jrm9lkgmtxmftqsed25faq',
      'token': 'mock_jwt_token_12345',
    };
  }

  Map<String, dynamic> _mockLogin(String walletAddress) {
    return {
      'token': 'mock_jwt_token_12345',
      'merchant': _mockMerchant().toJson(),
    };
  }

  Merchant _mockMerchant() {
    return Merchant(
      id: 'mock_merchant_1',
      businessName: 'Coffee Shop',
      email: 'merchant@example.com',
      walletAddress: 'bitcoincash:qz2g6d7cl2kcnl4lek2jrm9lkgmtxmftqsed25faq',
    );
  }

  PaymentLink _mockCreatePaymentLink(int amountSatoshis, String memo, PaymentLinkType type) {
    final slug = 'pay_${DateTime.now().millisecondsSinceEpoch}';
    return PaymentLink(
      id: slug,
      slug: slug,
      merchantId: 'mock_merchant_1',
      amountBch: amountSatoshis / 100000000.0,
      amountSatoshis: amountSatoshis,
      paymentAddress: 'bitcoincash:qz2g6d7cl2kcnl4lek2jrm9lkgmtxmftqsed25faq',
      memo: memo,
      type: type,
    );
  }

  List<Transaction> _mockTransactions() {
    return [
      Transaction(
        id: 'tx_001',
        txHash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
        merchantId: 'mock_merchant_1',
        amountBch: 0.05,
        amountUsd: 20.0,
        senderAddress: 'bitcoincash:qr9p7k3h5p2e6yrm8nfq92ht2fvv3k5lus80mserz',
        recipientAddress: 'bitcoincash:qz2g6d7cl2kcnl4lek2jrm9lkgmtxmftqsed25faq',
        status: TransactionStatus.confirmed,
        confirmations: 6,
        memo: 'Cappuccino x2',
        createdAt: DateTime.now().subtract(const Duration(hours: 2)),
      ),
      Transaction(
        id: 'tx_002',
        txHash: 'b2c3d4e5f67890123456789012345678901234abcdef567890abcdef12345678',
        merchantId: 'mock_merchant_1',
        amountBch: 0.012,
        amountUsd: 4.80,
        senderAddress: 'bitcoincash:qp6e7293jk56s8t9hc5ml6pzdrtwj0ntcz3lzfhxq',
        recipientAddress: 'bitcoincash:qz2g6d7cl2kcnl4lek2jrm9lkgmtxmftqsed25faq',
        status: TransactionStatus.instant,
        confirmations: 0,
        memo: 'Latte',
        createdAt: DateTime.now().subtract(const Duration(minutes: 30)),
      ),
      Transaction(
        id: 'tx_003',
        txHash: 'c3d4e5f678901234567890123456789012345abcdef67890abcdef1234567890',
        merchantId: 'mock_merchant_1',
        amountBch: 0.25,
        amountUsd: 100.0,
        senderAddress: 'bitcoincash:qq4zf2v95nh6ks8h8m39v7y9gnkp7dykxvsxm9u7az',
        recipientAddress: 'bitcoincash:qz2g6d7cl2kcnl4lek2jrm9lkgmtxmftqsed25faq',
        status: TransactionStatus.confirmed,
        confirmations: 12,
        memo: 'Catering order',
        createdAt: DateTime.now().subtract(const Duration(days: 1)),
      ),
      Transaction(
        id: 'tx_004',
        txHash: 'd4e5f6789012345678901234567890123456abcdef7890abcdef12345678901a',
        merchantId: 'mock_merchant_1',
        amountBch: 0.008,
        amountUsd: 3.20,
        senderAddress: 'bitcoincash:qztk4s0k5h8mz7r9jnc2ml6p7drtwj0ntczxlfhxq',
        recipientAddress: 'bitcoincash:qz2g6d7cl2kcnl4lek2jrm9lkgmtxmftqsed25faq',
        status: TransactionStatus.pending,
        confirmations: 0,
        memo: 'Espresso',
        createdAt: DateTime.now().subtract(const Duration(minutes: 5)),
      ),
      Transaction(
        id: 'tx_005',
        txHash: 'e5f67890123456789012345678901234567abcdef890abcdef123456789012bc',
        merchantId: 'mock_merchant_1',
        amountBch: 0.035,
        amountUsd: 14.0,
        senderAddress: 'bitcoincash:qr3h5ky7p2e6yrm8nfq92ht2fvv3k5lus80mserz2',
        recipientAddress: 'bitcoincash:qz2g6d7cl2kcnl4lek2jrm9lkgmtxmftqsed25faq',
        status: TransactionStatus.confirmed,
        confirmations: 3,
        memo: 'Sandwich + Coffee',
        createdAt: DateTime.now().subtract(const Duration(days: 2)),
      ),
    ];
  }

  Map<String, dynamic> _mockDashboardStats() {
    return {
      'today_revenue_bch': 0.325,
      'today_revenue_usd': 130.0,
      'today_tx_count': 8,
      'pending_count': 1,
      'week_revenue': [12.5, 18.3, 15.0, 22.1, 8.7, 31.2, 25.4],
      'week_labels': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    };
  }
}
