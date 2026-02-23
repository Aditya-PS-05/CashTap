import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/theme.dart';
import '../../providers/auth_provider.dart';

class ConnectWalletScreen extends StatefulWidget {
  const ConnectWalletScreen({super.key});

  @override
  State<ConnectWalletScreen> createState() => _ConnectWalletScreenState();
}

class _ConnectWalletScreenState extends State<ConnectWalletScreen> {
  bool _showImport = false;
  final _seedController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  static const String _paytacaDeepLink = 'paytaca://connect';
  static const String _paytacaPlayStoreUrl =
      'https://play.google.com/store/apps/details?id=com.paytaca.app';

  @override
  void dispose() {
    _seedController.dispose();
    super.dispose();
  }

  Future<void> _onConnectPaytaca() async {
    final deepLinkUri = Uri.parse(_paytacaDeepLink);

    try {
      final launched = await launchUrl(
        deepLinkUri,
        mode: LaunchMode.externalApplication,
      );

      if (!launched) {
        if (mounted) {
          _showPaytacaInstallDialog();
        }
      }
    } catch (_) {
      if (mounted) {
        _showPaytacaInstallDialog();
      }
    }
  }

  void _showPaytacaInstallDialog() {
    showDialog(
      context: context,
      builder: (dialogContext) {
        final theme = Theme.of(dialogContext);
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppTheme.bchGreen.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(
                  Icons.account_balance_wallet,
                  color: AppTheme.bchGreen,
                  size: 24,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Paytaca Not Found',
                  style: theme.textTheme.headlineSmall,
                ),
              ),
            ],
          ),
          content: Text(
            'Paytaca wallet does not appear to be installed on this device. Would you like to install it from the Play Store?',
            style: theme.textTheme.bodyMedium?.copyWith(
              height: 1.5,
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: Text(
                'Cancel',
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.of(dialogContext).pop();
                final playStoreUri = Uri.parse(_paytacaPlayStoreUrl);
                await launchUrl(
                  playStoreUri,
                  mode: LaunchMode.externalApplication,
                );
              },
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(0, 44),
                padding: const EdgeInsets.symmetric(horizontal: 20),
              ),
              child: const Text('Install Paytaca'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final theme = Theme.of(context);

    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(
            children: [
              const Spacer(flex: 2),

              // Logo
              Image.asset(
                'assets/images/bch_coin.png',
                width: 120,
                height: 120,
                errorBuilder: (context, error, stackTrace) => Container(
                  width: 100,
                  height: 100,
                  decoration: BoxDecoration(
                    color: AppTheme.bchGreen.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.currency_bitcoin, size: 56, color: AppTheme.bchGreen),
                ),
              ),
              const SizedBox(height: 28),

              // Title
              Text(
                'BCH Pay',
                style: GoogleFonts.inter(
                  fontSize: 36,
                  fontWeight: FontWeight.w700,
                  color: AppTheme.bchGreen,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Accept Bitcoin Cash payments\ninstantly at your business',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: theme.textTheme.bodySmall?.color,
                  height: 1.5,
                ),
              ),

              const Spacer(flex: 2),

              // Error message
              if (auth.errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.errorRed.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline,
                          color: AppTheme.errorRed, size: 20),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          auth.errorMessage!,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: AppTheme.errorRed,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Import seed phrase section
              if (_showImport) ...[
                Form(
                  key: _formKey,
                  child: TextFormField(
                    controller: _seedController,
                    maxLines: 3,
                    decoration: InputDecoration(
                      hintText: 'Enter your 12-word seed phrase...',
                      hintStyle: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.textTheme.bodySmall?.color,
                      ),
                    ),
                    style: theme.textTheme.bodyMedium,
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return 'Please enter your seed phrase';
                      }
                      final words = value.trim().split(RegExp(r'\s+'));
                      if (words.length != 12 && words.length != 24) {
                        return 'Seed phrase must be 12 or 24 words';
                      }
                      return null;
                    },
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: auth.isLoading
                      ? null
                      : () async {
                          if (_formKey.currentState!.validate()) {
                            await auth
                                .importWallet(_seedController.text.trim());
                          }
                        },
                  child: auth.isLoading
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Import Wallet'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => setState(() => _showImport = false),
                  child: const Text('Back'),
                ),
              ] else ...[
                // Create new wallet
                ElevatedButton(
                  onPressed: auth.isLoading
                      ? null
                      : () async {
                          await auth.createWallet();
                        },
                  child: auth.isLoading
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            color: Colors.white,
                          ),
                        )
                      : const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.add_circle_outline, size: 22),
                            SizedBox(width: 10),
                            Text('Create New Wallet'),
                          ],
                        ),
                ),
                const SizedBox(height: 14),

                // Import wallet
                OutlinedButton(
                  onPressed: auth.isLoading
                      ? null
                      : () => setState(() => _showImport = true),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.download_outlined, size: 22),
                      SizedBox(width: 10),
                      Text('Import Wallet'),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Connect Paytaca
                OutlinedButton(
                  onPressed: auth.isLoading ? null : _onConnectPaytaca,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: theme.textTheme.bodyLarge?.color,
                    side: BorderSide(
                      color: theme.dividerColor,
                      width: 1.5,
                    ),
                    minimumSize: const Size(double.infinity, 56),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.account_balance_wallet_outlined, size: 22),
                      SizedBox(width: 10),
                      Text('Connect Paytaca'),
                    ],
                  ),
                ),
              ],

              const Spacer(flex: 1),

              // Footer
              Text(
                'Your keys, your coins. Self-custodial.',
                style: theme.textTheme.bodySmall?.copyWith(
                  fontSize: 12,
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
