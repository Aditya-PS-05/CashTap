import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import '../config/theme.dart';
import '../models/payment_link.dart';
import '../services/api_service.dart';
import '../services/bch_service.dart';

class PaymentLinksScreen extends StatefulWidget {
  const PaymentLinksScreen({super.key});

  @override
  State<PaymentLinksScreen> createState() => _PaymentLinksScreenState();
}

class _PaymentLinksScreenState extends State<PaymentLinksScreen> {
  final ApiService _apiService = ApiService();
  List<PaymentLink> _links = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchLinks();
  }

  Future<void> _fetchLinks() async {
    setState(() => _isLoading = true);
    try {
      _links = await _apiService.getPaymentLinks();
    } catch (e) {
      debugPrint('Failed to fetch payment links: $e');
    }
    if (mounted) setState(() => _isLoading = false);
  }

  void _showCreateDialog() {
    final amountController = TextEditingController();
    final memoController = TextEditingController();
    PaymentLinkType selectedType = PaymentLinkType.single;
    String selectedInterval = 'monthly';
    bool creating = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setSheetState) {
            final theme = Theme.of(ctx);
            return Padding(
              padding: EdgeInsets.fromLTRB(
                20,
                20,
                20,
                MediaQuery.of(ctx).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Create Payment Link',
                      style: theme.textTheme.titleLarge),
                  const SizedBox(height: 16),

                  TextField(
                    controller: amountController,
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: false),
                    decoration: const InputDecoration(
                      labelText: 'Amount (satoshis)',
                      hintText: '50000',
                    ),
                  ),
                  const SizedBox(height: 12),

                  TextField(
                    controller: memoController,
                    decoration: const InputDecoration(
                      labelText: 'Description',
                      hintText: 'Coffee, Web Design, Donation...',
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Type selection
                  Text('Link Type', style: theme.textTheme.bodyMedium),
                  const SizedBox(height: 8),
                  SegmentedButton<PaymentLinkType>(
                    segments: const [
                      ButtonSegment(
                        value: PaymentLinkType.single,
                        label: Text('Single'),
                      ),
                      ButtonSegment(
                        value: PaymentLinkType.multi,
                        label: Text('Multi'),
                      ),
                      ButtonSegment(
                        value: PaymentLinkType.recurring,
                        label: Text('Recurring'),
                      ),
                    ],
                    selected: {selectedType},
                    onSelectionChanged: (selected) {
                      setSheetState(() => selectedType = selected.first);
                    },
                  ),
                  const SizedBox(height: 12),

                  if (selectedType == PaymentLinkType.recurring) ...[
                    Text('Billing Interval',
                        style: theme.textTheme.bodyMedium),
                    const SizedBox(height: 8),
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'daily', label: Text('Daily')),
                        ButtonSegment(value: 'weekly', label: Text('Weekly')),
                        ButtonSegment(
                            value: 'monthly', label: Text('Monthly')),
                        ButtonSegment(value: 'yearly', label: Text('Yearly')),
                      ],
                      selected: {selectedInterval},
                      onSelectionChanged: (selected) {
                        setSheetState(() => selectedInterval = selected.first);
                      },
                    ),
                    const SizedBox(height: 12),
                  ],

                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: creating
                          ? null
                          : () async {
                              final amount =
                                  int.tryParse(amountController.text);
                              if (amount == null || amount <= 0) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                      content:
                                          Text('Enter a valid amount')),
                                );
                                return;
                              }
                              setSheetState(() => creating = true);
                              try {
                                await _apiService.createPaymentLink(
                                  amountSatoshis: amount,
                                  memo: memoController.text,
                                  type: selectedType,
                                  recurringInterval:
                                      selectedType == PaymentLinkType.recurring
                                          ? selectedInterval
                                          : null,
                                );
                                if (ctx.mounted) Navigator.pop(ctx);
                                _fetchLinks();
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                        content: Text(
                                            'Payment link created!')),
                                  );
                                }
                              } catch (e) {
                                if (ctx.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                        content: Text('Error: $e')),
                                  );
                                }
                              } finally {
                                if (ctx.mounted) {
                                  setSheetState(() => creating = false);
                                }
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.bchGreen,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: creating
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Create Payment Link'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Color _statusColor(PaymentLinkStatus status) {
    switch (status) {
      case PaymentLinkStatus.active:
        return AppTheme.successGreen;
      case PaymentLinkStatus.paid:
        return AppTheme.bchGreen;
      case PaymentLinkStatus.expired:
        return AppTheme.warningOrange;
      case PaymentLinkStatus.inactive:
      case PaymentLinkStatus.cancelled:
        return Colors.grey;
    }
  }

  Color _typeColor(PaymentLinkType type) {
    switch (type) {
      case PaymentLinkType.single:
        return Colors.blueGrey;
      case PaymentLinkType.multi:
        return AppTheme.pendingBlue;
      case PaymentLinkType.recurring:
        return Colors.purple;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Payment Links'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchLinks,
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateDialog,
        backgroundColor: AppTheme.bchGreen,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Create Link'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _links.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.link_off,
                          size: 64, color: theme.disabledColor),
                      const SizedBox(height: 16),
                      Text('No payment links yet',
                          style: theme.textTheme.bodyLarge),
                      const SizedBox(height: 8),
                      Text('Create your first payment link',
                          style: theme.textTheme.bodySmall),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _fetchLinks,
                  color: AppTheme.bchGreen,
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    itemCount: _links.length,
                    itemBuilder: (context, index) {
                      final link = _links[index];
                      return _buildLinkCard(theme, link);
                    },
                  ),
                ),
    );
  }

  Widget _buildLinkCard(ThemeData theme, PaymentLink link) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () {
          // Copy payment link
          Clipboard.setData(ClipboardData(text: link.slug));
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Payment link slug copied!')),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Top row: memo + status
              Row(
                children: [
                  Expanded(
                    child: Text(
                      link.memo.isNotEmpty ? link.memo : 'Untitled',
                      style: theme.textTheme.bodyLarge?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _statusColor(link.status).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      link.status.displayName,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: _statusColor(link.status),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              // Slug
              Text(
                '/pay/${link.slug}',
                style: TextStyle(
                  fontSize: 12,
                  color: theme.textTheme.bodySmall?.color,
                  fontFamily: 'monospace',
                ),
              ),
              const SizedBox(height: 10),

              // Amount + type + interval row
              Row(
                children: [
                  // Amount
                  Text(
                    link.amountSatoshis > 0
                        ? BchService.formatBchWithUnit(link.amountBch)
                        : 'Any amount',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(width: 12),

                  // Type badge
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: _typeColor(link.type).withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      link.type.displayName,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: _typeColor(link.type),
                      ),
                    ),
                  ),

                  // Recurring interval
                  if (link.isRecurring && link.recurringInterval != null) ...[
                    const SizedBox(width: 8),
                    Text(
                      link.recurringInterval!,
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        color: Colors.purple,
                      ),
                    ),
                    if (link.recurringCount > 0) ...[
                      const SizedBox(width: 4),
                      Text(
                        '(${link.recurringCount}x)',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: theme.textTheme.bodySmall?.color,
                        ),
                      ),
                    ],
                  ],

                  const Spacer(),

                  // Date
                  Text(
                    _formatDate(link.createdAt),
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${months[date.month - 1]} ${date.day}';
  }
}
