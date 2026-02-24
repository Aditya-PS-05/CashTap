import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../config/constants.dart';
import '../models/merchant.dart';
import '../services/api_service.dart';
import '../services/wallet_crypto_service.dart';

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
      _walletAddress =
          await _secureStorage.read(key: AppConstants.walletAddressKey);

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

  /// Create a new wallet client-side (BIP39) and authenticate via
  /// challenge → sign → verify flow.
  Future<bool> createWallet() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // 1. Generate wallet locally
      final keys = WalletCryptoService.createWallet();

      // 2. Authenticate with the API
      final authenticated = await _authenticateWithKeys(
        keys.address,
        keys.privateKey,
        keys.publicKey,
      );

      if (!authenticated) {
        _errorMessage = 'Failed to authenticate with server';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      // 3. Store seed phrase securely
      await _secureStorage.write(
        key: AppConstants.seedPhraseKey,
        value: keys.mnemonic,
      );

      _walletAddress = keys.address;
      _isAuthenticated = true;
      _isOnboarded = false;

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Error creating wallet: $e';
      debugPrint(_errorMessage);
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  /// Import wallet from a seed phrase and authenticate via
  /// challenge → sign → verify flow.
  Future<bool> importWallet(String seedPhrase) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // 1. Derive keys from mnemonic locally
      final keys = WalletCryptoService.deriveFromMnemonic(seedPhrase.trim());

      // 2. Authenticate with the API
      final authenticated = await _authenticateWithKeys(
        keys.address,
        keys.privateKey,
        keys.publicKey,
      );

      if (!authenticated) {
        _errorMessage = 'Failed to authenticate with server';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      // 3. Store seed phrase securely
      await _secureStorage.write(
        key: AppConstants.seedPhraseKey,
        value: keys.mnemonic,
      );

      _walletAddress = keys.address;
      _isAuthenticated = true;
      _isOnboarded = false;

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Error importing wallet: $e';
      debugPrint(_errorMessage);
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  /// Authenticate with the API using challenge → sign → verify.
  Future<bool> _authenticateWithKeys(
    String address,
    Uint8List privateKey,
    Uint8List publicKey,
  ) async {
    // Step 1: Request challenge
    final challenge = await _apiService.requestChallenge(address);
    final nonce = challenge['nonce'] as String;
    final message = challenge['message'] as String;

    // Step 2: Sign the challenge message
    final signature =
        WalletCryptoService.signMessage(privateKey, publicKey, message);

    // Step 3: Verify signature with server
    final result = await _apiService.verifyChallenge(
      address: address,
      signature: signature,
      nonce: nonce,
    );

    final accessToken = result['access_token'] as String?;
    if (accessToken == null) return false;

    // Store tokens
    await _secureStorage.write(
      key: AppConstants.jwtTokenKey,
      value: accessToken,
    );
    await _secureStorage.write(
      key: AppConstants.walletAddressKey,
      value: address,
    );

    return true;
  }

  /// Complete onboarding with merchant profile.
  /// Tries POST first; if 409 (merchant auto-created during auth), falls back to PUT.
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
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('409') || msg.contains('already exists')) {
        // Merchant was auto-created during auth — update with business name
        try {
          _currentMerchant = await _apiService.updateMerchant({
            'business_name': businessName,
            'email': email,
          });
        } catch (e2) {
          _errorMessage = 'Error updating profile: $e2';
          debugPrint(_errorMessage);
          _isLoading = false;
          notifyListeners();
          return false;
        }
      } else {
        _errorMessage = 'Error completing onboarding: $e';
        debugPrint(_errorMessage);
        _isLoading = false;
        notifyListeners();
        return false;
      }
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(AppConstants.onboardedKey, true);

    _isOnboarded = true;
    _isLoading = false;
    notifyListeners();
    return true;
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
