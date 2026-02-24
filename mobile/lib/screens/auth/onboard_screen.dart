import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../../config/theme.dart';
import '../../providers/auth_provider.dart';

class OnboardScreen extends StatefulWidget {
  const OnboardScreen({super.key});

  @override
  State<OnboardScreen> createState() => _OnboardScreenState();
}

class _OnboardScreenState extends State<OnboardScreen> {
  bool _settingUp = false;
  bool _done = false;

  @override
  void initState() {
    super.initState();
    _setupWallet();
  }

  Future<void> _setupWallet() async {
    setState(() => _settingUp = true);

    final auth = context.read<AuthProvider>();
    final success = await auth.setupWallet();

    if (!mounted) return;

    if (success) {
      setState(() {
        _settingUp = false;
        _done = true;
      });
      // Router will handle redirect after state update
    } else {
      setState(() => _settingUp = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.errorMessage ?? 'Failed to set up wallet'),
          backgroundColor: AppTheme.errorRed,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Image.asset(
                  'assets/images/bch_coin_icon.png',
                  width: 100,
                  height: 100,
                  errorBuilder: (context, error, stackTrace) => Container(
                    width: 80,
                    height: 80,
                    decoration: BoxDecoration(
                      color: AppTheme.bchGreen.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.account_balance_wallet,
                      size: 40,
                      color: AppTheme.bchGreen,
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                Text(
                  _done
                      ? 'Wallet Created!'
                      : _settingUp
                          ? 'Setting Up Your Wallet...'
                          : 'Wallet Setup',
                  style: GoogleFonts.inter(
                    fontSize: 28,
                    fontWeight: FontWeight.w700,
                    color: theme.textTheme.displayLarge?.color,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  _done
                      ? 'Your Bitcoin Cash wallet is ready to use.'
                      : _settingUp
                          ? 'Generating your wallet securely...'
                          : 'There was an issue setting up your wallet.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: theme.textTheme.bodySmall?.color,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 32),
                if (_settingUp)
                  const CircularProgressIndicator(
                    color: AppTheme.bchGreen,
                  ),
                if (_done)
                  const Icon(
                    Icons.check_circle,
                    color: AppTheme.bchGreen,
                    size: 64,
                  ),
                if (!_settingUp && !_done) ...[
                  if (auth.errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.errorRed.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        auth.errorMessage!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: AppTheme.errorRed,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  ElevatedButton(
                    onPressed: _setupWallet,
                    child: const Text('Retry'),
                  ),
                ],
                if (auth.walletAddress != null && auth.walletAddress!.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: theme.cardTheme.color,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.account_balance_wallet_outlined,
                          color: AppTheme.bchGreen,
                          size: 20,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            auth.walletAddress!,
                            style: theme.textTheme.bodySmall?.copyWith(
                              fontFamily: 'monospace',
                              fontSize: 11,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
