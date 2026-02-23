import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/constants.dart';
import '../models/payment_link.dart';
import '../models/transaction.dart';
import '../services/api_service.dart';

enum PaymentListenStatus {
  idle,
  waiting,
  detected,
  confirmed,
  timeout,
  error,
}

class PaymentProvider extends ChangeNotifier {
  final ApiService _apiService = ApiService();

  List<Transaction> _transactions = [];
  List<PaymentLink> _paymentLinks = [];
  bool _isLoading = false;
  bool _hasError = false;
  String? _errorMessage;
  PaymentListenStatus _listenStatus = PaymentListenStatus.idle;
  Timer? _pollTimer;

  // Dashboard stats
  double _todayRevenueBch = 0;
  double _todayRevenueUsd = 0;
  int _todayTxCount = 0;
  int _pendingCount = 0;
  List<double> _weekRevenue = [];
  List<String> _weekLabels = [];

  // Analytics
  double _weekRevenueUsd = 0;
  double _weekRevenueBch = 0;
  int _weekTxCount = 0;
  double _monthRevenueUsd = 0;
  double _monthRevenueBch = 0;
  int _monthTxCount = 0;
  double _allTimeRevenueUsd = 0;
  double _allTimeRevenueBch = 0;
  int _allTimeTxCount = 0;

  // Pagination
  int _currentPage = 0;
  bool _hasMoreTransactions = true;
  bool _isLoadingMore = false;

  // Offline queue
  List<Map<String, dynamic>> _offlineChargeQueue = [];

  List<Transaction> get transactions => _transactions;
  List<PaymentLink> get paymentLinks => _paymentLinks;
  bool get isLoading => _isLoading;
  bool get hasError => _hasError;
  String? get errorMessage => _errorMessage;
  PaymentListenStatus get listenStatus => _listenStatus;
  bool get hasMoreTransactions => _hasMoreTransactions;
  bool get isLoadingMore => _isLoadingMore;

  double get todayRevenueBch => _todayRevenueBch;
  double get todayRevenueUsd => _todayRevenueUsd;
  int get todayTxCount => _todayTxCount;
  int get pendingCount => _pendingCount;
  List<double> get weekRevenue => _weekRevenue;
  List<String> get weekLabels => _weekLabels;

  double get weekRevenueUsd => _weekRevenueUsd;
  double get weekRevenueBch => _weekRevenueBch;
  int get weekTxCount => _weekTxCount;
  double get monthRevenueUsd => _monthRevenueUsd;
  double get monthRevenueBch => _monthRevenueBch;
  int get monthTxCount => _monthTxCount;
  double get allTimeRevenueUsd => _allTimeRevenueUsd;
  double get allTimeRevenueBch => _allTimeRevenueBch;
  int get allTimeTxCount => _allTimeTxCount;

