import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../providers/auth_provider.dart';
import '../providers/payment_provider.dart';
import '../providers/wallet_provider.dart';
import '../services/bch_service.dart';
import '../widgets/error_retry.dart';
import '../widgets/skeleton_loader.dart';
import '../widgets/stat_card.dart';
import '../widgets/transaction_tile.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with SingleTickerProviderStateMixin {
  bool _isFirstLoad = true;
  bool _hasLoadError = false;
  String _loadErrorMessage = 'Failed to load dashboard data';
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(_onTabChanged);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.removeListener(_onTabChanged);
    _tabController.dispose();
    super.dispose();
  }

  void _onTabChanged() {
    if (!_tabController.indexIsChanging) return;
    // Tab changed, analytics data is already loaded
  }

  Future<void> _loadData() async {
    final paymentProvider = context.read<PaymentProvider>();
    final walletProvider = context.read<WalletProvider>();

    try {
      await Future.wait([
        paymentProvider.fetchDashboardStats(),
        paymentProvider.fetchTransactions(),
        walletProvider.refreshAll(),
        paymentProvider.fetchAnalytics(range: '7d'),
        paymentProvider.fetchAnalytics(range: '30d'),
        paymentProvider.fetchAnalytics(range: '90d'),
      ]);

      if (mounted) {
        setState(() {
          _hasLoadError = false;
          _isFirstLoad = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _hasLoadError = true;
          _loadErrorMessage = 'Failed to load dashboard data';
          _isFirstLoad = false;
        });
      }
    }
  }

  Future<void> _onRefresh() async {
    HapticFeedback.lightImpact();
    await _loadData();
  }

  /// Determine if the user is a first-time user with no data at all.
  bool _isFirstTimeUser(PaymentProvider payments, WalletProvider wallet) {
    return payments.recentTransactions.isEmpty &&
        payments.todayRevenueUsd == 0 &&
        payments.todayRevenueBch == 0 &&
        payments.todayTxCount == 0 &&
        payments.pendingCount == 0;
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final payments = context.watch<PaymentProvider>();
    final wallet = context.watch<WalletProvider>();
    final theme = Theme.of(context);

    return SafeArea(
      child: RefreshIndicator(
        color: AppTheme.bchGreen,
        onRefresh: _onRefresh,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 20),

              // Welcome header
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Welcome back,',
                          style: theme.textTheme.bodyMedium?.copyWith(
                            color: theme.textTheme.bodySmall?.color,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          auth.currentMerchant?.businessName ?? 'Merchant',
                          style: theme.textTheme.headlineMedium,
                        ),
                      ],
                    ),
                  ),
                  // Balance chip
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: AppTheme.bchGreen.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      wallet.formattedBchBalance,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.bchGreen,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Error state
              if (_hasLoadError && !_isFirstLoad)
                ErrorRetry(
                  message: _loadErrorMessage,
                  onRetry: _loadData,
                )
              // Skeleton loading state
              else if (_isFirstLoad)
                _buildSkeletonContent()
              // Normal content
              else
                _buildDashboardContent(payments, wallet, theme),

              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSkeletonContent() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Skeleton stat cards
        const Row(
          children: [
            Expanded(child: StatCardSkeleton()),
            SizedBox(width: 12),
            Expanded(child: StatCardSkeleton()),
          ],
        ),
        const SizedBox(height: 12),
        const Row(
          children: [
            Expanded(child: StatCardSkeleton()),
            SizedBox(width: 12),
            Expanded(child: StatCardSkeleton()),
          ],
        ),
        const SizedBox(height: 28),

        // Skeleton chart title
        const SkeletonLoader(width: 140, height: 18),
        const SizedBox(height: 16),
        const ChartSkeleton(),
        const SizedBox(height: 28),

        // Skeleton transactions title
        const SkeletonLoader(width: 180, height: 18),
        const SizedBox(height: 16),
        const TransactionTileSkeleton(),
        const TransactionTileSkeleton(),
        const TransactionTileSkeleton(),
      ],
    );
  }

  Widget _buildDashboardContent(
    PaymentProvider payments,
    WalletProvider wallet,
    ThemeData theme,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Time period tabs with stats
        Container(
          decoration: BoxDecoration(
            color: theme.cardTheme.color,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              TabBar(
                controller: _tabController,
                labelColor: AppTheme.bchGreen,
                unselectedLabelColor: theme.textTheme.bodySmall?.color,
                indicatorColor: AppTheme.bchGreen,
                indicatorSize: TabBarIndicatorSize.label,
                labelStyle: GoogleFonts.inter(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
                tabs: const [
                  Tab(text: 'Today'),
                  Tab(text: 'This Week'),
                  Tab(text: 'This Month'),
                ],
              ),
              SizedBox(
                height: 120,
                child: TabBarView(
                  controller: _tabController,
                  children: [
                    // Today
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Expanded(
                            child: _buildMiniStat(
                              theme,
                              'Revenue',
                              BchService.formatUsdAmount(payments.todayRevenueUsd),
                              BchService.formatBchWithUnit(payments.todayRevenueBch),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: _buildMiniStat(
                              theme,
                              'Transactions',
                              payments.todayTxCount.toString(),
                              '${payments.pendingCount} pending',
                            ),
                          ),
                        ],
                      ),
                    ),
                    // This Week
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Expanded(
                            child: _buildMiniStat(
                              theme,
                              'Revenue',
                              BchService.formatUsdAmount(payments.weekRevenueUsd),
                              BchService.formatBchWithUnit(payments.weekRevenueBch),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: _buildMiniStat(
                              theme,
                              'Transactions',
                              payments.weekTxCount.toString(),
                              'This week',
                            ),
                          ),
                        ],
                      ),
                    ),
                    // This Month
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Expanded(
                            child: _buildMiniStat(
                              theme,
                              'Revenue',
                              BchService.formatUsdAmount(payments.monthRevenueUsd),
                              BchService.formatBchWithUnit(payments.monthRevenueBch),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: _buildMiniStat(
                              theme,
                              'Transactions',
                              payments.monthTxCount.toString(),
                              'This month',
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Additional stat cards row
        Row(
          children: [
            Expanded(
              child: StatCard(
                title: 'Pending',
                value: payments.pendingCount.toString(),
                subtitle: 'Awaiting confirmation',
                icon: Icons.hourglass_empty,
                iconColor: AppTheme.warningOrange,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: StatCard(
                title: 'BCH Price',
                value: BchService.formatUsdAmount(wallet.bchPriceUsd),
                subtitle: 'USD/BCH',
                icon: Icons.show_chart,
                iconColor: AppTheme.successGreen,
              ),
            ),
          ],
        ),
        const SizedBox(height: 28),

        // Quick access cards
        Text(
          'Quick Actions',
          style: theme.textTheme.titleLarge,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildQuickActionCard(
                theme,
                icon: Icons.link,
                label: 'Payment Links',
                color: AppTheme.bchGreen,
                onTap: () => context.push('/payment-links'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildQuickActionCard(
                theme,
                icon: Icons.description_outlined,
                label: 'Contracts',
                color: AppTheme.pendingBlue,
                onTap: () => context.push('/contracts'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 28),

        // Weekly revenue chart
        Text(
          'Weekly Revenue',
          style: theme.textTheme.titleLarge,
        ),
        const SizedBox(height: 16),
        _buildWeeklyChart(payments),
        const SizedBox(height: 28),

        // Recent transactions
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Recent Transactions',
              style: theme.textTheme.titleLarge,
            ),
            TextButton(
              onPressed: () => context.go('/activity'),
              child: const Text('See All'),
            ),
          ],
        ),
        const SizedBox(height: 8),

        // Onboarding prompt for first-time users, or empty state, or transactions
        if (_isFirstTimeUser(payments, context.read<WalletProvider>()))
          _buildOnboardingCard(theme)
        else if (payments.recentTransactions.isEmpty)
          _buildEmptyTransactions(theme)
        else
          ...payments.recentTransactions.map(
            (tx) => TransactionTile(
              transaction: tx,
              onTap: () => context.push('/transaction/${tx.id}'),
            ),
          ),
      ],
    );
  }

  Widget _buildMiniStat(ThemeData theme, String label, String value, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 12,
            color: theme.textTheme.bodySmall?.color,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: GoogleFonts.inter(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: theme.textTheme.displayLarge?.color,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: GoogleFonts.inter(
            fontSize: 12,
            color: theme.textTheme.bodySmall?.color,
          ),
        ),
      ],
    );
  }

  Widget _buildOnboardingCard(ThemeData theme) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: theme.cardTheme.color,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppTheme.bchGreen.withValues(alpha: 0.3),
          width: 1.5,
        ),
      ),
      child: Column(
        children: [
          Image.asset(
            'assets/images/bch_coin_icon.png',
            width: 96,
            height: 96,
            errorBuilder: (context, error, stackTrace) => Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppTheme.bchGreen.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.storefront,
                size: 32,
                color: AppTheme.bchGreen,
              ),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Get Started with BCH Pay',
            style: GoogleFonts.inter(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: theme.textTheme.displayLarge?.color,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Start accepting Bitcoin Cash payments in seconds. '
            'Create a charge, share a payment link, or explore your wallet.',
            textAlign: TextAlign.center,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.textTheme.bodySmall?.color,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => context.go('/pos'),
              icon: const Icon(Icons.point_of_sale, size: 20),
              label: const Text('Create your first charge'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.bchGreen,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 50),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                textStyle: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => context.push('/payment-links'),
              icon: const Icon(Icons.link, size: 20),
              label: const Text('Create a payment link'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppTheme.bchGreen,
                minimumSize: const Size(double.infinity, 50),
                side: const BorderSide(color: AppTheme.bchGreen, width: 1.5),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                textStyle: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: TextButton.icon(
              onPressed: () => context.go('/settings'),
              icon: Icon(
                Icons.account_balance_wallet_outlined,
                size: 20,
                color: theme.textTheme.bodySmall?.color,
              ),
              label: Text(
                'View your wallet',
                style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: theme.textTheme.bodySmall?.color,
                ),
              ),
              style: TextButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWeeklyChart(PaymentProvider payments) {
    final theme = Theme.of(context);
    final revenue = payments.weekRevenue;
    final labels = payments.weekLabels;

    if (revenue.isEmpty) {
      return Container(
        height: 180,
        decoration: BoxDecoration(
          color: theme.cardTheme.color,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Center(
          child: Text(
            'No data yet',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.textTheme.bodySmall?.color,
            ),
          ),
        ),
      );
    }

    final maxY = revenue.reduce((a, b) => a > b ? a : b) * 1.3;

    return Container(
      height: 200,
      padding: const EdgeInsets.fromLTRB(8, 16, 16, 8),
      decoration: BoxDecoration(
        color: theme.cardTheme.color,
        borderRadius: BorderRadius.circular(16),
      ),
      child: BarChart(
        BarChartData(
          maxY: maxY,
          barTouchData: BarTouchData(
            touchTooltipData: BarTouchTooltipData(
              getTooltipItem: (group, groupIndex, rod, rodIndex) {
                return BarTooltipItem(
                  '\$${rod.toY.toStringAsFixed(2)}',
                  GoogleFonts.inter(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                );
              },
            ),
          ),
          titlesData: FlTitlesData(
            show: true,
            topTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            rightTitles:
                const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 40,
                getTitlesWidget: (value, meta) {
                  return Text(
                    '\$${value.toInt()}',
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      color: theme.textTheme.bodySmall?.color,
                    ),
                  );
                },
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                getTitlesWidget: (value, meta) {
                  final index = value.toInt();
                  if (index >= 0 && index < labels.length) {
                    return Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        labels[index],
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: theme.textTheme.bodySmall?.color,
                        ),
                      ),
                    );
                  }
                  return const SizedBox.shrink();
                },
              ),
            ),
          ),
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            horizontalInterval: maxY / 4,
            getDrawingHorizontalLine: (value) {
              return FlLine(
                color: theme.dividerColor.withValues(alpha: 0.3),
                strokeWidth: 1,
              );
            },
          ),
          borderData: FlBorderData(show: false),
          barGroups: List.generate(revenue.length, (index) {
            return BarChartGroupData(
              x: index,
              barRods: [
                BarChartRodData(
                  toY: revenue[index],
                  color: AppTheme.bchGreen,
                  width: 24,
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(6)),
                ),
              ],
            );
          }),
        ),
      ),
    );
  }

  Widget _buildQuickActionCard(
    ThemeData theme, {
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Icon(
                Icons.arrow_forward_ios,
                size: 14,
                color: theme.textTheme.bodySmall?.color,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyTransactions(ThemeData theme) {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: theme.cardTheme.color,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Center(
        child: Column(
          children: [
            Icon(
              Icons.receipt_long_outlined,
              size: 48,
              color: theme.textTheme.bodySmall?.color,
            ),
            const SizedBox(height: 12),
            Text(
              'No transactions yet',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.textTheme.bodySmall?.color,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Start accepting payments with POS',
              style: theme.textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}
