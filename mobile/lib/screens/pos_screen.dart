import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../providers/payment_provider.dart';
import '../providers/wallet_provider.dart';
import '../services/bch_service.dart';
import '../widgets/numpad.dart';

class PosScreen extends StatefulWidget {
  const PosScreen({super.key});

  @override
  State<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends State<PosScreen> {
  String _amount = '0';
  bool _isUsd = true; // true = USD, false = BCH
  bool _showMemo = false;
  final _memoController = TextEditingController();

  @override
  void dispose() {
    _memoController.dispose();
    super.dispose();
  }

  void _onKeyPressed(String key) {
    HapticFeedback.lightImpact();
    setState(() {
      if (key == 'backspace') {
        if (_amount.length > 1) {
          _amount = _amount.substring(0, _amount.length - 1);
        } else {
          _amount = '0';
        }
      } else if (key == '.') {
        if (!_amount.contains('.')) {
          _amount = '$_amount.';
        }
      } else {
        // Number key
        if (_amount == '0' && key != '.') {
          _amount = key;
        } else {
          // Limit decimal places
          if (_amount.contains('.')) {
            final decimals = _amount.split('.')[1];
            final maxDecimals = _isUsd ? 2 : 8;
            if (decimals.length >= maxDecimals) return;
          }
          _amount += key;
        }
      }
    });
  }

  void _toggleCurrency() {
    HapticFeedback.mediumImpact();
    final wallet = context.read<WalletProvider>();
    final currentVal = double.tryParse(_amount) ?? 0;

    setState(() {
      if (_isUsd) {
        // Convert USD to BCH
        final bch = BchService.usdToBch(currentVal, wallet.bchPriceUsd);
        _amount = bch > 0 ? BchService.formatBchAmount(bch) : '0';
        _isUsd = false;
      } else {
        // Convert BCH to USD
        final usd = BchService.bchToUsd(currentVal, wallet.bchPriceUsd);
        _amount = usd > 0 ? usd.toStringAsFixed(2) : '0';
        _isUsd = true;
      }
    });
  }

  Future<void> _onCharge() async {
    final amountVal = double.tryParse(_amount) ?? 0;
    if (amountVal <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter an amount')),
      );
      return;
    }

    HapticFeedback.heavyImpact();

    final wallet = context.read<WalletProvider>();
    final payments = context.read<PaymentProvider>();

    double amountBch;
    double amountUsd;

    if (_isUsd) {
      amountUsd = amountVal;
      amountBch = BchService.usdToBch(amountVal, wallet.bchPriceUsd);
    } else {
      amountBch = amountVal;
      amountUsd = BchService.bchToUsd(amountVal, wallet.bchPriceUsd);
    }

    final paymentLink = await payments.createCharge(
      amountBch: amountBch,
      amountUsd: amountUsd,
      memo: _memoController.text.trim(),
    );

    if (paymentLink != null && mounted) {
      context.push('/pos/charge', extra: {
        'amountBch': amountBch,
        'amountUsd': amountUsd,
        'memo': _memoController.text.trim(),
        'paymentAddress': paymentLink.paymentAddress,
        'slug': paymentLink.slug,
      });

      // Reset POS after navigating
      setState(() {
        _amount = '0';
        _memoController.clear();
        _showMemo = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final wallet = context.watch<WalletProvider>();
    final amountVal = double.tryParse(_amount) ?? 0;

    // Calculate the other currency
    String secondaryAmount;
    if (_isUsd) {
      final bch = BchService.usdToBch(amountVal, wallet.bchPriceUsd);
      secondaryAmount = '${BchService.formatBchAmount(bch)} BCH';
    } else {
      final usd = BchService.bchToUsd(amountVal, wallet.bchPriceUsd);
      secondaryAmount = BchService.formatUsdAmount(usd);
    }

    return SafeArea(
      child: Column(
        children: [
          // App bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.point_of_sale, color: AppTheme.bchGreen, size: 22),
                const SizedBox(width: 8),
                Text(
                  'Point of Sale',
                  style: theme.textTheme.headlineSmall,
                ),
              ],
            ),
          ),

          // Amount display
          Expanded(
            flex: 3,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Main amount
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Text(
                      _isUsd ? '\$$_amount' : '$_amount BCH',
                      style: GoogleFonts.inter(
                        fontSize: 56,
                        fontWeight: FontWeight.w700,
                        color: theme.textTheme.displayLarge?.color,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 6),

                // Secondary amount
                Text(
                  amountVal > 0 ? secondaryAmount : '',
                  style: theme.textTheme.bodyLarge?.copyWith(
                    color: theme.textTheme.bodySmall?.color,
                  ),
                ),
                const SizedBox(height: 12),

                // Currency toggle
                GestureDetector(
                  onTap: _toggleCurrency,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppTheme.bchGreen.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: AppTheme.bchGreen.withValues(alpha: 0.3),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.swap_horiz,
                          size: 18,
                          color: AppTheme.bchGreen,
                        ),
                        const SizedBox(width: 6),
                        Text(
                          _isUsd ? 'USD' : 'BCH',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.bchGreen,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Memo field (collapsible)
          if (_showMemo)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: TextField(
                controller: _memoController,
                decoration: InputDecoration(
                  hintText: 'Add a memo (optional)',
                  hintStyle: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.textTheme.bodySmall?.color,
                  ),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.close, size: 20),
                    onPressed: () {
                      setState(() {
                        _showMemo = false;
                        _memoController.clear();
                      });
                    },
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                ),
                style: theme.textTheme.bodyMedium,
                textInputAction: TextInputAction.done,
              ),
            )
          else
            TextButton.icon(
              onPressed: () => setState(() => _showMemo = true),
              icon: const Icon(Icons.note_add_outlined, size: 18),
              label: const Text('Add Memo'),
              style: TextButton.styleFrom(
                foregroundColor: theme.textTheme.bodySmall?.color,
              ),
            ),
          const SizedBox(height: 8),

          // Numpad
          Expanded(
            flex: 4,
            child: Numpad(onKeyPressed: _onKeyPressed),
          ),

          // Charge button
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
            child: SizedBox(
              width: double.infinity,
              height: 60,
              child: ElevatedButton(
                onPressed: amountVal > 0 ? _onCharge : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.bchGreen,
                  disabledBackgroundColor: AppTheme.bchGreen.withValues(alpha: 0.3),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: Text(
                  amountVal > 0
                      ? 'Charge ${_isUsd ? '\$$_amount' : '$_amount BCH'}'
                      : 'Enter Amount',
                  style: GoogleFonts.inter(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
