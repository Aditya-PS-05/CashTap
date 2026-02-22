import 'dart:async';

import 'package:confetti/confetti.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

import '../config/theme.dart';
import '../providers/payment_provider.dart';
import '../services/bch_service.dart';
import '../widgets/payment_status_indicator.dart';

class ChargeScreen extends StatefulWidget {
  final double amountBch;
  final double amountUsd;
  final String memo;
  final String paymentAddress;
  final String slug;

  const ChargeScreen({
    super.key,
    required this.amountBch,
    required this.amountUsd,
    required this.memo,
    required this.paymentAddress,
    required this.slug,
  });

  @override
  State<ChargeScreen> createState() => _ChargeScreenState();
}

class _ChargeScreenState extends State<ChargeScreen>
    with SingleTickerProviderStateMixin {
  late final ConfettiController _confettiController;
  late String _paymentUri;

  // Timer/countdown
  static const int _expirationSeconds = 15 * 60; // 15 minutes
  late Timer _countdownTimer;
  int _remainingSeconds = _expirationSeconds;
  bool _timerExpired = false;

  // Checkmark animation
  late final AnimationController _checkmarkAnimController;
  late final Animation<double> _checkmarkScaleAnimation;
  bool _hasPlayedConfirmedEffects = false;

  @override
  void initState() {
    super.initState();
    _confettiController =
        ConfettiController(duration: const Duration(seconds: 3));

    _paymentUri = BchService.generatePaymentUri(
      address: widget.paymentAddress,
      amount: widget.amountBch,
      message: widget.memo.isNotEmpty ? widget.memo : null,
    );

    // Initialize countdown timer
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), _onTimerTick);

    // Initialize checkmark animation controller
    _checkmarkAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _checkmarkScaleAnimation = TweenSequence<double>([
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.0, end: 1.2)
            .chain(CurveTween(curve: Curves.easeOut)),
        weight: 60,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 1.2, end: 0.9)
            .chain(CurveTween(curve: Curves.easeInOut)),
        weight: 20,
      ),
      TweenSequenceItem(
        tween: Tween<double>(begin: 0.9, end: 1.0)
            .chain(CurveTween(curve: Curves.easeInOut)),
        weight: 20,
      ),
    ]).animate(_checkmarkAnimController);

    // Start listening for payment
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PaymentProvider>().listenForPayment(widget.slug);
    });
  }

  void _onTimerTick(Timer timer) {
    if (_remainingSeconds <= 0) {
      timer.cancel();
      if (!_timerExpired) {
        setState(() {
          _timerExpired = true;
        });
        // Set status to timeout via provider if still waiting
        final status = context.read<PaymentProvider>().listenStatus;
        if (status == PaymentListenStatus.waiting) {
          context.read<PaymentProvider>().stopListening();
          // The provider sets status to idle on stopListening, but we want timeout.
          // We handle timeout display via _timerExpired flag in the UI.
        }
      }
      return;
    }

    setState(() {
      _remainingSeconds--;
    });
  }

  String _formatCountdown() {
    final minutes = _remainingSeconds ~/ 60;
    final seconds = _remainingSeconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  void _playConfirmedEffects() {
    if (_hasPlayedConfirmedEffects) return;
    _hasPlayedConfirmedEffects = true;

    // Play confetti
    _confettiController.play();

    // Play checkmark bounce animation
    _checkmarkAnimController.forward();

    // Stop the countdown timer since payment is confirmed
    _countdownTimer.cancel();

    // Play system sound
    SystemSound.play(SystemSoundType.click);

    // Distinctive haptic pattern: medium impact, wait 100ms, heavy impact
    HapticFeedback.mediumImpact();
    Future.delayed(const Duration(milliseconds: 100), () {
      HapticFeedback.heavyImpact();
    });
  }

  @override
  void dispose() {
    _confettiController.dispose();
    _countdownTimer.cancel();
    _checkmarkAnimController.dispose();
    context.read<PaymentProvider>().stopListening();
    super.dispose();
  }

  void _onSharePressed() {
    Share.share(
        'Pay me ${BchService.formatUsdAmount(widget.amountUsd)} in Bitcoin Cash:\n$_paymentUri');
  }

  void _onCopyPressed() {
    Clipboard.setData(ClipboardData(text: _paymentUri));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Payment link copied!'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final payments = context.watch<PaymentProvider>();
    final status = payments.listenStatus;

    // Determine effective status: if our local timer expired and provider is
    // still in waiting/idle, treat as timeout.
    final effectiveStatus = (_timerExpired &&
            (status == PaymentListenStatus.waiting ||
                status == PaymentListenStatus.idle))
        ? PaymentListenStatus.timeout
        : status;

    // Fire confirmed effects when payment confirmed
    if (effectiveStatus == PaymentListenStatus.confirmed) {
      _playConfirmedEffects();
    } else if (effectiveStatus == PaymentListenStatus.detected) {
      HapticFeedback.mediumImpact();
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Charge'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Stack(
        alignment: Alignment.topCenter,
        children: [
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Column(
                children: [
                  const SizedBox(height: 16),

                  // Amount display
                  Text(
                    BchService.formatUsdAmount(widget.amountUsd),
                    style: GoogleFonts.inter(
                      fontSize: 36,
                      fontWeight: FontWeight.w700,
                      color: theme.textTheme.displayLarge?.color,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    BchService.formatBchWithUnit(widget.amountBch),
                    style: theme.textTheme.bodyLarge?.copyWith(
                      color: theme.textTheme.bodySmall?.color,
                    ),
                  ),
                  if (widget.memo.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      widget.memo,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.textTheme.bodySmall?.color,
                        fontStyle: FontStyle.italic,
                      ),
                    ),
                  ],
                  const SizedBox(height: 28),

                  // QR Code (hide when confirmed, show animated checkmark instead)
                  if (effectiveStatus != PaymentListenStatus.confirmed)
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.08),
                            blurRadius: 20,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: QrImageView(
                        data: _paymentUri,
                        version: QrVersions.auto,
                        size: 240,
                        eyeStyle: const QrEyeStyle(
                          eyeShape: QrEyeShape.square,
                          color: Color(0xFF1A1C25),
                        ),
                        dataModuleStyle: const QrDataModuleStyle(
                          dataModuleShape: QrDataModuleShape.square,
                          color: Color(0xFF1A1C25),
                        ),
                        embeddedImage: null,
                      ),
                    ),

                  // Animated green checkmark when confirmed
                  if (effectiveStatus == PaymentListenStatus.confirmed)
                    AnimatedBuilder(
                      animation: _checkmarkScaleAnimation,
                      builder: (context, child) {
                        return Transform.scale(
                          scale: _checkmarkScaleAnimation.value,
                          child: child,
                        );
                      },
                      child: Container(
                        width: 120,
                        height: 120,
                        decoration: const BoxDecoration(
                          color: AppTheme.successGreen,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Color(0x4D2ECC71),
                              blurRadius: 24,
                              offset: Offset(0, 8),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.check,
                          color: Colors.white,
                          size: 64,
                        ),
                      ),
                    ),

                  // Countdown timer (show when waiting or detected, not when confirmed/timeout)
                  if (effectiveStatus == PaymentListenStatus.waiting ||
                      effectiveStatus == PaymentListenStatus.detected) ...[
                    const SizedBox(height: 14),
                    Text(
                      'Expires in ${_formatCountdown()}',
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: _remainingSeconds < 120
                            ? AppTheme.warningOrange
                            : theme.textTheme.bodySmall?.color,
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),

                  // Payment status indicator
                  PaymentStatusIndicator(status: effectiveStatus),
                  const SizedBox(height: 24),

                  // Action buttons (hide when confirmed)
                  if (effectiveStatus != PaymentListenStatus.confirmed) ...[
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _onSharePressed,
                            icon: const Icon(Icons.share, size: 20),
                            label: const Text('Share'),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size(0, 48),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _onCopyPressed,
                            icon: const Icon(Icons.copy, size: 20),
                            label: const Text('Copy Link'),
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size(0, 48),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Address display
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: theme.cardTheme.color,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.account_balance_wallet_outlined,
                            size: 18,
                            color: AppTheme.bchGreen,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              widget.paymentAddress,
                              style: theme.textTheme.bodySmall?.copyWith(
                                fontFamily: 'monospace',
                                fontSize: 11,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.copy, size: 16),
                            onPressed: () {
                              Clipboard.setData(
                                ClipboardData(text: widget.paymentAddress),
                              );
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Address copied!'),
                                  duration: Duration(seconds: 1),
                                ),
                              );
                            },
                            visualDensity: VisualDensity.compact,
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Done button (show only when confirmed)
                  if (effectiveStatus == PaymentListenStatus.confirmed) ...[
                    const SizedBox(height: 32),
                    ElevatedButton(
                      onPressed: () => Navigator.of(context).pop(),
                      child: const Text('Done'),
                    ),
                  ],

                  // Simulate button (for demo)
                  const SizedBox(height: 24),
                  if (effectiveStatus == PaymentListenStatus.waiting)
                    TextButton(
                      onPressed: () {
                        context
                            .read<PaymentProvider>()
                            .simulatePaymentReceived();
                      },
                      child: Text(
                        'Simulate Payment (Demo)',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.textTheme.bodySmall?.color
                              ?.withValues(alpha: 0.5),
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),

                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),

          // Confetti overlay
          ConfettiWidget(
            confettiController: _confettiController,
            blastDirectionality: BlastDirectionality.explosive,
            shouldLoop: false,
            colors: const [
              AppTheme.bchGreen,
              AppTheme.bchGreenLight,
              AppTheme.successGreen,
              Colors.amber,
              Colors.white,
            ],
            numberOfParticles: 30,
          ),
        ],
      ),
    );
  }
}
