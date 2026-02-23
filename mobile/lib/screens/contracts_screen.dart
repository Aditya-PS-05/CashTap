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

  // Split Payment form
  final _sp1Controller = TextEditingController();
  final _sp2Controller = TextEditingController();
  final _spPercent1Controller = TextEditingController(text: '50');
  final _spPercent2Controller = TextEditingController(text: '50');

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
    _fetchContracts();
  }

  @override
  void dispose() {
    _tabController.dispose();
    _sp1Controller.dispose();
    _sp2Controller.dispose();
    _spPercent1Controller.dispose();
    _spPercent2Controller.dispose();
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
    final p1 = int.tryParse(_spPercent1Controller.text) ?? 0;
    final p2 = int.tryParse(_spPercent2Controller.text) ?? 0;
    if (_sp1Controller.text.length != 40 || _sp2Controller.text.length != 40) {
      _snack('PKH must be a 40-character hex string', isError: true);
      return;
    }
    if (p1 + p2 != 100) {
      _snack('Percentages must add up to 100', isError: true);
      return;
    }
    setState(() => _creating = true);
    try {
      await _apiService.createSplitPayment(
        recipient1Pkh: _sp1Controller.text,
        recipient2Pkh: _sp2Controller.text,
        split1Percent: p1,
        split2Percent: p2,
      );
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
                      height: 320,
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

  Widget _buildSplitPaymentForm(ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          TextField(
            controller: _sp1Controller,
            style: const TextStyle(fontSize: 12, fontFamily: 'monospace'),
            decoration: const InputDecoration(
              labelText: 'Recipient 1 PKH (hex)',
              isDense: true,
            ),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _spPercent1Controller,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Split %',
                    isDense: true,
                  ),
                  onChanged: (v) {
                    final p = int.tryParse(v) ?? 50;
                    _spPercent2Controller.text = '${100 - p}';
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _sp2Controller,
                  style:
                      const TextStyle(fontSize: 12, fontFamily: 'monospace'),
                  decoration: const InputDecoration(
                    labelText: 'Recipient 2 PKH',
                    isDense: true,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              SizedBox(
                width: 60,
                child: TextField(
                  controller: _spPercent2Controller,
                  readOnly: true,
                  decoration: const InputDecoration(
                    labelText: '%',
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
