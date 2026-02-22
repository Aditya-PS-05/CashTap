import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../config/theme.dart';
import '../providers/payment_provider.dart';

class PaymentStatusIndicator extends StatefulWidget {
  final PaymentListenStatus status;

  const PaymentStatusIndicator({super.key, required this.status});

  @override
  State<PaymentStatusIndicator> createState() =>
      _PaymentStatusIndicatorState();
}

class _PaymentStatusIndicatorState extends State<PaymentStatusIndicator>
    with TickerProviderStateMixin {
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  late AnimationController _checkmarkController;
  late Animation<double> _checkmarkScaleAnimation;

  @override
  void initState() {
    super.initState();

    // Pulse animation for waiting state
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _pulseAnimation = Tween<double>(begin: 0.8, end: 1.0).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    // Checkmark scale animation for confirmed state
    _checkmarkController = AnimationController(
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
        tween: Tween<double>(begin: 1.2, end: 1.0)
            .chain(CurveTween(curve: Curves.bounceOut)),
        weight: 40,
      ),
    ]).animate(_checkmarkController);

    if (widget.status == PaymentListenStatus.waiting) {
      _pulseController.repeat(reverse: true);
    }

    if (widget.status == PaymentListenStatus.confirmed) {
      _checkmarkController.forward();
    }
  }

  @override
  void didUpdateWidget(covariant PaymentStatusIndicator oldWidget) {
    super.didUpdateWidget(oldWidget);

    // Handle pulse controller for waiting state
    if (widget.status == PaymentListenStatus.waiting) {
      _pulseController.repeat(reverse: true);
    } else {
      _pulseController.stop();
      _pulseController.value = 1.0;
    }

    // Handle checkmark animation when status changes to confirmed
    if (widget.status == PaymentListenStatus.confirmed &&
        oldWidget.status != PaymentListenStatus.confirmed) {
      _checkmarkController.reset();
      _checkmarkController.forward();
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _checkmarkController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    switch (widget.status) {
      case PaymentListenStatus.idle:
        return const SizedBox.shrink();

      case PaymentListenStatus.waiting:
        return _buildWaiting();

      case PaymentListenStatus.detected:
        return _buildDetected();

      case PaymentListenStatus.confirmed:
        return _buildConfirmed();

      case PaymentListenStatus.timeout:
        return _buildTimeout();

      case PaymentListenStatus.error:
        return _buildError();
    }
  }

  Widget _buildWaiting() {
    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) {
        return Opacity(
          opacity: _pulseAnimation.value,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
            decoration: BoxDecoration(
              color: AppTheme.warningOrange.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppTheme.warningOrange.withValues(alpha: 0.3),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: AppTheme.warningOrange,
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  'Waiting for payment...',
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.warningOrange,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildDetected() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: BoxDecoration(
        color: AppTheme.pendingBlue.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppTheme.pendingBlue.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.check_circle_outline,
            color: AppTheme.pendingBlue,
            size: 22,
          ),
          const SizedBox(width: 12),
          Text(
            'Payment received!',
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppTheme.pendingBlue,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildConfirmed() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
      decoration: BoxDecoration(
        color: AppTheme.successGreen.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppTheme.successGreen.withValues(alpha: 0.3),
        ),
      ),
      child: Column(
        children: [
          AnimatedBuilder(
            animation: _checkmarkScaleAnimation,
            builder: (context, child) {
              return Transform.scale(
                scale: _checkmarkScaleAnimation.value,
                child: child,
              );
            },
            child: Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                color: AppTheme.successGreen,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check,
                color: Colors.white,
                size: 36,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Payment confirmed!',
            style: GoogleFonts.inter(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppTheme.successGreen,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeout() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: BoxDecoration(
        color: AppTheme.errorRed.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppTheme.errorRed.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.timer_off,
            color: AppTheme.errorRed,
            size: 22,
          ),
          const SizedBox(width: 12),
          Text(
            'Payment timed out',
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppTheme.errorRed,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: BoxDecoration(
        color: AppTheme.errorRed.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: AppTheme.errorRed.withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.error_outline,
            color: AppTheme.errorRed,
            size: 22,
          ),
          const SizedBox(width: 12),
          Text(
            'Something went wrong',
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: AppTheme.errorRed,
            ),
          ),
        ],
      ),
    );
  }
}
