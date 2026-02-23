import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/theme.dart';
import '../models/contract_instance.dart';
import '../services/api_service.dart';

class ContractsScreen extends StatefulWidget {
  const ContractsScreen({super.key});

  @override
  State<ContractsScreen> createState() => _ContractsScreenState();
}

class _ContractsScreenState extends State<ContractsScreen>
    with SingleTickerProviderStateMixin {
  final ApiService _apiService = ApiService();
  List<ContractInstance> _contracts = [];
  bool _isLoading = true;
  late TabController _tabController;

  // Split Payment form - dynamic N-recipient list
  final List<TextEditingController> _spPkhControllers = [];
  final List<TextEditingController> _spPercentControllers = [];
  final List<TextEditingController> _spLabelControllers = [];

  // Escrow form
  final _escBuyerController = TextEditingController();
  final _escSellerController = TextEditingController();
  final _escArbiterController = TextEditingController();
  final _escTimeoutController = TextEditingController();

  // Savings Vault form
  final _svOwnerController = TextEditingController();
  final _svLocktimeController = TextEditingController();

  bool _creating = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    // Initialize with 2 recipients by default
    _addRecipient(initialPercent: '50');
    _addRecipient(initialPercent: '50');
    _fetchContracts();
  }

  void _addRecipient({String initialPercent = '0'}) {
    if (_spPkhControllers.length >= 10) return;
    setState(() {
      _spPkhControllers.add(TextEditingController());
      _spPercentControllers.add(TextEditingController(text: initialPercent));
      _spLabelControllers.add(TextEditingController());
    });
  }

  void _removeRecipient(int index) {
    if (_spPkhControllers.length <= 2) return;
    setState(() {
      _spPkhControllers[index].dispose();
      _spPercentControllers[index].dispose();
      _spLabelControllers[index].dispose();
      _spPkhControllers.removeAt(index);
      _spPercentControllers.removeAt(index);
      _spLabelControllers.removeAt(index);
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    for (final c in _spPkhControllers) {
      c.dispose();
    }
    for (final c in _spPercentControllers) {
      c.dispose();
    }
    for (final c in _spLabelControllers) {
      c.dispose();
    }
    _escBuyerController.dispose();
    _escSellerController.dispose();
    _escArbiterController.dispose();
    _escTimeoutController.dispose();
    _svOwnerController.dispose();
    _svLocktimeController.dispose();
    super.dispose();
  }

  Future<void> _fetchContracts() async {
    setState(() => _isLoading = true);
    try {
      _contracts = await _apiService.getContracts();
    } catch (e) {
      debugPrint('Failed to fetch contracts: $e');
    }
    if (mounted) setState(() => _isLoading = false);
  }

  void _snack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? AppTheme.errorRed : null,
      ),
    );
  }

  Future<void> _createSplitPayment() async {
    // Validate all PKH fields
    for (int i = 0; i < _spPkhControllers.length; i++) {
      if (_spPkhControllers[i].text.length != 40) {
        _snack('Recipient ${i + 1} PKH must be a 40-character hex string',
            isError: true);
        return;
      }
    }

    // Validate percentages sum to 100
    int totalPercent = 0;
    for (int i = 0; i < _spPercentControllers.length; i++) {
      final p = int.tryParse(_spPercentControllers[i].text) ?? 0;
      if (p <= 0) {
        _snack('Recipient ${i + 1} percentage must be a positive integer',
            isError: true);
        return;
      }
      totalPercent += p;
    }
    if (totalPercent != 100) {
      _snack('Percentages must add up to 100 (currently $totalPercent)',
          isError: true);
      return;
    }

    // Build recipients list
    final recipients = <Map<String, dynamic>>[];
    for (int i = 0; i < _spPkhControllers.length; i++) {
      final entry = <String, dynamic>{
        'pkh': _spPkhControllers[i].text,
        'percent': int.parse(_spPercentControllers[i].text),
      };
      if (_spLabelControllers[i].text.isNotEmpty) {
        entry['label'] = _spLabelControllers[i].text;
      }
      recipients.add(entry);
    }

    setState(() => _creating = true);
    try {
      await _apiService.createMultiSplitPayment(recipients: recipients);
      _snack('Split payment contract created!');
      _fetchContracts();
    } catch (e) {
      _snack('$e', isError: true);
    }
    if (mounted) setState(() => _creating = false);
  }

  Future<void> _createEscrow() async {
    if (_escBuyerController.text.length != 40 ||
        _escSellerController.text.length != 40 ||
        _escArbiterController.text.length != 40) {
      _snack('All PKH fields must be 40-character hex strings', isError: true);
      return;
    }
    final timeout = int.tryParse(_escTimeoutController.text);
    if (timeout == null || timeout <= 0) {
      _snack('Timeout must be a positive integer', isError: true);
      return;
    }
    setState(() => _creating = true);
    try {
      await _apiService.createEscrow(
        buyerPkh: _escBuyerController.text,
        sellerPkh: _escSellerController.text,
        arbiterPkh: _escArbiterController.text,
        timeout: timeout,
      );
      _snack('Escrow contract created!');
      _fetchContracts();
    } catch (e) {
      _snack('$e', isError: true);
    }
    if (mounted) setState(() => _creating = false);
  }

  Future<void> _createSavingsVault() async {
    if (_svOwnerController.text.length != 40) {
      _snack('Owner PKH must be a 40-character hex string', isError: true);
      return;
    }
    final locktime = int.tryParse(_svLocktimeController.text);
    if (locktime == null || locktime <= 0) {
      _snack('Locktime must be a positive integer', isError: true);
      return;
    }
    setState(() => _creating = true);
    try {
      await _apiService.createSavingsVault(
        ownerPkh: _svOwnerController.text,
        locktime: locktime,
      );
      _snack('Savings vault created!');
      _fetchContracts();
    } catch (e) {
      _snack('$e', isError: true);
    }
    if (mounted) setState(() => _creating = false);
  }

  Future<void> _markCompleted(ContractInstance contract) async {
    try {
      await _apiService.updateContractStatus(contract.id, 'COMPLETED');
      _snack('Contract marked as completed');
      _fetchContracts();
    } catch (e) {
      _snack('$e', isError: true);
    }
  }

  Future<void> _releaseEscrow(ContractInstance contract) async {
    try {
      await _apiService.releaseEscrow(contract.id);
      _snack('Escrow released successfully');
      _fetchContracts();
    } catch (e) {
      _snack('$e', isError: true);
    }
  }

  Future<void> _refundEscrow(ContractInstance contract) async {
    try {
      await _apiService.refundEscrow(contract.id);
      _snack('Escrow refunded successfully');
      _fetchContracts();
    } catch (e) {
      _snack('$e', isError: true);
    }
  }

  Color _typeColor(ContractType type) {
    switch (type) {
      case ContractType.escrow:
        return Colors.blue;
      case ContractType.splitPayment:
        return Colors.purple;
      case ContractType.savingsVault:
        return Colors.amber.shade700;
    }
  }

  Color _statusColor(ContractStatus status) {
    switch (status) {
      case ContractStatus.active:
        return AppTheme.successGreen;
      case ContractStatus.funded:
        return AppTheme.pendingBlue;
      case ContractStatus.released:
        return Colors.teal;
      case ContractStatus.refunded:
        return Colors.deepOrange;
      case ContractStatus.disputed:
        return AppTheme.errorRed;
      case ContractStatus.completed:
        return Colors.blueGrey;
      case ContractStatus.expired:
        return AppTheme.warningOrange;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final activeCount =
        _contracts.where((c) => c.status == ContractStatus.active).length;
    final splitCount =
        _contracts.where((c) => c.type == ContractType.splitPayment).length;
    final escrowCount =
        _contracts.where((c) => c.type == ContractType.escrow).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Smart Contracts'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchContracts,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchContracts,
        color: AppTheme.bchGreen,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Stats row
              Row(
                children: [
                  _buildStatChip(theme, '$activeCount', 'Active',
                      Icons.code, AppTheme.bchGreen),
                  const SizedBox(width: 8),
                  _buildStatChip(theme, '$splitCount', 'Split',
                      Icons.call_split, Colors.purple),
                  const SizedBox(width: 8),
                  _buildStatChip(theme, '$escrowCount', 'Escrow',
                      Icons.shield_outlined, Colors.blue),
                ],
              ),
              const SizedBox(height: 20),

              // Create Contract section
              Text('Create Contract', style: theme.textTheme.titleLarge),
              const SizedBox(height: 12),
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
                      tabs: const [
                        Tab(text: 'Split'),
                        Tab(text: 'Escrow'),
                        Tab(text: 'Vault'),
                      ],
                    ),
                    SizedBox(
                      height: 400,
                      child: TabBarView(
                        controller: _tabController,
                        children: [
                          _buildSplitPaymentForm(theme),
                          _buildEscrowForm(theme),
                          _buildSavingsVaultForm(theme),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Contracts list
              Text('Contract Instances', style: theme.textTheme.titleLarge),
              const SizedBox(height: 12),
              if (_isLoading)
                const Center(
                    child: Padding(
                  padding: EdgeInsets.all(32),
                  child: CircularProgressIndicator(),
                ))
              else if (_contracts.isEmpty)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: theme.cardTheme.color,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      Icon(Icons.code_off,
                          size: 48, color: theme.disabledColor),
                      const SizedBox(height: 12),
                      Text('No contracts yet',
                          style: theme.textTheme.bodyLarge),
                    ],
                  ),
                )
              else
                ...List.generate(_contracts.length, (i) {
                  return _buildContractCard(theme, _contracts[i]);
                }),

              const SizedBox(height: 80),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatChip(
      ThemeData theme, String value, String label, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    style: GoogleFonts.inter(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: color,
                    )),
                Text(label,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: theme.textTheme.bodySmall?.color,
                    )),
              ],
            ),
          ],
        ),
      ),
    );
  }

  int get _splitPercentSum {
    int sum = 0;
    for (final c in _spPercentControllers) {
      sum += int.tryParse(c.text) ?? 0;
    }
    return sum;
  }

  Widget _buildSplitPaymentForm(ThemeData theme) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Recipient list
          ...List.generate(_spPkhControllers.length, (i) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        'Recipient ${i + 1}',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: theme.textTheme.bodySmall?.color,
                        ),
                      ),
                      const Spacer(),
                      if (_spPkhControllers.length > 2)
                        InkWell(
                          onTap: () => _removeRecipient(i),
                          borderRadius: BorderRadius.circular(4),
                          child: Padding(
                            padding: const EdgeInsets.all(2),
                            child: Icon(Icons.remove_circle_outline,
                                size: 18, color: AppTheme.errorRed),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: TextField(
                          controller: _spPkhControllers[i],
                          style: const TextStyle(
                              fontSize: 12, fontFamily: 'monospace'),
                          decoration: const InputDecoration(
                            labelText: 'PKH (hex)',
                            isDense: true,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      SizedBox(
                        width: 56,
                        child: TextField(
                          controller: _spPercentControllers[i],
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: '%',
                            isDense: true,
                          ),
                          onChanged: (_) => setState(() {}),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 2,
                        child: TextField(
                          controller: _spLabelControllers[i],
                          style: const TextStyle(fontSize: 12),
                          decoration: const InputDecoration(
                            labelText: 'Label',
                            isDense: true,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),

          // Percentage sum indicator and add button
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                if (_spPkhControllers.length < 10)
                  TextButton.icon(
                    onPressed: () => _addRecipient(),
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Add Recipient'),
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.purple,
                      textStyle: GoogleFonts.inter(fontSize: 12),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                    ),
                  )
                else
                  const SizedBox.shrink(),
                Text(
                  'Total: $_splitPercentSum%',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: _splitPercentSum == 100
                        ? AppTheme.successGreen
                        : AppTheme.errorRed,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Create button
          SizedBox(
            width: double.infinity,
            height: 46,
            child: ElevatedButton.icon(
              onPressed: _creating ? null : _createSplitPayment,
              icon: _creating
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child:
                          CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.call_split, size: 18),
              label: const Text('Create Split Payment'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.purple,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEscrowForm(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          TextField(
            controller: _escBuyerController,
            style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
            decoration: const InputDecoration(
              labelText: 'Buyer PKH (hex)',
              isDense: true,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _escSellerController,
            style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
            decoration: const InputDecoration(
              labelText: 'Seller PKH (hex)',
              isDense: true,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: TextField(
                  controller: _escArbiterController,
                  style:
                      const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                  decoration: const InputDecoration(
                    labelText: 'Arbiter PKH',
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _escTimeoutController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Timeout',
                    isDense: true,
                  ),
                ),
              ),
            ],
          ),
          const Spacer(),
          SizedBox(
            width: double.infinity,
            height: 46,
            child: ElevatedButton.icon(
              onPressed: _creating ? null : _createEscrow,
              icon: _creating
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child:
                          CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.shield_outlined, size: 18),
              label: const Text('Create Escrow'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSavingsVaultForm(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          TextField(
            controller: _svOwnerController,
            style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
            decoration: const InputDecoration(
              labelText: 'Owner PKH (hex)',
              isDense: true,
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _svLocktimeController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Locktime (block height)',
              isDense: true,
            ),
          ),
          const Spacer(),
          SizedBox(
            width: double.infinity,
            height: 46,
            child: ElevatedButton.icon(
              onPressed: _creating ? null : _createSavingsVault,
              icon: _creating
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child:
                          CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.savings_outlined, size: 18),
              label: const Text('Create Vault'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.amber.shade700,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContractCard(ThemeData theme, ContractInstance contract) {
    final isEscrow = contract.type == ContractType.escrow;
    final canActOnEscrow = isEscrow &&
        (contract.status == ContractStatus.active ||
            contract.status == ContractStatus.funded);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Type + Status row
            Row(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: _typeColor(contract.type).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    contract.type.displayName,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: _typeColor(contract.type),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color:
                        _statusColor(contract.status).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    contract.status.displayName,
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: _statusColor(contract.status),
                    ),
                  ),
                ),
                const Spacer(),
                Text(
                  _formatDate(contract.createdAt),
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Address
            Text(
              contract.shortAddress,
              style: TextStyle(
                fontSize: 12,
                fontFamily: 'monospace',
                color: theme.textTheme.bodySmall?.color,
              ),
            ),
            const SizedBox(height: 10),

            // Actions row
            Row(
              children: [
                if (contract.status == ContractStatus.active)
                  _actionButton(
                    icon: Icons.check_circle_outline,
                    label: 'Complete',
                    color: AppTheme.successGreen,
                    onTap: () => _markCompleted(contract),
                  ),
                _actionButton(
                  icon: Icons.copy,
                  label: 'Copy',
                  color: theme.iconTheme.color ?? Colors.grey,
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: contract.address));
                    _snack('Address copied!');
                  },
                ),
                _actionButton(
                  icon: Icons.open_in_new,
                  label: 'Explorer',
                  color: AppTheme.pendingBlue,
                  onTap: () {
                    launchUrl(
                      Uri.parse(
                          'https://chipnet.chaingraph.cash/address/${contract.address}'),
                      mode: LaunchMode.externalApplication,
                    );
                  },
                ),
              ],
            ),

            // Escrow action buttons
            if (canActOnEscrow) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  _actionButton(
                    icon: Icons.lock_open,
                    label: 'Release',
                    color: AppTheme.successGreen,
                    onTap: () => _releaseEscrow(contract),
                  ),
                  _actionButton(
                    icon: Icons.undo,
                    label: 'Refund',
                    color: AppTheme.warningOrange,
                    onTap: () => _refundEscrow(contract),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _actionButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            border: Border.all(color: color.withValues(alpha: 0.3)),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 4),
              Text(label,
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: color,
                  )),
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
