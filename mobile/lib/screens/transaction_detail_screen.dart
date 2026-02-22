import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/constants.dart';
import '../config/theme.dart';
import '../models/transaction.dart';
import '../providers/payment_provider.dart';
import '../services/bch_service.dart';

class TransactionDetailScreen extends StatelessWidget {
  final String transactionId;

  const TransactionDetailScreen({super.key, required this.transactionId});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final payments = context.watch<PaymentProvider>();

    final tx = payments.transactions.firstWhere(
      (t) => t.id == transactionId,
      orElse: () => Transaction(
        id: transactionId,
        txHash: '',
        merchantId: '',
        amountBch: 0,
        amountUsd: 0,
        senderAddress: '',
        recipientAddress: '',
      ),
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Transaction Details'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Amount card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppTheme.bchGreen, AppTheme.bchGreenDark],
                ),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  Icon(
                    tx.type == TransactionType.incoming
                        ? Icons.arrow_downward
                        : Icons.arrow_upward,
                    color: Colors.white.withValues(alpha: 0.8),
                    size: 32,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${tx.type == TransactionType.incoming ? '+' : '-'}${BchService.formatBchAmount(tx.amountBch)} BCH',
                    style: GoogleFonts.inter(
                      fontSize: 32,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    BchService.formatUsdAmount(tx.amountUsd),
                    style: GoogleFonts.inter(
                      fontSize: 18,
                      color: Colors.white.withValues(alpha: 0.85),
                    ),
                  ),
                  const SizedBox(height: 12),
                  _buildStatusBadge(tx.status),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Details
            _buildDetailSection(theme, 'Transaction Hash', tx.txHash,
                isCopyable: true, context: context),
            const SizedBox(height: 16),
            _buildDetailSection(theme, 'Sender', tx.senderAddress,
                isCopyable: true, context: context),
            const SizedBox(height: 16),
            _buildDetailSection(theme, 'Recipient', tx.recipientAddress,
                isCopyable: true, context: context),
            const SizedBox(height: 16),

            // Confirmations
            _buildDetailRow(theme, 'Status', tx.status.displayName),
            const Divider(height: 24),
            _buildDetailRow(
                theme, 'Confirmations', tx.confirmations.toString()),
            const Divider(height: 24),
            _buildDetailRow(theme, 'Type',
                tx.type == TransactionType.incoming ? 'Received' : 'Sent'),
            const Divider(height: 24),
            _buildDetailRow(theme, 'Time', _formatDateTime(tx.createdAt)),

            if (tx.memo.isNotEmpty) ...[
              const Divider(height: 24),
              _buildDetailRow(theme, 'Memo', tx.memo),
            ],

            // Loyalty Tokens Issued
            if (tx.loyaltyTokens != null) ...[
              const SizedBox(height: 32),
              _buildLoyaltyTokensSection(theme, tx.loyaltyTokens!),
            ],

            // Receipt NFT
            if (tx.receiptNft != null) ...[
              const SizedBox(height: 32),
              _buildReceiptNftSection(theme, tx.receiptNft!),
            ],

            const SizedBox(height: 32),

            // Block explorer link
            if (tx.txHash.isNotEmpty)
              OutlinedButton.icon(
                onPressed: () => _openBlockExplorer(tx.txHash),
                icon: const Icon(Icons.open_in_new, size: 18),
                label: const Text('View on Block Explorer'),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 48),
                ),
              ),

            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(TransactionStatus status) {
    Color bgColor;
    Color textColor;

    switch (status) {
      case TransactionStatus.confirmed:
        bgColor = Colors.white.withValues(alpha: 0.2);
        textColor = Colors.white;
      case TransactionStatus.instant:
        bgColor = Colors.white.withValues(alpha: 0.2);
        textColor = Colors.white;
      case TransactionStatus.pending:
        bgColor = AppTheme.warningOrange.withValues(alpha: 0.3);
        textColor = Colors.white;
      case TransactionStatus.failed:
        bgColor = AppTheme.errorRed.withValues(alpha: 0.3);
        textColor = Colors.white;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status.displayName,
        style: GoogleFonts.inter(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
      ),
    );
  }

  Widget _buildDetailSection(
    ThemeData theme,
    String label,
    String value, {
    bool isCopyable = false,
    BuildContext? context,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: theme.textTheme.labelMedium),
        const SizedBox(height: 6),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: theme.cardTheme.color,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  value.isNotEmpty ? value : '--',
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontFamily: 'monospace',
                    fontSize: 12,
                  ),
                ),
              ),
              if (isCopyable && value.isNotEmpty && context != null)
                IconButton(
                  icon: const Icon(Icons.copy, size: 16),
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    Clipboard.setData(ClipboardData(text: value));
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('$label copied!'),
                        duration: const Duration(seconds: 1),
                      ),
                    );
                  },
                  visualDensity: VisualDensity.compact,
                ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDetailRow(ThemeData theme, String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.textTheme.bodySmall?.color,
          ),
        ),
        Text(
          value,
          style: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }

  // ---- Loyalty Tokens Section ----

  Widget _buildLoyaltyTokensSection(ThemeData theme, LoyaltyTokenInfo tokens) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section header
        Row(
          children: [
            Icon(
              Icons.card_giftcard,
              size: 20,
              color: AppTheme.successGreen,
            ),
            const SizedBox(width: 8),
            Text(
              'Loyalty Tokens Issued',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Green-tinted card
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.successGreen.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: AppTheme.successGreen.withValues(alpha: 0.2),
            ),
          ),
          child: Column(
            children: [
              _buildTokenDetailRow(
                theme,
                'Token Name',
                tokens.tokenName,
                AppTheme.successGreen,
              ),
              Divider(
                height: 20,
                color: AppTheme.successGreen.withValues(alpha: 0.15),
              ),
              _buildTokenDetailRow(
                theme,
                'Symbol',
                tokens.tokenSymbol,
                AppTheme.successGreen,
              ),
              Divider(
                height: 20,
                color: AppTheme.successGreen.withValues(alpha: 0.15),
              ),
              _buildTokenDetailRow(
                theme,
                'Amount Issued',
                tokens.amount.toStringAsFixed(
                    tokens.amount.truncateToDouble() == tokens.amount ? 0 : 2),
                AppTheme.successGreen,
              ),
            ],
          ),
        ),
      ],
    );
  }

  // ---- Receipt NFT Section ----

  Widget _buildReceiptNftSection(ThemeData theme, ReceiptNftInfo nft) {
    const purpleAccent = Color(0xFF9B59B6);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section header
        Row(
          children: [
            Icon(
              Icons.verified,
              size: 20,
              color: purpleAccent,
            ),
            const SizedBox(width: 8),
            Text(
              'Receipt NFT',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Purple-tinted card
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: purpleAccent.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: purpleAccent.withValues(alpha: 0.2),
            ),
          ),
          child: Column(
            children: [
              _buildTokenDetailRow(
                theme,
                'Token Category',
                _truncateHash(nft.tokenCategory),
                purpleAccent,
              ),
              Divider(
                height: 20,
                color: purpleAccent.withValues(alpha: 0.15),
              ),
              _buildTokenDetailRow(
                theme,
                'Commitment',
                _truncateHash(nft.commitment),
                purpleAccent,
              ),
              if (nft.merchantName != null &&
                  nft.merchantName!.isNotEmpty) ...[
                Divider(
                  height: 20,
                  color: purpleAccent.withValues(alpha: 0.15),
                ),
                _buildTokenDetailRow(
                  theme,
                  'Merchant',
                  nft.merchantName!,
                  purpleAccent,
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }

  // ---- Helpers ----

  Widget _buildTokenDetailRow(
    ThemeData theme,
    String label,
    String value,
    Color accentColor,
  ) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.textTheme.bodySmall?.color,
          ),
        ),
        const SizedBox(width: 12),
        Flexible(
          child: Text(
            value,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
              color: accentColor,
            ),
            textAlign: TextAlign.end,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  String _truncateHash(String hash) {
    if (hash.length <= 16) return hash;
    return '${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}';
  }

  String _formatDateTime(DateTime dt) {
    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    final hour = dt.hour.toString().padLeft(2, '0');
    final minute = dt.minute.toString().padLeft(2, '0');
    return '${months[dt.month - 1]} ${dt.day}, ${dt.year} at $hour:$minute';
  }

  Future<void> _openBlockExplorer(String txHash) async {
    final url = Uri.parse('${AppConstants.blockExplorerUrl}/$txHash');
    if (await canLaunchUrl(url)) {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    }
  }
}
