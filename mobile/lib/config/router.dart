import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';
import '../screens/auth/connect_wallet_screen.dart';
import '../screens/auth/onboard_screen.dart';
import '../screens/home_screen.dart';
import '../screens/pos_screen.dart';
import '../screens/charge_screen.dart';
import '../screens/scan_screen.dart';
import '../screens/activity_screen.dart';
import '../screens/settings_screen.dart';
import '../screens/transaction_detail_screen.dart';
import '../screens/payment_links_screen.dart';
import '../screens/contracts_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

GoRouter createRouter(AuthProvider authProvider) {
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/',
    refreshListenable: authProvider,
    redirect: (context, state) {
      final isAuthenticated = authProvider.isAuthenticated;
      final isOnboarded = authProvider.isOnboarded;
      final currentPath = state.matchedLocation;

      // If not authenticated, redirect to auth screen
      if (!isAuthenticated) {
        if (currentPath == '/auth') return null;
        return '/auth';
      }

      // If authenticated but not onboarded, redirect to onboard
      if (!isOnboarded) {
        if (currentPath == '/onboard') return null;
        return '/onboard';
      }

      // If authenticated and onboarded, redirect away from auth/onboard
      if (currentPath == '/auth' || currentPath == '/onboard' || currentPath == '/') {
        return '/home';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        redirect: (_, __) => '/home',
      ),
      GoRoute(
        path: '/auth',
        builder: (context, state) => const ConnectWalletScreen(),
      ),
      GoRoute(
        path: '/onboard',
        builder: (context, state) => const OnboardScreen(),
      ),
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => _ScaffoldWithNavBar(child: child),
        routes: [
          GoRoute(
            path: '/home',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: HomeScreen(),
            ),
          ),
          GoRoute(
            path: '/pos',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: PosScreen(),
            ),
          ),
          GoRoute(
            path: '/scan',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ScanScreen(),
            ),
          ),
          GoRoute(
            path: '/activity',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ActivityScreen(),
            ),
          ),
          GoRoute(
            path: '/settings',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: SettingsScreen(),
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/pos/charge',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>? ?? {};
          return ChargeScreen(
            amountBch: extra['amountBch'] as double? ?? 0.0,
            amountUsd: extra['amountUsd'] as double? ?? 0.0,
            memo: extra['memo'] as String? ?? '',
            paymentAddress: extra['paymentAddress'] as String? ?? '',
            slug: extra['slug'] as String? ?? '',
          );
        },
      ),
      GoRoute(
        path: '/transaction/:id',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          return TransactionDetailScreen(transactionId: id);
        },
      ),
      GoRoute(
        path: '/payment-links',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const PaymentLinksScreen(),
      ),
      GoRoute(
        path: '/contracts',
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const ContractsScreen(),
      ),
    ],
  );
}

class _ScaffoldWithNavBar extends StatelessWidget {
  final Widget child;

  const _ScaffoldWithNavBar({required this.child});

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/home')) return 0;
    if (location.startsWith('/pos')) return 1;
    if (location.startsWith('/scan')) return 2;
    if (location.startsWith('/activity')) return 3;
    if (location.startsWith('/settings')) return 4;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final selectedIndex = _calculateSelectedIndex(context);

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: (index) {
          switch (index) {
            case 0:
              context.go('/home');
            case 1:
              context.go('/pos');
            case 2:
              context.go('/scan');
            case 3:
              context.go('/activity');
            case 4:
              context.go('/settings');
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.point_of_sale_outlined),
            selectedIcon: Icon(Icons.point_of_sale),
            label: 'POS',
          ),
          NavigationDestination(
            icon: Icon(Icons.qr_code_scanner_outlined),
            selectedIcon: Icon(Icons.qr_code_scanner),
            label: 'Scan',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long),
            label: 'Activity',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'Settings',
          ),
        ],
      ),
    );
  }
}
