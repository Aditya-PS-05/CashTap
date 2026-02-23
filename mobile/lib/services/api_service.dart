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

  /// Request a challenge nonce for the given BCH address.
  /// Returns { nonce, message, expires_in }.
  Future<Map<String, dynamic>> requestChallenge(String address) async {
    final response = await _dio.post('/api/auth/challenge', data: {
      'address': address,
    });
    return response.data as Map<String, dynamic>;
  }

  /// Verify a signed challenge and obtain JWT tokens.
  /// Returns { access_token, refresh_token, token_type, expires_in, merchant }.
  Future<Map<String, dynamic>> verifyChallenge({
    required String address,
    required String signature,
    required String nonce,
  }) async {
    final response = await _dio.post('/api/auth/verify', data: {
      'address': address,
      'signature': signature,
      'nonce': nonce,
    });
    return response.data as Map<String, dynamic>;
  }

  // ---- Merchant ----

  Future<Merchant> getMerchant() async {
    final response = await _dio.get('/api/merchants/me');
    final data = response.data as Map<String, dynamic>;
    return Merchant.fromJson(data['merchant'] as Map<String, dynamic>);
  }

  Future<Merchant> createMerchant({
    required String businessName,
    required String email,
    required String walletAddress,
  }) async {
    final response = await _dio.post('/api/merchants', data: {
      'business_name': businessName,
      'email': email,
      'wallet_address': walletAddress,
    });
    final data = response.data as Map<String, dynamic>;
    final merchant = data['merchant'] as Map<String, dynamic>? ?? data;
    return Merchant.fromJson(merchant);
  }

  Future<Merchant> updateMerchant(Map<String, dynamic> updates) async {
    final response = await _dio.put('/api/merchants/me', data: updates);
    final data = response.data as Map<String, dynamic>;
    final merchant = data['merchant'] as Map<String, dynamic>? ?? data;
    return Merchant.fromJson(merchant);
  }

  // ---- Payment Links ----

  Future<PaymentLink> createPaymentLink({
    required int amountSatoshis,
    String memo = '',
    PaymentLinkType type = PaymentLinkType.single,
    String? recurringInterval,
    String? expiresAt,
  }) async {
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
    final response = await _dio.get('/api/payment-links/$slug');
    final data = response.data as Map<String, dynamic>;
    final pl = data['payment_link'] as Map<String, dynamic>? ?? data;
    return PaymentLink.fromJson(pl);
  }

  // ---- Transactions ----

  Future<List<Transaction>> getTransactions({int page = 1, int limit = 20}) async {
    try {
      final response = await _dio.get('/api/transactions', queryParameters: {
        'page': page,
        'limit': limit,
      });
      final data = response.data as Map<String, dynamic>;
      final list = data['transactions'] as List<dynamic>? ?? [];
      return list.map((e) => Transaction.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException {
      return [];
    }
  }

  Future<Transaction> getTransaction(String id) async {
    final response = await _dio.get('/api/transactions/$id');
    final data = response.data as Map<String, dynamic>;
    final tx = data['transaction'] as Map<String, dynamic>? ?? data;
    return Transaction.fromJson(tx);
  }

  // ---- Wallet ----

  Future<Map<String, dynamic>> getWalletBalance() async {
    final response = await _dio.get('/api/transactions/stats');
    final data = response.data as Map<String, dynamic>;
    final stats = data['stats'] as Map<String, dynamic>? ?? data;
    return stats;
  }

  // ---- Price ----

  Future<double> getBchPrice() async {
    final response = await _dio.get('/api/price');
    final data = response.data as Map<String, dynamic>;
    return (data['bch_usd'] as num).toDouble();
  }

  // ---- Analytics ----

  Future<Map<String, dynamic>> getAnalytics({String range = '7d'}) async {
    final response = await _dio.get('/api/transactions/analytics', queryParameters: {
      'range': range,
    });
    return response.data as Map<String, dynamic>;
  }

  // ---- Stats ----

  Future<Map<String, dynamic>> getDashboardStats() async {
    final response = await _dio.get('/api/transactions/stats');
    final data = response.data as Map<String, dynamic>;
    return data['stats'] as Map<String, dynamic>? ?? data;
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

  Future<ContractInstance> createMultiSplitPayment({
    required List<Map<String, dynamic>> recipients,
  }) async {
    try {
      final response = await _dio.post('/api/contracts/split-payment-multi', data: {
        'recipients': recipients,
      });
      final data = response.data as Map<String, dynamic>;
      return ContractInstance.fromJson(data['contract'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['error'] ?? 'Failed to create multi-split payment');
    }
  }

  Future<ContractInstance> releaseEscrow(String id) async {
    try {
      final response = await _dio.post('/api/contracts/$id/release');
      final data = response.data as Map<String, dynamic>;
      return ContractInstance.fromJson(data['contract'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['error'] ?? 'Failed to release escrow');
    }
  }

  Future<ContractInstance> refundEscrow(String id) async {
    try {
      final response = await _dio.post('/api/contracts/$id/refund');
      final data = response.data as Map<String, dynamic>;
      return ContractInstance.fromJson(data['contract'] as Map<String, dynamic>);
    } on DioException catch (e) {
      throw Exception(e.response?.data?['error'] ?? 'Failed to refund escrow');
    }
  }

  Future<Map<String, dynamic>> getPaymentLinkStats(String id) async {
    try {
      final response = await _dio.get('/api/payment-links/$id/stats');
      return response.data as Map<String, dynamic>;
    } on DioException {
      return {
        'total_collected_satoshis': 0,
        'payment_count': 0,
        'last_payment_at': null,
      };
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
}
