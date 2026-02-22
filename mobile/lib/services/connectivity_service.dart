import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

/// Monitors network connectivity and provides offline status.
class ConnectivityService extends ChangeNotifier {
  static final ConnectivityService _instance = ConnectivityService._();
  factory ConnectivityService() => _instance;
  ConnectivityService._();

  final Connectivity _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _subscription;

  bool _isOnline = true;
  bool get isOnline => _isOnline;

  /// Start monitoring connectivity.
  void startMonitoring() {
    _subscription = _connectivity.onConnectivityChanged.listen(_onChanged);
    // Check initial status
    _checkConnectivity();
  }

  Future<void> _checkConnectivity() async {
    try {
      final results = await _connectivity.checkConnectivity();
      _onChanged(results);
    } catch (e) {
      debugPrint('Connectivity check error: $e');
    }
  }

  void _onChanged(List<ConnectivityResult> results) {
    final wasOnline = _isOnline;
    _isOnline = results.any((r) => r != ConnectivityResult.none);

    if (wasOnline != _isOnline) {
      notifyListeners();
    }
  }

  /// Stop monitoring.
  void stopMonitoring() {
    _subscription?.cancel();
    _subscription = null;
  }

  @override
  void dispose() {
    stopMonitoring();
    super.dispose();
  }
}
