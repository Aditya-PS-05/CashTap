import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../config/constants.dart';
import '../config/theme.dart';
import '../providers/auth_provider.dart';
import '../providers/wallet_provider.dart';
import '../services/transaction_builder.dart';

class SendScreen extends StatefulWidget {
  final String? prefillAddress;
  final double? prefillAmount;

  const SendScreen({super.key, this.prefillAddress, this.prefillAmount});

  @override
  State<SendScreen> createState() => _SendScreenState();
}

class _SendScreenState extends State<SendScreen> {
  final _addressController = TextEditingController();
  final _amountController = TextEditingController();
  int _step = 0; // 0=address, 1=amount, 2=review, 3=sending, 4=done
  String _amountMode = 'BCH';
  String? _error;
  String? _txid;

  @override
  void initState() {
    super.initState();
    if (widget.prefillAddress != null) {
      _addressController.text = widget.prefillAddress!;
      _step = 1;
    }
    if (widget.prefillAmount != null) {
      _amountController.text = widget.prefillAmount!.toString();
    }
  }

  @override
  void dispose() {
    _addressController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  int get _amountSatoshis {
    final val = double.tryParse(_amountController.text) ?? 0;
    if (val <= 0) return 0;
    final wallet = context.read<WalletProvider>();
    if (_amountMode == 'USD') {
      if (wallet.bchPriceUsd <= 0) return 0;
      return ((val / wallet.bchPriceUsd) * AppConstants.satoshisPerBch).round();
    }
    return (val * AppConstants.satoshisPerBch).round();
  }

  bool get _isValidAddress {
    final addr = _addressController.text.trim();
    return RegExp(r'^(bitcoincash:|bchtest:)?[qpzrs][a-z0-9]{41,}$', caseSensitive: false)
        .hasMatch(addr);
  }

  Future<void> _handleSend() async {
    setState(() {
      _step = 3;
      _error = null;
    });

    try {
      final auth = context.read<AuthProvider>();
      final address = auth.walletAddress;
      if (address == null) throw Exception('No wallet address');

      final txid = await TransactionBuilder.buildAndBroadcast(
        senderAddress: address,
        recipientAddress: _addressController.text.trim(),
        amountSatoshis: _amountSatoshis,
      );

      if (mounted) {
        setState(() {
          _txid = txid;
          _step = 4;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
          _step = 2;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final wallet = context.watch<WalletProvider>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Send BCH'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: _buildStep(theme, wallet),
        ),
      ),
    );
  }

  Widget _buildStep(ThemeData theme, WalletProvider wallet) {
    switch (_step) {
      case 0:
        return _buildAddressStep(theme);
      case 1:
        return _buildAmountStep(theme, wallet);
      case 2:
        return _buildReviewStep(theme, wallet);
      case 3:
        return _buildSendingStep(theme);
      case 4:
        return _buildDoneStep(theme);
      default:
        return const SizedBox();
    }
  }

  Widget _buildAddressStep(ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 24),
        Text('Recipient Address', style: theme.textTheme.titleMedium),
        const SizedBox(height: 12),
        TextField(
          controller: _addressController,
          decoration: InputDecoration(
            hintText: 'bchtest:qp... or bitcoincash:q...',
            hintStyle: theme.textTheme.bodySmall,
            suffixIcon: IconButton(
              icon: const Icon(Icons.qr_code_scanner, size: 20),
              onPressed: () => context.push('/scan'),
            ),
          ),
          style: theme.textTheme.bodyMedium?.copyWith(
            fontFamily: 'monospace',
            fontSize: 13,
          ),
        ),
        const Spacer(),
        SizedBox(
          width: double.infinity,
          height: 52,
          child: ElevatedButton(
            onPressed: _isValidAddress ? () => setState(() => _step = 1) : null,
            child: const Text('Next'),
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildAmountStep(ThemeData theme, WalletProvider wallet) {
    final sats = _amountSatoshis;
    final bch = sats / AppConstants.satoshisPerBch;
    final usd = bch * wallet.bchPriceUsd;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 24),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Amount', style: theme.textTheme.titleMedium),
            TextButton(
              onPressed: () {
                setState(() {
                  _amountMode = _amountMode == 'BCH' ? 'USD' : 'BCH';
                  _amountController.clear();
                });
              },
              child: Text('Switch to ${_amountMode == "BCH" ? "USD" : "BCH"}'),
            ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _amountController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            hintText: '0.00',
            suffixText: _amountMode,
          ),
          style: GoogleFonts.inter(fontSize: 24, fontWeight: FontWeight.w600),
          onChanged: (_) => setState(() {}),
        ),
        if (sats > 0) ...[
          const SizedBox(height: 8),
          Text(
            _amountMode == 'BCH'
                ? '\$${usd.toStringAsFixed(2)} USD'
                : '${bch.toStringAsFixed(8)} BCH',
            style: theme.textTheme.bodySmall,
          ),
          Text(
            '${sats.toStringAsFixed(0)} sats',
            style: theme.textTheme.bodySmall,
          ),
        ],
        const Spacer(),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => setState(() => _step = 0),
                child: const Text('Back'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: sats > 546 ? () => setState(() => _step = 2) : null,
                child: const Text('Review'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildReviewStep(ThemeData theme, WalletProvider wallet) {
    final sats = _amountSatoshis;
    final bch = sats / AppConstants.satoshisPerBch;
    final fee = 226; // estimated fee

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 24),
        Text('Review Transaction', style: theme.textTheme.titleMedium),
        const SizedBox(height: 20),
        if (_error != null) ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppTheme.errorRed.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline, color: AppTheme.errorRed, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(_error!, style: theme.textTheme.bodySmall?.copyWith(color: AppTheme.errorRed)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
        _reviewRow(theme, 'To', _addressController.text.trim()),
        const Divider(),
        _reviewRow(theme, 'Amount', '${bch.toStringAsFixed(8)} BCH'),
        const Divider(),
        _reviewRow(theme, 'Network Fee', '~$fee sats'),
        const Divider(),
        _reviewRow(theme, 'Total', '${((sats + fee) / AppConstants.satoshisPerBch).toStringAsFixed(8)} BCH'),
        const Spacer(),
        Row(
          children: [
            Expanded(
              child: OutlinedButton(
                onPressed: () => setState(() => _step = 1),
                child: const Text('Back'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: _handleSend,
                child: const Text('Confirm & Send'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _reviewRow(ThemeData theme, String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: theme.textTheme.bodySmall),
          Flexible(
            child: Text(
              value,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontFamily: label == 'To' ? 'monospace' : null,
                fontSize: label == 'To' ? 11 : null,
              ),
              textAlign: TextAlign.end,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSendingStep(ThemeData theme) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(),
          const SizedBox(height: 20),
          Text('Broadcasting transaction...', style: theme.textTheme.bodyMedium),
        ],
      ),
    );
  }

  Widget _buildDoneStep(ThemeData theme) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppTheme.bchGreen.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check, size: 48, color: AppTheme.bchGreen),
          ),
          const SizedBox(height: 20),
          Text('BCH Sent!', style: theme.textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text(
            '${(_amountSatoshis / AppConstants.satoshisPerBch).toStringAsFixed(8)} BCH',
            style: theme.textTheme.bodyMedium,
          ),
          if (_txid != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: theme.inputDecorationTheme.fillColor,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'TX: ${_txid!.substring(0, 16)}...',
                style: theme.textTheme.bodySmall?.copyWith(fontFamily: 'monospace'),
              ),
            ),
          ],
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              onPressed: () => context.pop(),
              child: const Text('Done'),
            ),
          ),
        ],
      ),
    );
  }
}
