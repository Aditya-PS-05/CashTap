import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';

import '../config/theme.dart';
import '../models/transaction.dart';
import '../services/bch_service.dart';

class TransactionTile extends StatelessWidget {
  final Transaction transaction;
  final VoidCallback? onTap;

  const TransactionTile({
    super.key,
    required this.transaction,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isIncoming = transaction.type == TransactionType.incoming;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        child: Row(
          children: [
            // Leading icon
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: (isIncoming ? AppTheme.bchGreen : AppTheme.warningOrange)
                    .withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                isIncoming ? Icons.arrow_downward : Icons.arrow_upward,
                color: isIncoming ? AppTheme.bchGreen : AppTheme.warningOrange,
                size: 22,
              ),
            ),
            const SizedBox(width: 14),

            // Amount — show both BCH + USD
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${isIncoming ? '+' : '-'}${BchService.formatBchAmount(transaction.amountBch)} BCH',
                    style: GoogleFonts.inter(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: isIncoming ? AppTheme.bchGreen : theme.textTheme.bodyLarge?.color,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    BchService.formatUsdAmount(transaction.amountUsd),
                    style: theme.textTheme.bodySmall?.copyWith(
                      fontSize: 12,
                    ),
                  ),
                  if (transaction.memo.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      transaction.memo,
                      style: theme.textTheme.bodySmall?.copyWith(
                        fontSize: 11,
                        fontStyle: FontStyle.italic,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ],
              ),
            ),

            // Status + time
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                _buildStatusChip(transaction.status),
                const SizedBox(height: 4),
                Text(
                  _formatTimestamp(transaction.createdAt),
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontSize: 11,
                  ),
                ),
              ],
            ),

            // Trailing chevron
            const SizedBox(width: 4),
            Icon(
              Icons.chevron_right,
              size: 20,
              color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.5),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatusChip(TransactionStatus status) {
    Color bgColor;
    Color textColor;

    switch (status) {
      case TransactionStatus.confirmed:
        bgColor = AppTheme.successGreen.withValues(alpha: 0.12);
        textColor = AppTheme.successGreen;
      case TransactionStatus.instant:
        bgColor = AppTheme.bchGreen.withValues(alpha: 0.12);
        textColor = AppTheme.bchGreen;
      case TransactionStatus.pending:
        bgColor = AppTheme.warningOrange.withValues(alpha: 0.12);
        textColor = AppTheme.warningOrange;
      case TransactionStatus.failed:
        bgColor = AppTheme.errorRed.withValues(alpha: 0.12);
        textColor = AppTheme.errorRed;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        status.displayName,
        style: GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
      ),
    );
  }

  String _formatTimestamp(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);

    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';

    return DateFormat('MMM d').format(dt);
  }
}
