import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/constants.dart';
import '../models/merchant.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();
  final ApiService _apiService = ApiService();

  bool _isAuthenticated = false;
  bool _isOnboarded = false;
  bool _isLoading = false;
  Merchant? _currentMerchant;
  String? _walletAddress;
  String? _errorMessage;

  bool get isAuthenticated => _isAuthenticated;
  bool get isOnboarded => _isOnboarded;
  bool get isLoading => _isLoading;
  Merchant? get currentMerchant => _currentMerchant;
  String? get walletAddress => _walletAddress;
  String? get errorMessage => _errorMessage;

  /// Check existing authentication state on app start
  Future<void> checkAuth() async {
    _isLoading = true;
    notifyListeners();

    try {
      final token = await _secureStorage.read(key: AppConstants.jwtTokenKey);
      _walletAddress = await _secureStorage.read(key: AppConstants.walletAddressKey);

      if (token != null && _walletAddress != null) {
        _isAuthenticated = true;

        // Check if onboarded
        final prefs = await SharedPreferences.getInstance();
        _isOnboarded = prefs.getBool(AppConstants.onboardedKey) ?? false;

        if (_isOnboarded) {
          // Try to fetch merchant profile
          try {
            _currentMerchant = await _apiService.getMerchant();
          } catch (_) {
            // Use cached merchant info if API is unavailable
          }
        }
      }
    } catch (e) {
      debugPrint('Auth check error: $e');
      _isAuthenticated = false;
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Create a new wallet
  Future<bool> createWallet() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _apiService.createWallet();

      final token = result['token'] as String?;
      final address = result['wallet_address'] as String?;
      final seedPhrase = result['seed_phrase'] as String?;

      if (token != null && address != null) {
        await _secureStorage.write(key: AppConstants.jwtTokenKey, value: token);
        await _secureStorage.write(key: AppConstants.walletAddressKey, value: address);
        if (seedPhrase != null) {
          await _secureStorage.write(key: AppConstants.seedPhraseKey, value: seedPhrase);
        }

        _walletAddress = address;
        _isAuthenticated = true;
        _isOnboarded = false;

        _isLoading = false;
        notifyListeners();
        return true;
      }

      _errorMessage = 'Failed to create wallet';
    } catch (e) {
      _errorMessage = 'Error creating wallet: $e';
      debugPrint(_errorMessage);
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  /// Import wallet with seed phrase
  Future<bool> importWallet(String seedPhrase) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _apiService.importWallet(seedPhrase);

      final token = result['token'] as String?;
      final address = result['wallet_address'] as String?;

      if (address != null) {
        if (token != null) {
          await _secureStorage.write(key: AppConstants.jwtTokenKey, value: token);
        }
        await _secureStorage.write(key: AppConstants.walletAddressKey, value: address);
        await _secureStorage.write(key: AppConstants.seedPhraseKey, value: seedPhrase);

        _walletAddress = address;
        _isAuthenticated = true;
        _isOnboarded = false;

        _isLoading = false;
        notifyListeners();
        return true;
      }

      _errorMessage = 'Failed to import wallet';
    } catch (e) {
      _errorMessage = 'Error importing wallet: $e';
      debugPrint(_errorMessage);
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  /// Complete onboarding with merchant profile
  Future<bool> completeOnboarding({
    required String businessName,
    required String email,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _currentMerchant = await _apiService.createMerchant(
        businessName: businessName,
        email: email,
        walletAddress: _walletAddress ?? '',
      );

      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(AppConstants.onboardedKey, true);

      _isOnboarded = true;

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Error completing onboarding: $e';
      debugPrint(_errorMessage);
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  /// Update merchant profile
  Future<bool> updateMerchant(Map<String, dynamic> updates) async {
    try {
      _currentMerchant = await _apiService.updateMerchant(updates);
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Error updating merchant: $e');
      return false;
    }
  }

  /// Logout
  Future<void> logout() async {
    await _secureStorage.delete(key: AppConstants.jwtTokenKey);
    await _secureStorage.delete(key: AppConstants.walletAddressKey);
    await _secureStorage.delete(key: AppConstants.seedPhraseKey);

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConstants.onboardedKey);

    _isAuthenticated = false;
    _isOnboarded = false;
    _currentMerchant = null;
    _walletAddress = null;
    _errorMessage = null;

    notifyListeners();
  }
}
