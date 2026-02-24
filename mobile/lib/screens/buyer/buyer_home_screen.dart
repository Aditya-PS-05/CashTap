import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../config/constants.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/wallet_provider.dart';
import '../../services/api_service.dart';

class BuyerHomeScreen extends StatefulWidget {
  const BuyerHomeScreen({super.key});

  @override
  State<BuyerHomeScreen> createState() => _BuyerHomeScreenState();
}

class _BuyerHomeScreenState extends State<BuyerHomeScreen> {
  bool _showReceive = false;
  bool _loadingBalance = true;
  int _confirmedSats = 0;
  int _unconfirmedSats = 0;

  @override
  void initState() {
    super.initState();
    _fetchBalance();
  }

  Future<void> _fetchBalance() async {
    final auth = context.read<AuthProvider>();
    final address = auth.walletAddress;
    if (address == null) return;

    try {
      final api = ApiService();
      final data = await api.getAddressBalance(address);
      if (mounted) {
        setState(() {
          _confirmedSats = (data['confirmed_satoshis'] as num?)?.toInt() ?? 0;
          _unconfirmedSats = (data['unconfirmed_satoshis'] as num?)?.toInt() ?? 0;
          _loadingBalance = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _loadingBalance = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final auth = context.watch<AuthProvider>();
    final wallet = context.watch<WalletProvider>();
    final address = auth.walletAddress ?? '';
    final totalSats = _confirmedSats + _unconfirmedSats;
    final bch = totalSats / AppConstants.satoshisPerBch;
    final usd = bch * wallet.bchPriceUsd;

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _fetchBalance,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 20),
              Text('Wallet', style: theme.textTheme.headlineMedium),
              const SizedBox(height: 20),

              // Balance card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppTheme.bchGreen, Color(0xFF1A8A5A)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Your Balance',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: Colors.white70,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _loadingBalance
                        ? const SizedBox(
                            height: 40,
                            width: 40,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${bch.toStringAsFixed(8)} BCH',
                                style: GoogleFonts.inter(
                                  fontSize: 28,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                '\$${usd.toStringAsFixed(2)} USD',
                                style: GoogleFonts.inter(
                                  fontSize: 16,
                                  color: Colors.white70,
                                ),
                              ),
                            ],
                          ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => context.push('/send'),
                            icon: const Icon(Icons.send, size: 18),
                            label: const Text('Send'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: AppTheme.bchGreen,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => setState(() => _showReceive = !_showReceive),
                            icon: const Icon(Icons.arrow_downward, size: 18),
                            label: const Text('Receive'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white,
                              side: const BorderSide(color: Colors.white54),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Receive section
              if (_showReceive && address.isNotEmpty) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: theme.cardTheme.color,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      Text(
                        'Receive BCH',
                        style: theme.textTheme.titleMedium,
                      ),
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: QrImageView(
                          data: address,
                          version: QrVersions.auto,
                          size: 180,
                        ),
                      ),
                      const SizedBox(height: 12),
                      InkWell(
                        onTap: () {
                          Clipboard.setData(ClipboardData(text: address));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Address copied!')),
                          );
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: theme.inputDecorationTheme.fillColor,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Flexible(
                                child: Text(
                                  address,
                                  style: theme.textTheme.bodySmall?.copyWith(
                                    fontFamily: 'monospace',
                                    fontSize: 11,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 8),
                              const Icon(Icons.copy, size: 16),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // Pending indicator
              if (_unconfirmedSats > 0)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: Colors.orange.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.hourglass_bottom,
                          size: 18, color: Colors.orange),
                      const SizedBox(width: 8),
                      Text(
                        '$_unconfirmedSats sats pending confirmation',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: Colors.orange,
                        ),
                      ),
                    ],
                  ),
                ),

              // Quick actions
              Text('Quick Actions', style: theme.textTheme.titleMedium),
              const SizedBox(height: 12),
              Row(
                children: [
                  _QuickActionCard(
                    icon: Icons.qr_code_scanner,
                    label: 'Scan QR',
                    onTap: () => context.go('/scan'),
                  ),
                  const SizedBox(width: 12),
                  _QuickActionCard(
                    icon: Icons.receipt_long,
                    label: 'History',
                    onTap: () => context.go('/activity'),
                  ),
                ],
              ),
              const SizedBox(height: 80),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _QuickActionCard({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: theme.cardTheme.color,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            children: [
              Icon(icon, size: 28, color: AppTheme.bchGreen),
              const SizedBox(height: 8),
              Text(label, style: theme.textTheme.bodySmall),
            ],
          ),
        ),
      ),
    );
  }
}