  /// Fetch all transactions (first page).
  Future<void> fetchTransactions() async {
    _isLoading = true;
    _hasError = false;
    _currentPage = 0;
    notifyListeners();

    try {
      _transactions = await _apiService.getTransactions();
      _hasMoreTransactions = _transactions.length >= AppConstants.transactionsPageSize;
      _errorMessage = null;
      // Cache transactions for offline use
      _cacheTransactions();
    } catch (e) {
      _errorMessage = 'Failed to fetch transactions: $e';
      _hasError = true;
      debugPrint(_errorMessage);
      // Try to load cached transactions
      await _loadCachedTransactions();
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Load more transactions (pagination).
  Future<void> loadMoreTransactions() async {
    if (_isLoadingMore || !_hasMoreTransactions) return;

    _isLoadingMore = true;
    notifyListeners();

    try {
      _currentPage++;
      final moreTxs = await _apiService.getTransactions(page: _currentPage);
      _transactions.addAll(moreTxs);
      _hasMoreTransactions = moreTxs.length >= AppConstants.transactionsPageSize;
    } catch (e) {
      _currentPage--;
      debugPrint('Failed to load more transactions: $e');
    }

    _isLoadingMore = false;
    notifyListeners();
  }

  /// Fetch payment links.
  Future<void> fetchPaymentLinks() async {
    try {
      _paymentLinks = await _apiService.getPaymentLinks();
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to fetch payment links: $e');
    }
  }

  /// Create a new charge / payment link.
  Future<PaymentLink?> createCharge({
    required double amountBch,
    required double amountUsd,
    String memo = '',
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final paymentLink = await _apiService.createPaymentLinkLegacy(
        amountBch: amountBch,
        amountUsd: amountUsd,
        memo: memo,
      );

      _paymentLinks.insert(0, paymentLink);

      _isLoading = false;
      notifyListeners();
      return paymentLink;
    } catch (e) {
      _errorMessage = 'Failed to create charge: $e';
      debugPrint(_errorMessage);
    }

    _isLoading = false;
    notifyListeners();
    return null;
  }

  /// Queue a charge for offline processing.
  void queueOfflineCharge({
    required double amountBch,
    required double amountUsd,
    String memo = '',
  }) {
    _offlineChargeQueue.add({
      'amountBch': amountBch,
      'amountUsd': amountUsd,
      'memo': memo,
      'timestamp': DateTime.now().toIso8601String(),
    });
    notifyListeners();
  }

  /// Sync queued offline charges.
  Future<void> syncOfflineCharges() async {
    if (_offlineChargeQueue.isEmpty) return;

    final queue = List<Map<String, dynamic>>.from(_offlineChargeQueue);
    _offlineChargeQueue.clear();

    for (final charge in queue) {
      try {
        await createCharge(
          amountBch: charge['amountBch'] as double,
          amountUsd: charge['amountUsd'] as double,
          memo: charge['memo'] as String? ?? '',
        );
      } catch (e) {
        _offlineChargeQueue.add(charge);
        debugPrint('Failed to sync offline charge: $e');
      }
    }
  }

  /// Start listening for payment on a specific slug.
  void listenForPayment(String slug) {
    _listenStatus = PaymentListenStatus.waiting;
    notifyListeners();

    _pollTimer?.cancel();

    int pollCount = 0;
    final maxPolls = AppConstants.paymentTimeout.inSeconds ~/
        AppConstants.paymentPollInterval.inSeconds;

    _pollTimer = Timer.periodic(AppConstants.paymentPollInterval, (timer) async {
      pollCount++;

      if (pollCount > maxPolls) {
        timer.cancel();
        _listenStatus = PaymentListenStatus.timeout;
        notifyListeners();
        return;
      }

      try {
        final status = await _apiService.getPaymentLinkStatus(slug);

        if (status.status == PaymentLinkStatus.paid) {
          if (_listenStatus != PaymentListenStatus.confirmed) {
            _listenStatus = PaymentListenStatus.detected;
            notifyListeners();

            await Future.delayed(const Duration(seconds: 2));
            _listenStatus = PaymentListenStatus.confirmed;
            notifyListeners();
            timer.cancel();

            await fetchTransactions();
          }
        }
      } catch (e) {
        debugPrint('Error polling payment status: $e');
      }
    });
  }

  /// Stop listening for payment.
  void stopListening() {
    _pollTimer?.cancel();
    _listenStatus = PaymentListenStatus.idle;
    notifyListeners();
  }

  /// Simulate payment received (for demo purposes).
  void simulatePaymentReceived() {
    _listenStatus = PaymentListenStatus.detected;
    notifyListeners();

    Future.delayed(const Duration(seconds: 2), () {
      _listenStatus = PaymentListenStatus.confirmed;
      notifyListeners();
    });
  }

  /// Fetch analytics data for a given range.
  Future<void> fetchAnalytics({String range = '7d'}) async {
    try {
      final data = await _apiService.getAnalytics(range: range);
      final summary = data['summary'] as Map<String, dynamic>? ?? {};
      final totalSats = int.tryParse(summary['total_revenue_satoshis']?.toString() ?? '0') ?? 0;
      final totalUsd = (summary['total_revenue_usd'] as num?)?.toDouble() ?? 0;
      final totalTx = summary['total_transactions'] as int? ?? 0;

      if (range == '7d') {
        _weekRevenueBch = totalSats / 100000000.0;
        _weekRevenueUsd = totalUsd;
        _weekTxCount = totalTx;
      } else if (range == '30d') {
        _monthRevenueBch = totalSats / 100000000.0;
        _monthRevenueUsd = totalUsd;
        _monthTxCount = totalTx;
      } else if (range == '90d') {
        _allTimeRevenueBch = totalSats / 100000000.0;
        _allTimeRevenueUsd = totalUsd;
        _allTimeTxCount = totalTx;
      }

      notifyListeners();
    } catch (e) {
      debugPrint('Failed to fetch analytics ($range): $e');
    }
  }

  /// Fetch dashboard stats.
  Future<void> fetchDashboardStats() async {
    try {
      final stats = await _apiService.getDashboardStats();
      _todayRevenueBch = (stats['today_revenue_bch'] as num?)?.toDouble() ?? 0;
      _todayRevenueUsd = (stats['today_revenue_usd'] as num?)?.toDouble() ?? 0;
      _todayTxCount = stats['today_tx_count'] as int? ?? 0;
      _pendingCount = stats['pending_count'] as int? ?? 0;
      _weekRevenue = (stats['week_revenue'] as List<dynamic>?)
              ?.map((e) => (e as num).toDouble())
              .toList() ??
          [];
      _weekLabels = (stats['week_labels'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          [];
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to fetch dashboard stats: $e');
    }
  }

  /// Get recent transactions (for dashboard).
  List<Transaction> get recentTransactions {
    final sorted = List<Transaction>.from(_transactions)
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return sorted.take(5).toList();
  }

  /// Filter transactions by time period and/or status.
  List<Transaction> filterTransactions({
    DateTime? from,
    DateTime? to,
    TransactionStatus? status,
  }) {
    return _transactions.where((tx) {
      if (from != null && tx.createdAt.isBefore(from)) return false;
      if (to != null && tx.createdAt.isAfter(to)) return false;
      if (status != null && tx.status != status) return false;
      return true;
    }).toList()
      ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
  }

  /// Export transactions to CSV string.
  /// Optionally filter by [from] and [to] date range.
  String exportTransactionsCsv({DateTime? from, DateTime? to}) {
    final buffer = StringBuffer();
    buffer.writeln('Date,Amount (BCH),Amount (USD),From,To,Tx Hash,Memo,Status');

    var txList = _transactions;
    if (from != null || to != null) {
      txList = txList.where((tx) {
        if (from != null && tx.createdAt.isBefore(from)) return false;
        if (to != null && tx.createdAt.isAfter(to)) return false;
        return true;
      }).toList();
    }

    for (final tx in txList) {
      buffer.writeln(
        '${tx.createdAt.toIso8601String()},'
        '${tx.amountBch},'
        '${tx.amountUsd},'
        '${tx.senderAddress},'
        '${tx.recipientAddress},'
        '${tx.txHash},'
        '"${tx.memo.replaceAll('"', '""')}",'
        '${tx.status.displayName}',
      );
    }
    return buffer.toString();
  }

  /// Cache transactions for offline viewing.
  Future<void> _cacheTransactions() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonList = _transactions.map((t) => t.toJson()).toList();
      await prefs.setString(
        AppConstants.cachedTransactionsKey,
        jsonEncode(jsonList),
      );
    } catch (e) {
      debugPrint('Failed to cache transactions: $e');
    }
  }

  /// Load cached transactions.
  Future<void> _loadCachedTransactions() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cached = prefs.getString(AppConstants.cachedTransactionsKey);
      if (cached != null) {
        final jsonList = jsonDecode(cached) as List;
        _transactions = jsonList
            .map((e) => Transaction.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    } catch (e) {
      debugPrint('Failed to load cached transactions: $e');
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }
}
