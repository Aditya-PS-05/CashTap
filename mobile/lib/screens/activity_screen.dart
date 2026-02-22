import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../models/transaction.dart';
import '../providers/payment_provider.dart';
import '../widgets/error_retry.dart';
import '../widgets/skeleton_loader.dart';
import '../widgets/transaction_tile.dart';

enum _FilterPeriod { all, today, thisWeek, thisMonth }

enum _FilterStatus { all, completed, pending, failed }

class ActivityScreen extends StatefulWidget {
  const ActivityScreen({super.key});

  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  _FilterPeriod _selectedPeriod = _FilterPeriod.all;
  _FilterStatus _selectedStatus = _FilterStatus.all;
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    context.read<PaymentProvider>().fetchTransactions();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      final provider = context.read<PaymentProvider>();
      if (!provider.isLoadingMore && provider.hasMoreTransactions) {
        provider.loadMoreTransactions();
      }
    }
  }

  List<Transaction> _getFilteredTransactions(PaymentProvider provider) {
    final now = DateTime.now();

    DateTime? from;
    switch (_selectedPeriod) {
      case _FilterPeriod.today:
        from = DateTime(now.year, now.month, now.day);
      case _FilterPeriod.thisWeek:
        final weekStart = now.subtract(Duration(days: now.weekday - 1));
        from = DateTime(weekStart.year, weekStart.month, weekStart.day);
      case _FilterPeriod.thisMonth:
        from = DateTime(now.year, now.month, 1);
      case _FilterPeriod.all:
        from = null;
    }

    // Map status filter to TransactionStatus for the provider.
    // "Completed" matches both confirmed and instant, so we handle it locally.
    TransactionStatus? statusFilter;
    switch (_selectedStatus) {
      case _FilterStatus.all:
        statusFilter = null;
      case _FilterStatus.completed:
        // We will filter locally for both confirmed and instant.
        statusFilter = null;
      case _FilterStatus.pending:
        statusFilter = TransactionStatus.pending;
      case _FilterStatus.failed:
        statusFilter = TransactionStatus.failed;
    }

    List<Transaction> results = provider.filterTransactions(
      from: from,
      status: statusFilter,
    );

    // Apply "Completed" filter locally to match both confirmed and instant.
    if (_selectedStatus == _FilterStatus.completed) {
      results = results
          .where((tx) =>
              tx.status == TransactionStatus.confirmed ||
              tx.status == TransactionStatus.instant)
          .toList();
    }

    return results;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final payments = context.watch<PaymentProvider>();
    final filteredTxs = _getFilteredTransactions(payments);

    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
            child: Text(
              'Activity',
              style: theme.textTheme.headlineMedium,
            ),
          ),

          // Time period filter chips
          SizedBox(
            height: 42,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                _buildPeriodChip('All', _FilterPeriod.all),
                const SizedBox(width: 8),
                _buildPeriodChip('Today', _FilterPeriod.today),
                const SizedBox(width: 8),
                _buildPeriodChip('This Week', _FilterPeriod.thisWeek),
                const SizedBox(width: 8),
                _buildPeriodChip('This Month', _FilterPeriod.thisMonth),
              ],
            ),
          ),
          const SizedBox(height: 6),

          // Status filter chips
          SizedBox(
            height: 42,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                _buildStatusChip('All Status', _FilterStatus.all),
                const SizedBox(width: 8),
                _buildStatusChip('Completed', _FilterStatus.completed),
                const SizedBox(width: 8),
                _buildStatusChip('Pending', _FilterStatus.pending),
                const SizedBox(width: 8),
                _buildStatusChip('Failed', _FilterStatus.failed),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Transaction list
          Expanded(
            child: _buildBody(theme, payments, filteredTxs),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(
    ThemeData theme,
    PaymentProvider payments,
    List<Transaction> filteredTxs,
  ) {
    // Error state
    if (payments.hasError && !payments.isLoading) {
      return ErrorRetry(
        message: payments.errorMessage ?? 'Failed to load transactions',
        onRetry: () => payments.fetchTransactions(),
      );
    }

    // Initial loading with skeleton
    if (payments.isLoading) {
      return _buildSkeletonList();
    }

    // Empty state
    if (filteredTxs.isEmpty) {
      return _buildEmpty(theme);
    }

    // Transaction list with infinite scroll
    return RefreshIndicator(
      color: AppTheme.bchGreen,
      onRefresh: () => payments.fetchTransactions(),
      child: ListView.builder(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: filteredTxs.length + (payments.isLoadingMore ? 1 : 0),
        itemBuilder: (context, index) {
          // Loading more indicator at the bottom
          if (index == filteredTxs.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: AppTheme.bchGreen,
                  ),
                ),
              ),
            );
          }

          final tx = filteredTxs[index];
          return TransactionTile(
            transaction: tx,
            onTap: () => context.push('/transaction/${tx.id}'),
          );
        },
      ),
    );
  }

  Widget _buildSkeletonList() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      physics: const NeverScrollableScrollPhysics(),
      itemCount: 8,
      itemBuilder: (context, index) {
        return const TransactionTileSkeleton();
      },
    );
  }

  Widget _buildPeriodChip(String label, _FilterPeriod period) {
    final isSelected = _selectedPeriod == period;

    return FilterChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) {
        HapticFeedback.selectionClick();
        setState(() => _selectedPeriod = period);
      },
      selectedColor: AppTheme.bchGreen.withValues(alpha: 0.15),
      checkmarkColor: AppTheme.bchGreen,
      side: BorderSide(
        color: isSelected
            ? AppTheme.bchGreen.withValues(alpha: 0.4)
            : Colors.transparent,
      ),
    );
  }

  Widget _buildStatusChip(String label, _FilterStatus status) {
    final isSelected = _selectedStatus == status;

    return FilterChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (_) {
        HapticFeedback.selectionClick();
        setState(() => _selectedStatus = status);
      },
      selectedColor: AppTheme.bchGreen.withValues(alpha: 0.15),
      checkmarkColor: AppTheme.bchGreen,
      side: BorderSide(
        color: isSelected
            ? AppTheme.bchGreen.withValues(alpha: 0.4)
            : Colors.transparent,
      ),
    );
  }

  Widget _buildEmpty(ThemeData theme) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.receipt_long_outlined,
            size: 64,
            color: theme.textTheme.bodySmall?.color?.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 16),
          Text(
            'No transactions found',
            style: theme.textTheme.bodyLarge?.copyWith(
              color: theme.textTheme.bodySmall?.color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Transactions will appear here',
            style: theme.textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
