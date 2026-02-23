import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/constants.dart';
import '../config/theme.dart';
import '../providers/auth_provider.dart';
import '../providers/payment_provider.dart';
import '../providers/wallet_provider.dart';
import '../services/bch_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  /// Static notifier that main.dart can listen to for theme changes.
  static final ValueNotifier<ThemeMode> themeNotifier =
      ValueNotifier(ThemeMode.system);

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  // Payment settings
  bool _zeroConfEnabled = true;
  final bool _bchAccepted = true;
  bool _cashTokenAccepted = false;
  final TextEditingController _minAmountController = TextEditingController();

  // Loyalty tokens
  bool _loyaltyEnabled = false;
  final TextEditingController _loyaltyTokenNameController =
      TextEditingController();
  final TextEditingController _loyaltyTokenSymbolController =
      TextEditingController();
  final TextEditingController _loyaltyRewardRateController =
      TextEditingController();

  // Notifications
  bool _pushPaymentReceived = true;
  bool _pushPaymentConfirmed = false;
  bool _pushInvoicePaid = false;
  final TextEditingController _largePaymentThresholdController =
      TextEditingController();

  // Integrations
  final TextEditingController _webhookUrlController = TextEditingController();
  String _apiKey = '';

  // Display currency
  String _displayCurrency = 'BCH';

  // Appearance
  ThemeMode _selectedThemeMode = ThemeMode.system;

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  @override
  void dispose() {
    _minAmountController.dispose();
    _loyaltyTokenNameController.dispose();
    _loyaltyTokenSymbolController.dispose();
    _loyaltyRewardRateController.dispose();
    _largePaymentThresholdController.dispose();
    _webhookUrlController.dispose();
    super.dispose();
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();

    setState(() {
      // Payment settings
      _cashTokenAccepted =
          prefs.getBool(AppConstants.cashTokenAcceptedKey) ?? false;
      final storedMinAmount =
          prefs.getDouble(AppConstants.minimumAmountKey) ??
              AppConstants.defaultMinimumAmount;
      _minAmountController.text = storedMinAmount.toString();

      // Loyalty tokens
      _loyaltyEnabled =
          prefs.getBool(AppConstants.loyaltyEnabledKey) ?? false;
      _loyaltyTokenNameController.text =
          prefs.getString(AppConstants.loyaltyTokenNameKey) ?? '';
      _loyaltyTokenSymbolController.text =
          prefs.getString(AppConstants.loyaltyTokenSymbolKey) ?? '';
      _loyaltyRewardRateController.text =
          prefs.getString(AppConstants.loyaltyRewardRateKey) ?? '';

      // Notifications
      _pushPaymentReceived =
          prefs.getBool(AppConstants.pushPaymentReceivedKey) ?? true;
      _pushPaymentConfirmed =
          prefs.getBool(AppConstants.pushPaymentConfirmedKey) ?? false;
      _pushInvoicePaid =
          prefs.getBool(AppConstants.pushInvoicePaidKey) ?? false;
      final storedThreshold =
          prefs.getDouble(AppConstants.largePaymentThresholdKey);
      _largePaymentThresholdController.text =
          storedThreshold != null ? storedThreshold.toString() : '';

      // Integrations
      _webhookUrlController.text =
          prefs.getString(AppConstants.webhookUrlKey) ?? '';
      _apiKey = prefs.getString('api_key') ?? _generateApiKey();

      // Display currency
      _displayCurrency = prefs.getString('display_currency') ?? 'BCH';

      // Appearance
      final themeString =
          prefs.getString(AppConstants.themeModeKey) ?? 'system';
      _selectedThemeMode = _themeModeFromString(themeString);

    });
  }

  ThemeMode _themeModeFromString(String value) {
    switch (value) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  String _themeModeToString(ThemeMode mode) {
    switch (mode) {
      case ThemeMode.light:
        return 'light';
      case ThemeMode.dark:
        return 'dark';
      case ThemeMode.system:
        return 'system';
    }
  }

  String _generateApiKey() {
    const chars =
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    final rng = Random.secure();
    return 'bchpay_' +
        List.generate(32, (_) => chars[rng.nextInt(chars.length)]).join();
  }

  String _maskApiKey(String key) {
    if (key.length <= 12) return key;
    return '${key.substring(0, 10)}${'*' * (key.length - 14)}${key.substring(key.length - 4)}';
  }

  Future<void> _saveBool(String key, bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
  }

  Future<void> _saveString(String key, String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, value);
  }

  Future<void> _saveDouble(String key, double value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble(key, value);
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? AppTheme.errorRed : null,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final auth = context.watch<AuthProvider>();
    final wallet = context.watch<WalletProvider>();
    final merchant = auth.currentMerchant;

    _zeroConfEnabled = merchant?.zeroConfEnabled ?? true;

    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 20),

            Text(
              'Settings',
              style: theme.textTheme.headlineMedium,
            ),
            const SizedBox(height: 24),

            // ── Merchant Profile ──
            Row(
              children: [
                Image.asset(
                  'assets/images/bch_coin_icon.png',
                  width: 24,
                  height: 24,
                  errorBuilder: (context, error, stackTrace) =>
                      const Icon(Icons.storefront, size: 20, color: AppTheme.bchGreen),
                ),
                const SizedBox(width: 8),
                Text(
                  'Merchant Profile',
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: AppTheme.bchGreen,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _buildCard(
              theme,
              children: [
                _buildInfoRow(
                    theme, 'Business Name', merchant?.businessName ?? '--'),
                const Divider(height: 1),
                _buildInfoRow(theme, 'Email', merchant?.email ?? '--'),
                const Divider(height: 1),
                _buildInfoRow(
                  theme,
                  'Member Since',
                  merchant != null
                      ? '${_monthName(merchant.createdAt.month)} ${merchant.createdAt.year}'
                      : '--',
                ),
              ],
            ),
            const SizedBox(height: 24),

            // ── Wallet ──
            Row(
              children: [
                Image.asset(
                  'assets/images/wallet.png',
                  width: 24,
                  height: 24,
                  errorBuilder: (context, error, stackTrace) =>
                      const Icon(Icons.account_balance_wallet_outlined, size: 20, color: AppTheme.bchGreen),
                ),
                const SizedBox(width: 8),
                Text(
                  'Wallet',
                  style: theme.textTheme.titleLarge?.copyWith(
                    color: AppTheme.bchGreen,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            _buildCard(
              theme,
              children: [
                _buildInfoRow(
                  theme,
                  'Balance',
                  wallet.formattedBchBalance,
                  trailing: Text(
                    wallet.formattedUsdBalance,
                    style: theme.textTheme.bodySmall,
                  ),
                ),
                const Divider(height: 1),
                InkWell(
                  onTap: () {
                    final address = auth.walletAddress ?? '';
                    if (address.isNotEmpty) {
                      Clipboard.setData(ClipboardData(text: address));
                      _showSnackBar('Address copied!');
                    }
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 14),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Address',
                                style: theme.textTheme.bodySmall,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                BchService.shortenAddress(
                                    auth.walletAddress ?? '--'),
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  fontFamily: 'monospace',
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.copy, size: 18),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // ── Payment Settings ──
            _buildSectionHeader(theme, 'Payment Settings', Icons.tune),
            const SizedBox(height: 12),
            _buildCard(
              theme,
              children: [
                SwitchListTile(
                  title: Text(
                    'Accept BCH',
                    style: theme.textTheme.bodyMedium,
                  ),
                  subtitle: Text(
                    'Bitcoin Cash acceptance (always on)',
                    style: theme.textTheme.bodySmall,
                  ),
                  value: _bchAccepted,
                  onChanged: null,
                  activeTrackColor: AppTheme.bchGreen,
                ),
                const Divider(height: 1),
                SwitchListTile(
                  title: Text(
                    'Accept CashTokens',
                    style: theme.textTheme.bodyMedium,
                  ),
                  subtitle: Text(
                    'Accept fungible and NFT CashTokens',
                    style: theme.textTheme.bodySmall,
                  ),
                  value: _cashTokenAccepted,
                  onChanged: (value) {
                    setState(() => _cashTokenAccepted = value);
                    _saveBool(AppConstants.cashTokenAcceptedKey, value);
                  },
                  activeTrackColor: AppTheme.bchGreen,
                ),
                const Divider(height: 1),
                SwitchListTile(
                  title: Text(
                    'Accept 0-conf payments',
                    style: theme.textTheme.bodyMedium,
                  ),
                  subtitle: Text(
                    'Accept payments before block confirmation',
                    style: theme.textTheme.bodySmall,
                  ),
                  value: _zeroConfEnabled,
                  onChanged: (value) {
                    setState(() => _zeroConfEnabled = value);
                    auth.updateMerchant({'zero_conf_enabled': value});
                  },
                  activeTrackColor: AppTheme.bchGreen,
                ),
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Minimum Payment Amount',
                              style: theme.textTheme.bodyMedium,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Reject payments below this BCH amount',
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      SizedBox(
                        width: 120,
                        child: TextField(
                          controller: _minAmountController,
                          keyboardType: const TextInputType.numberWithOptions(
                              decimal: true),
                          style: theme.textTheme.bodyMedium,
                          decoration: InputDecoration(
                            suffixText: 'BCH',
                            suffixStyle: theme.textTheme.bodySmall,
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
                          ),
                          onSubmitted: (value) {
                            final parsed = double.tryParse(value);
                            if (parsed != null && parsed >= 0) {
                              _saveDouble(
                                  AppConstants.minimumAmountKey, parsed);
                              _showSnackBar(
                                  'Minimum amount updated to $value BCH');
                            } else {
                              _showSnackBar('Invalid amount', isError: true);
                              _minAmountController.text =
                                  AppConstants.defaultMinimumAmount.toString();
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // ── Loyalty Tokens Config ──
            _buildSectionHeader(
                theme, 'Loyalty Tokens', Icons.card_giftcard_outlined),
            const SizedBox(height: 12),
            _buildCard(
              theme,
              children: [
                SwitchListTile(
                  title: Text(
                    'Enable Loyalty Token Issuance',
                    style: theme.textTheme.bodyMedium,
                  ),
                  subtitle: Text(
                    'Issue CashTokens as loyalty rewards',
                    style: theme.textTheme.bodySmall,
                  ),
                  value: _loyaltyEnabled,
                  onChanged: (value) {
                    setState(() => _loyaltyEnabled = value);
                    _saveBool(AppConstants.loyaltyEnabledKey, value);
                  },
                  activeTrackColor: AppTheme.bchGreen,
                ),
                if (_loyaltyEnabled) ...[
                  const Divider(height: 1),
                  _buildTextFieldRow(
                    theme,
                    label: 'Token Name',
                    hint: 'e.g. Coffee Rewards',
                    controller: _loyaltyTokenNameController,
                    onChanged: (value) {
                      _saveString(AppConstants.loyaltyTokenNameKey, value);
                    },
                  ),
                  const Divider(height: 1),
                  _buildTextFieldRow(
                    theme,
                    label: 'Token Symbol',
                    hint: 'e.g. COFFEE',
                    controller: _loyaltyTokenSymbolController,
                    onChanged: (value) {
                      _saveString(AppConstants.loyaltyTokenSymbolKey, value);
                    },
                  ),
                  const Divider(height: 1),
                  _buildTextFieldRow(
                    theme,
                    label: 'Reward Rate',
                    hint: 'Tokens per 1 BCH spent',
                    controller: _loyaltyRewardRateController,
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: true),
                    onChanged: (value) {
                      _saveString(AppConstants.loyaltyRewardRateKey, value);
                    },
                  ),
                  const Divider(height: 1),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    child: SizedBox(
                      width: double.infinity,
                      height: 46,
                      child: ElevatedButton.icon(
                        onPressed: () {
                          final name =
                              _loyaltyTokenNameController.text.trim();
                          final symbol =
                              _loyaltyTokenSymbolController.text.trim();
                          final rate =
                              _loyaltyRewardRateController.text.trim();

                          if (name.isEmpty ||
                              symbol.isEmpty ||
                              rate.isEmpty) {
                            _showSnackBar(
                                'Please fill in all loyalty token fields',
                                isError: true);
                            return;
                          }

                          final parsedRate = double.tryParse(rate);
                          if (parsedRate == null || parsedRate <= 0) {
                            _showSnackBar(
                                'Reward rate must be a positive number',
                                isError: true);
                            return;
                          }

                          _showSnackBar(
                              'Loyalty token "$name" ($symbol) creation initiated. '
                              'This will be deployed on-chain shortly.');
                        },
                        icon: const Icon(Icons.rocket_launch, size: 18),
                        label: Text(
                          'Create Loyalty Token',
                          style: GoogleFonts.inter(
                            fontWeight: FontWeight.w600,
                            fontSize: 14,
                          ),
                        ),
                        style: ElevatedButton.styleFrom(
                          minimumSize: Size.zero,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ],
            ),
            const SizedBox(height: 24),

            // ── Notifications ──
            _buildSectionHeader(
                theme, 'Notifications', Icons.notifications_outlined),
            const SizedBox(height: 12),
            _buildCard(
              theme,
              children: [
                SwitchListTile(
                  title: Text(
                    'Payment Received',
                    style: theme.textTheme.bodyMedium,
                  ),
                  subtitle: Text(
                    'Push notification when a payment is detected',
                    style: theme.textTheme.bodySmall,
                  ),
                  value: _pushPaymentReceived,
                  onChanged: (value) {
                    setState(() => _pushPaymentReceived = value);
                    _saveBool(AppConstants.pushPaymentReceivedKey, value);
                  },
                  activeTrackColor: AppTheme.bchGreen,
                ),
                const Divider(height: 1),
                SwitchListTile(
                  title: Text(
                    'Payment Confirmed',
                    style: theme.textTheme.bodyMedium,
                  ),
                  subtitle: Text(
                    'Push notification when a payment is confirmed on-chain',
                    style: theme.textTheme.bodySmall,
                  ),
                  value: _pushPaymentConfirmed,
                  onChanged: (value) {
                    setState(() => _pushPaymentConfirmed = value);
                    _saveBool(AppConstants.pushPaymentConfirmedKey, value);
                  },
                  activeTrackColor: AppTheme.bchGreen,
                ),
                const Divider(height: 1),
                SwitchListTile(
                  title: Text(
                    'Invoice Paid',
                    style: theme.textTheme.bodyMedium,
                  ),
                  subtitle: Text(
                    'Push notification when a payment link invoice is paid',
                    style: theme.textTheme.bodySmall,
                  ),
                  value: _pushInvoicePaid,
                  onChanged: (value) {
                    setState(() => _pushInvoicePaid = value);
                    _saveBool(AppConstants.pushInvoicePaidKey, value);
                  },
                  activeTrackColor: AppTheme.bchGreen,
                ),
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Large Payment Alert',
                              style: theme.textTheme.bodyMedium,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Alert when a payment exceeds this amount',
                              style: theme.textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      SizedBox(
                        width: 120,
                        child: TextField(
                          controller: _largePaymentThresholdController,
                          keyboardType:
                              const TextInputType.numberWithOptions(
                                  decimal: true),
                          style: theme.textTheme.bodyMedium,
                          decoration: InputDecoration(
                            hintText: '1.0',
                            suffixText: 'BCH',
                            suffixStyle: theme.textTheme.bodySmall,
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
                          ),
                          onSubmitted: (value) {
                            if (value.trim().isEmpty) {
                              _saveString(
                                  AppConstants.largePaymentThresholdKey, '');
                              _showSnackBar('Large payment alert disabled');
                              return;
                            }
                            final parsed = double.tryParse(value);
                            if (parsed != null && parsed > 0) {
                              _saveDouble(
                                  AppConstants.largePaymentThresholdKey,
                                  parsed);
                              _showSnackBar(
                                  'Large payment alert set at $value BCH');
                            } else {
                              _showSnackBar('Invalid threshold amount',
                                  isError: true);
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // ── Integrations ──
            _buildSectionHeader(theme, 'Integrations', Icons.webhook_outlined),
            const SizedBox(height: 12),
            _buildCard(
              theme,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Webhook URL',
                        style: theme.textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Receive POST notifications for payment events',
                        style: theme.textTheme.bodySmall,
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _webhookUrlController,
                              keyboardType: TextInputType.url,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                fontSize: 13,
                              ),
                              decoration: InputDecoration(
                                hintText: 'https://yourserver.com/webhook',
                                hintStyle:
                                    theme.textTheme.bodySmall?.copyWith(
                                  fontSize: 13,
                                ),
                                isDense: true,
                                contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 10),
                              ),
                              onSubmitted: (value) {
                                _saveString(
                                    AppConstants.webhookUrlKey, value.trim());
                                if (value.trim().isNotEmpty) {
                                  _showSnackBar('Webhook URL saved');
                                }
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          SizedBox(
                            height: 40,
                            child: OutlinedButton(
                              onPressed: () {
                                final url =
                                    _webhookUrlController.text.trim();
                                if (url.isEmpty) {
                                  _showSnackBar(
                                      'Enter a webhook URL first',
                                      isError: true);
                                  return;
                                }
                                if (!url.startsWith('http://') &&
                                    !url.startsWith('https://')) {
                                  _showSnackBar(
                                      'URL must start with http:// or https://',
                                      isError: true);
                                  return;
                                }
                                _saveString(
                                    AppConstants.webhookUrlKey, url);
                                _showSnackBar(
                                    'Test webhook sent to $url');
                              },
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 12),
                                minimumSize: Size.zero,
                                side: const BorderSide(
                                    color: AppTheme.bchGreen),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                              child: Text(
                                'Test',
                                style: GoogleFonts.inter(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: AppTheme.bchGreen,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'API Key',
                        style: theme.textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Use this key to authenticate API requests',
                        style: theme.textTheme.bodySmall,
                      ),
                      const SizedBox(height: 10),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: theme.inputDecorationTheme.fillColor,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                _maskApiKey(_apiKey),
                                style:
                                    theme.textTheme.bodyMedium?.copyWith(
                                  fontFamily: 'monospace',
                                  fontSize: 12,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            InkWell(
                              onTap: () {
                                Clipboard.setData(
                                    ClipboardData(text: _apiKey));
                                _showSnackBar('API key copied to clipboard');
                              },
                              child: const Icon(Icons.copy, size: 18),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        width: double.infinity,
                        height: 40,
                        child: OutlinedButton.icon(
                          onPressed: () {
                            showDialog(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Regenerate API Key'),
                                content: const Text(
                                  'This will invalidate the current API key. '
                                  'Any integrations using the old key will stop working. '
                                  'Continue?',
                                ),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.pop(ctx),
                                    child: const Text('Cancel'),
                                  ),
                                  TextButton(
                                    onPressed: () {
                                      Navigator.pop(ctx);
                                      final newKey = _generateApiKey();
                                      setState(() => _apiKey = newKey);
                                      _saveString('api_key', newKey);
                                      _showSnackBar(
                                          'API key regenerated successfully');
                                    },
                                    child: Text(
                                      'Regenerate',
                                      style: GoogleFonts.inter(
                                        color: AppTheme.warningOrange,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          },
                          icon: const Icon(Icons.refresh, size: 16),
                          label: Text(
                            'Regenerate Key',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16),
                            minimumSize: Size.zero,
                            side: const BorderSide(
                                color: AppTheme.warningOrange),
                            foregroundColor: AppTheme.warningOrange,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // ── Data ──
            _buildSectionHeader(
                theme, 'Data', Icons.download_outlined),
            const SizedBox(height: 12),
            _buildCard(
              theme,
              children: [
                InkWell(
                  onTap: () {
                    final payment = context.read<PaymentProvider>();
                    final csv = payment.exportTransactionsCsv();
                    if (csv.trim().isEmpty ||
                        csv.split('\n').length <= 1) {
                      _showSnackBar('No transactions to export',
                          isError: true);
                      return;
                    }
                    Share.share(csv, subject: 'BCH Pay Transactions Export');
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 14),
                    child: Row(
                      children: [
                        const Icon(Icons.table_chart_outlined,
                            size: 20, color: AppTheme.bchGreen),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Export Transactions (CSV)',
                                style: theme.textTheme.bodyMedium,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'Share or save all transaction data',
                                style: theme.textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                        const Icon(Icons.ios_share, size: 18),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // ── Display Currency ──
            _buildSectionHeader(
                theme, 'Display Currency', Icons.attach_money),
            const SizedBox(height: 12),
            _buildCard(
              theme,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Primary Display Currency',
                        style: theme.textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Choose how amounts are displayed throughout the app',
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                RadioListTile<String>(
                  title: Text('BCH', style: theme.textTheme.bodyMedium),
                  subtitle: Text('Show amounts in Bitcoin Cash',
                      style: theme.textTheme.bodySmall),
                  value: 'BCH',
                  groupValue: _displayCurrency,
                  activeColor: AppTheme.bchGreen,
                  onChanged: (value) => _onDisplayCurrencyChanged(value!),
                  dense: true,
                ),
                RadioListTile<String>(
                  title: Text('USD', style: theme.textTheme.bodyMedium),
                  subtitle: Text('Show amounts in US Dollars',
                      style: theme.textTheme.bodySmall),
                  value: 'USD',
                  groupValue: _displayCurrency,
                  activeColor: AppTheme.bchGreen,
                  onChanged: (value) => _onDisplayCurrencyChanged(value!),
                  dense: true,
                ),
                const SizedBox(height: 4),
              ],
            ),
            const SizedBox(height: 24),

            // ── Appearance ──
            _buildSectionHeader(
                theme, 'Appearance', Icons.palette_outlined),
            const SizedBox(height: 12),
            _buildCard(
              theme,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Theme',
                        style: theme.textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Choose the app appearance',
                        style: theme.textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                RadioListTile<ThemeMode>(
                  title: Text('Light', style: theme.textTheme.bodyMedium),
                  value: ThemeMode.light,
                  groupValue: _selectedThemeMode,
                  activeColor: AppTheme.bchGreen,
                  onChanged: (value) => _onThemeModeChanged(value!),
                  dense: true,
                ),
                RadioListTile<ThemeMode>(
                  title: Text('Dark', style: theme.textTheme.bodyMedium),
                  value: ThemeMode.dark,
                  groupValue: _selectedThemeMode,
                  activeColor: AppTheme.bchGreen,
                  onChanged: (value) => _onThemeModeChanged(value!),
                  dense: true,
                ),
                RadioListTile<ThemeMode>(
                  title: Text('System', style: theme.textTheme.bodyMedium),
                  value: ThemeMode.system,
                  groupValue: _selectedThemeMode,
                  activeColor: AppTheme.bchGreen,
                  onChanged: (value) => _onThemeModeChanged(value!),
                  dense: true,
                ),
                const SizedBox(height: 4),
              ],
            ),
            const SizedBox(height: 24),

            // ── About ──
            _buildSectionHeader(theme, 'About', Icons.info_outline),
            const SizedBox(height: 12),
            _buildCard(
              theme,
              children: [
                _buildInfoRow(theme, 'App Version', AppConstants.appVersion),
                const Divider(height: 1),
                InkWell(
                  onTap: () => _openUrl('https://bchpay.io/terms'),
                  child: _buildInfoRow(theme, 'Terms of Service', '',
                      trailing:
                          const Icon(Icons.open_in_new, size: 16)),
                ),
                const Divider(height: 1),
                InkWell(
                  onTap: () => _openUrl('https://bchpay.io/privacy'),
                  child: _buildInfoRow(theme, 'Privacy Policy', '',
                      trailing:
                          const Icon(Icons.open_in_new, size: 16)),
                ),
              ],
            ),
            const SizedBox(height: 32),

            // ── Logout ──
            SizedBox(
              width: double.infinity,
              height: 52,
              child: OutlinedButton.icon(
                onPressed: () => _showLogoutDialog(context, auth),
                icon: const Icon(Icons.logout,
                    size: 20, color: AppTheme.errorRed),
                label: Text(
                  'Logout',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w600,
                    color: AppTheme.errorRed,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppTheme.errorRed),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 60),
          ],
        ),
      ),
    );
  }

  // ── Display currency handler ──

  void _onDisplayCurrencyChanged(String currency) {
    setState(() => _displayCurrency = currency);
    _saveString('display_currency', currency);
    _showSnackBar('Display currency set to $currency');
  }

  // ── Theme change handler ──

  void _onThemeModeChanged(ThemeMode mode) {
    setState(() => _selectedThemeMode = mode);
    _saveString(AppConstants.themeModeKey, _themeModeToString(mode));
    SettingsScreen.themeNotifier.value = mode;
    _showSnackBar('Theme updated. Restart app to apply.');
  }

  // ── Shared widget builders ──

  Widget _buildSectionHeader(ThemeData theme, String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppTheme.bchGreen),
        const SizedBox(width: 8),
        Text(
          title,
          style: theme.textTheme.titleLarge?.copyWith(
            color: AppTheme.bchGreen,
          ),
        ),
      ],
    );
  }

  Widget _buildCard(ThemeData theme, {required List<Widget> children}) {
    return Container(
      decoration: BoxDecoration(
        color: theme.cardTheme.color,
        borderRadius: BorderRadius.circular(16),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: children),
    );
  }

  Widget _buildInfoRow(ThemeData theme, String label, String value,
      {Widget? trailing}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: theme.textTheme.bodyMedium),
          trailing ??
              Text(
                value,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w500,
                  color: theme.textTheme.bodySmall?.color,
                ),
              ),
        ],
      ),
    );
  }

  Widget _buildTextFieldRow(
    ThemeData theme, {
    required String label,
    required String hint,
    required TextEditingController controller,
    TextInputType keyboardType = TextInputType.text,
    ValueChanged<String>? onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: theme.textTheme.bodyMedium,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: controller,
              keyboardType: keyboardType,
              style: theme.textTheme.bodyMedium,
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: theme.textTheme.bodySmall,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12, vertical: 10),
              ),
              onChanged: onChanged,
            ),
          ),
        ],
      ),
    );
  }

  // ── Dialogs ──

  void _showLogoutDialog(BuildContext context, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Logout'),
        content: const Text(
          'Are you sure you want to logout? Make sure you have backed up your seed phrase.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              auth.logout();
            },
            child: const Text(
              'Logout',
              style: TextStyle(color: AppTheme.errorRed),
            ),
          ),
        ],
      ),
    );
  }

  // ── Utilities ──

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  String _monthName(int month) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return months[month - 1];
  }
}
