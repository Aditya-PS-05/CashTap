import 'package:flutter/foundation.dart';

import '../services/api_service.dart';
import '../services/bch_service.dart';

class WalletProvider extends ChangeNotifier {
  final ApiService _apiService = ApiService();

  int _balanceSatoshis = 0;
  double _balanceBch = 0;
  double _balanceUsd = 0;
  double _bchPriceUsd = 400.0;
  String _bchAddress = '';
  bool _isLoading = false;
  String? _errorMessage;

  int get balanceSatoshis => _balanceSatoshis;
  double get balanceBch => _balanceBch;
  double get balanceUsd => _balanceUsd;
  double get bchPriceUsd => _bchPriceUsd;
  String get bchAddress => _bchAddress;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  String get formattedBchBalance => BchService.formatBchWithUnit(_balanceBch);
  String get formattedUsdBalance => BchService.formatUsdAmount(_balanceUsd);

  /// Fetch wallet balance
  Future<void> fetchBalance() async {
    _isLoading = true;
    notifyListeners();

    try {
      final data = await _apiService.getWalletBalance();
      // API returns { confirmed: { count, total_satoshis }, pending: { ... } }
      final confirmed = data['confirmed'] as Map<String, dynamic>? ?? {};
      final totalSatsStr = confirmed['total_satoshis']?.toString() ?? '0';
      _balanceSatoshis = int.tryParse(totalSatsStr) ?? 0;
      _balanceBch = BchService.satoshisToBch(_balanceSatoshis);
      _balanceUsd = BchService.bchToUsd(_balanceBch, _bchPriceUsd);
      _errorMessage = null;
    } catch (e) {
      _errorMessage = 'Failed to fetch balance: $e';
      debugPrint(_errorMessage);
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Fetch current BCH price
  Future<void> fetchBchPrice() async {
    try {
      _bchPriceUsd = await _apiService.getBchPrice();
      // Recalculate USD balance
      _balanceUsd = BchService.bchToUsd(_balanceBch, _bchPriceUsd);
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to fetch BCH price: $e');
    }
  }

  /// Set wallet address (from auth)
  void setAddress(String address) {
    _bchAddress = address;
    notifyListeners();
  }

  /// Convert USD to BCH at current rate
  double usdToBch(double usd) {
    return BchService.usdToBch(usd, _bchPriceUsd);
  }

  /// Convert BCH to USD at current rate
  double bchToUsd(double bch) {
    return BchService.bchToUsd(bch, _bchPriceUsd);
  }

  /// Refresh all wallet data
  Future<void> refreshAll() async {
    await Future.wait([
      fetchBalance(),
      fetchBchPrice(),
    ]);
  }
}
