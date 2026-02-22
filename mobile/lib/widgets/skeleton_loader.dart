import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

/// Shimmer skeleton loading widget for various content types.
class SkeletonLoader extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const SkeletonLoader({
    super.key,
    this.width = double.infinity,
    this.height = 16,
    this.borderRadius = 8,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Shimmer.fromColors(
      baseColor: isDark ? const Color(0xFF2A2D38) : const Color(0xFFE0E0E0),
      highlightColor: isDark ? const Color(0xFF3A3D48) : const Color(0xFFF5F5F5),
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}

/// Skeleton for a stat card.
class StatCardSkeleton extends StatelessWidget {
  const StatCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SkeletonLoader(width: 80, height: 12),
          SizedBox(height: 10),
          SkeletonLoader(width: 100, height: 24),
          SizedBox(height: 6),
          SkeletonLoader(width: 60, height: 12),
        ],
      ),
    );
  }
}

/// Skeleton for a transaction tile.
class TransactionTileSkeleton extends StatelessWidget {
  const TransactionTileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
      child: Row(
        children: [
          const SkeletonLoader(width: 42, height: 42, borderRadius: 21),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SkeletonLoader(width: 120, height: 14),
                const SizedBox(height: 6),
                const SkeletonLoader(width: 80, height: 12),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const SkeletonLoader(width: 70, height: 14),
              const SizedBox(height: 6),
              const SkeletonLoader(width: 50, height: 12),
            ],
          ),
        ],
      ),
    );
  }
}

/// Skeleton for the weekly chart.
class ChartSkeleton extends StatelessWidget {
  const ChartSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 200,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(7, (i) {
          final heights = [60.0, 90.0, 45.0, 120.0, 75.0, 100.0, 55.0];
          return SkeletonLoader(
            width: 24,
            height: heights[i],
            borderRadius: 6,
          );
        }),
      ),
    );
  }
}
