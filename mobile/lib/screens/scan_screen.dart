import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../config/theme.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../services/bch_service.dart';

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final MobileScannerController _scannerController = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
  );
  bool _torchEnabled = false;
  bool _hasScanned = false;
  bool _isPickingImage = false;

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

  /// Regex to extract a payment link slug from a CashTap URL.
  static final _paymentLinkPattern =
      RegExp(r'https?://[^/]+/pay/([A-Za-z0-9_-]+)');

  void _onBarcodeDetect(BarcodeCapture capture) {
    if (_hasScanned) return;

    final barcode = capture.barcodes.firstOrNull;
    if (barcode == null || barcode.rawValue == null) return;

    final value = barcode.rawValue!;

    // 1. Direct BCH address or BIP21 URI
    if (value.startsWith('bitcoincash:') ||
        value.startsWith('bchtest:') ||
        BchService.isValidBchAddress(value)) {
      setState(() => _hasScanned = true);
      HapticFeedback.mediumImpact();
      _showScannedResult(value);
      return;
    }

    // 2. CashTap payment link URL (e.g. https://cashtap.app/pay/SLUG)
    final match = _paymentLinkPattern.firstMatch(value);
    if (match != null) {
      final slug = match.group(1)!;
      setState(() => _hasScanned = true);
      HapticFeedback.mediumImpact();
      _resolvePaymentLink(slug);
    }
  }

  /// Fetch payment link details by slug and show the payment sheet.
  Future<void> _resolvePaymentLink(String slug) async {
    try {
      final pl = await ApiService().getPaymentLinkStatus(slug);

      if (!mounted) return;

      if (pl.paymentAddress.isEmpty) {
        _showSnackBar('Payment link has no address');
        setState(() => _hasScanned = false);
        return;
      }

      // Build a BIP21-style URI so _showScannedResult can parse it normally
      final uri = StringBuffer('bchtest:${pl.paymentAddress}');
      final params = <String>[];
      if (pl.amountBch > 0) params.add('amount=${pl.amountBch}');
      if (pl.memo.isNotEmpty) {
        params.add('message=${Uri.encodeComponent(pl.memo)}');
      }
      if (params.isNotEmpty) uri.write('?${params.join('&')}');

      _showScannedResult(uri.toString());
    } catch (e) {
      if (!mounted) return;
      _showSnackBar('Failed to load payment link');
      setState(() => _hasScanned = false);
    }
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), duration: const Duration(seconds: 2)),
    );
  }

  Future<void> _onGalleryPressed() async {
    if (_isPickingImage) return;

    setState(() {
      _isPickingImage = true;
    });

    try {
      final picker = ImagePicker();
      final pickedFile = await picker.pickImage(source: ImageSource.gallery);

      if (pickedFile == null) {
        // User cancelled the picker
        if (mounted) {
          setState(() {
            _isPickingImage = false;
          });
        }
        return;
      }

      final barcodeCapture =
          await _scannerController.analyzeImage(pickedFile.path);

      if (!mounted) return;

      if (barcodeCapture == null || barcodeCapture.barcodes.isEmpty) {
        setState(() {
          _isPickingImage = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No QR code found in the selected image'),
            duration: Duration(seconds: 2),
          ),
        );
        return;
      }

      final barcode = barcodeCapture.barcodes.first;
      final value = barcode.rawValue;

      if (value == null) {
        setState(() {
          _isPickingImage = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not read QR code data'),
            duration: Duration(seconds: 2),
          ),
        );
        return;
      }

      if (value.startsWith('bitcoincash:') ||
          value.startsWith('bchtest:') ||
          BchService.isValidBchAddress(value)) {
        setState(() {
          _hasScanned = true;
          _isPickingImage = false;
        });
        HapticFeedback.mediumImpact();
        _showScannedResult(value);
      } else {
        // Check for CashTap payment link URL
        final match = _paymentLinkPattern.firstMatch(value);
        if (match != null) {
          setState(() {
            _hasScanned = true;
            _isPickingImage = false;
          });
          HapticFeedback.mediumImpact();
          _resolvePaymentLink(match.group(1)!);
        } else {
          setState(() {
            _isPickingImage = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('QR code does not contain a valid BCH address'),
              duration: Duration(seconds: 2),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isPickingImage = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to process image: $e'),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    }
  }

  void _showScannedResult(String data) {
    final parsed = BchService.parsePaymentUri(data);
    final address = parsed['address'] ?? data;
    final amount = parsed['amount'];
    final message = parsed['message'];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        final theme = Theme.of(context);
        return Padding(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Handle bar
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: theme.dividerColor,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppTheme.bchGreen.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.qr_code_scanner,
                      color: AppTheme.bchGreen,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Text(
                    'Payment Request',
                    style: theme.textTheme.headlineSmall,
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Address
              Text('Address', style: theme.textTheme.labelMedium),
              const SizedBox(height: 4),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.cardTheme.color,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  address,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontFamily: 'monospace',
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Amount
              if (amount != null) ...[
                Text('Amount', style: theme.textTheme.labelMedium),
                const SizedBox(height: 4),
                Text(
                  '$amount BCH',
                  style: GoogleFonts.inter(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 14),
              ],

              // Message
              if (message != null) ...[
                Text('Message', style: theme.textTheme.labelMedium),
                const SizedBox(height: 4),
                Text(message, style: theme.textTheme.bodyMedium),
                const SizedBox(height: 14),
              ],

              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        setState(() => _hasScanned = false);
                      },
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pop(context);
                        final auth = context.read<AuthProvider>();
                        if (auth.isBuyer) {
                          // Navigate to send screen with pre-filled address/amount
                          context.push('/send', extra: {
                            'address': address,
                            if (amount != null) 'amount': double.tryParse(amount),
                          });
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Switch to Buyer mode to send BCH'),
                            ),
                          );
                        }
                        setState(() => _hasScanned = false);
                      },
                      child: const Text('Proceed'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    ).whenComplete(() {
      if (mounted) {
        setState(() => _hasScanned = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Stack(
      children: [
        // Camera
        MobileScanner(
          controller: _scannerController,
          onDetect: _onBarcodeDetect,
        ),

        // Overlay with scan area
        _buildScanOverlay(theme),

        // Top bar
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Scan QR Code',
                    style: GoogleFonts.inter(
                      fontSize: 20,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Gallery import button
                      IconButton(
                        icon: Icon(
                          Icons.photo_library_outlined,
                          color: _isPickingImage
                              ? Colors.white.withValues(alpha: 0.5)
                              : Colors.white,
                          size: 28,
                        ),
                        onPressed: _isPickingImage ? null : _onGalleryPressed,
                        tooltip: 'Import from gallery',
                      ),
                      const SizedBox(width: 4),
                      // Flashlight toggle
                      IconButton(
                        icon: Icon(
                          _torchEnabled ? Icons.flash_on : Icons.flash_off,
                          color: Colors.white,
                          size: 28,
                        ),
                        onPressed: () {
                          _scannerController.toggleTorch();
                          setState(() => _torchEnabled = !_torchEnabled);
                        },
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),

        // Bottom instruction
        Positioned(
          bottom: 120,
          left: 0,
          right: 0,
          child: Center(
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.black54,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                'Point camera at a BCH QR code',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildScanOverlay(ThemeData theme) {
    return CustomPaint(
      painter: _ScanOverlayPainter(),
      child: const SizedBox.expand(),
    );
  }
}

class _ScanOverlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final scanAreaSize = size.width * 0.7;
    final left = (size.width - scanAreaSize) / 2;
    final top = (size.height - scanAreaSize) / 2 - 40;
    final scanRect = Rect.fromLTWH(left, top, scanAreaSize, scanAreaSize);

    // Dim overlay
    final overlayPaint = Paint()..color = Colors.black.withValues(alpha: 0.5);
    canvas.drawPath(
      Path.combine(
        PathOperation.difference,
        Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height)),
        Path()
          ..addRRect(
              RRect.fromRectAndRadius(scanRect, const Radius.circular(16))),
      ),
      overlayPaint,
    );

    // Scan area border
    final borderPaint = Paint()
      ..color = AppTheme.bchGreen
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;

    canvas.drawRRect(
      RRect.fromRectAndRadius(scanRect, const Radius.circular(16)),
      borderPaint,
    );

    // Corner accents
    const cornerLength = 30.0;
    const cornerWidth = 4.0;
    final cornerPaint = Paint()
      ..color = AppTheme.bchGreen
      ..style = PaintingStyle.stroke
      ..strokeWidth = cornerWidth
      ..strokeCap = StrokeCap.round;

    // Top-left
    canvas.drawLine(
      Offset(left, top + cornerLength),
      Offset(left, top + 8),
      cornerPaint,
    );
    canvas.drawLine(
      Offset(left + cornerLength, top),
      Offset(left + 8, top),
      cornerPaint,
    );

    // Top-right
    canvas.drawLine(
      Offset(left + scanAreaSize, top + cornerLength),
      Offset(left + scanAreaSize, top + 8),
      cornerPaint,
    );
    canvas.drawLine(
      Offset(left + scanAreaSize - cornerLength, top),
      Offset(left + scanAreaSize - 8, top),
      cornerPaint,
    );

    // Bottom-left
    canvas.drawLine(
      Offset(left, top + scanAreaSize - cornerLength),
      Offset(left, top + scanAreaSize - 8),
      cornerPaint,
    );
    canvas.drawLine(
      Offset(left + cornerLength, top + scanAreaSize),
      Offset(left + 8, top + scanAreaSize),
      cornerPaint,
    );

    // Bottom-right
    canvas.drawLine(
      Offset(left + scanAreaSize, top + scanAreaSize - cornerLength),
      Offset(left + scanAreaSize, top + scanAreaSize - 8),
      cornerPaint,
    );
    canvas.drawLine(
      Offset(left + scanAreaSize - cornerLength, top + scanAreaSize),
      Offset(left + scanAreaSize - 8, top + scanAreaSize),
      cornerPaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
