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
  String? _email;
  String? _errorMessage;
  String _role = 'BUYER';

  bool get isAuthenticated => _isAuthenticated;
  bool get isOnboarded => _isOnboarded;
  bool get isLoading => _isLoading;
  Merchant? get currentMerchant => _currentMerchant;
  String? get walletAddress => _walletAddress;
  String? get email => _email;
  String? get errorMessage => _errorMessage;
  String get role => _role;
  bool get isMerchant => _role == 'MERCHANT';
  bool get isBuyer => _role == 'BUYER';

  /// Check existing authentication state on app start
  Future<void> checkAuth() async {
    _isLoading = true;
    notifyListeners();

    try {
      final token = await _secureStorage.read(key: AppConstants.jwtTokenKey);
      _email = await _secureStorage.read(key: AppConstants.emailKey);
      _walletAddress =
          await _secureStorage.read(key: AppConstants.walletAddressKey);

      if (token != null && _email != null) {
        _isAuthenticated = true;

        // Check if onboarded (has wallet) and load role
        final prefs = await SharedPreferences.getInstance();
        _isOnboarded = prefs.getBool(AppConstants.onboardedKey) ?? false;
        _role = prefs.getString(AppConstants.userRoleKey) ?? 'BUYER';

        if (_isOnboarded) {
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

  /// Register with email + password.
  Future<bool> register(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _apiService.register(
        email: email,
        password: password,
      );

      final accessToken = result['access_token'] as String?;
      if (accessToken == null) {
        _errorMessage = 'Registration failed';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      final user = result['user'] as Map<String, dynamic>? ?? {};

      // Store tokens
      await _secureStorage.write(
        key: AppConstants.jwtTokenKey,
        value: accessToken,
      );
      await _secureStorage.write(
        key: AppConstants.emailKey,
        value: email,
      );

      _email = email;
      _role = user['role'] as String? ?? 'BUYER';
      _isAuthenticated = true;
      _isOnboarded = false; // No wallet yet

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.userRoleKey, _role);

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Registration failed: $e';
      debugPrint(_errorMessage);
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  /// Login with email + password.
  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _apiService.login(
        email: email,
        password: password,
      );

      final accessToken = result['access_token'] as String?;
      if (accessToken == null) {
        _errorMessage = 'Invalid credentials';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      final user = result['user'] as Map<String, dynamic>? ?? {};

      // Store tokens
      await _secureStorage.write(
        key: AppConstants.jwtTokenKey,
        value: accessToken,
      );
      await _secureStorage.write(
        key: AppConstants.emailKey,
        value: email,
      );

      _email = email;
      _role = user['role'] as String? ?? 'BUYER';
      final bchAddress = user['bch_address'] as String?;

      if (bchAddress != null && bchAddress.isNotEmpty) {
        _walletAddress = bchAddress;
        await _secureStorage.write(
          key: AppConstants.walletAddressKey,
          value: bchAddress,
        );
        _isOnboarded = true;
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool(AppConstants.onboardedKey, true);
      } else {
        _isOnboarded = false;
      }

      _isAuthenticated = true;

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.userRoleKey, _role);

      // Try to fetch profile
      try {
        _currentMerchant = await _apiService.getMerchant();
      } catch (_) {}

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Login failed: $e';
      debugPrint(_errorMessage);
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  /// Set up the wallet: generate BIP39, store in secure storage, register with API.
  Future<bool> setupWallet() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // Generate wallet locally
      final keys = WalletCryptoService.createWallet();

      // Store seed phrase and address securely
      await _secureStorage.write(
        key: AppConstants.seedPhraseKey,
        value: keys.mnemonic,
      );
      await _secureStorage.write(
        key: AppConstants.walletAddressKey,
        value: keys.address,
      );

      _walletAddress = keys.address;

      // Register wallet address with API
      await _apiService.registerWallet(bchAddress: keys.address);

      // Mark as onboarded
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(AppConstants.onboardedKey, true);

      _isOnboarded = true;
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Wallet setup failed: $e';
      debugPrint(_errorMessage);
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  /// Upgrade to merchant role.
  Future<bool> upgradeToMerchant(String businessName) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      // Derive merchant address from stored mnemonic
      String? merchantAddress;
      final mnemonic =
          await _secureStorage.read(key: AppConstants.seedPhraseKey);
      if (mnemonic != null) {
        final merchantKeys =
            WalletCryptoService.deriveMerchantAddress(mnemonic);
        merchantAddress = merchantKeys.address;
      }

      final result = await _apiService.setupMerchant(
        businessName: businessName,
        merchantAddress: merchantAddress,
      );

      // Store new tokens
      final accessToken = result['access_token'] as String?;
      if (accessToken != null) {
        await _secureStorage.write(
          key: AppConstants.jwtTokenKey,
          value: accessToken,
        );
      }

      if (merchantAddress != null) {
        await _secureStorage.write(
          key: AppConstants.merchantAddressKey,
          value: merchantAddress,
        );
      }

      _role = 'MERCHANT';
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.userRoleKey, 'MERCHANT');

      // Refresh profile
      try {
        _currentMerchant = await _apiService.getMerchant();
      } catch (_) {}

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Merchant upgrade failed: $e';
      debugPrint(_errorMessage);
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  /// Switch between MERCHANT and BUYER role (legacy).
  Future<bool> switchRole(String newRole) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _apiService.switchRole(newRole);

      final accessToken = result['access_token'] as String?;
      if (accessToken != null) {
        await _secureStorage.write(
          key: AppConstants.jwtTokenKey,
          value: accessToken,
        );
      }

      _role = newRole;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(AppConstants.userRoleKey, newRole);

      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = 'Error switching role: $e';
      debugPrint(_errorMessage);
      _isLoading = false;
      notifyListeners();
      return false;
    }
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
    await _secureStorage.delete(key: AppConstants.emailKey);
    await _secureStorage.delete(key: AppConstants.merchantAddressKey);

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConstants.onboardedKey);
    await prefs.remove(AppConstants.userRoleKey);

    _isAuthenticated = false;
    _isOnboarded = false;
    _currentMerchant = null;
    _walletAddress = null;
    _email = null;
    _errorMessage = null;
    _role = 'BUYER';

    notifyListeners();
  }
}
