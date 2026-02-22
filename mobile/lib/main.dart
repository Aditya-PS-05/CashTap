import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'config/router.dart';
import 'config/theme.dart';
import 'providers/auth_provider.dart';
import 'providers/payment_provider.dart';
import 'providers/wallet_provider.dart';
import 'services/connectivity_service.dart';
import 'services/notification_service.dart';
import 'widgets/offline_banner.dart';

void main() {
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();

    // Initialize Firebase (wrapped in try-catch for dev environments
    // where Firebase may not be configured)
    try {
      await Firebase.initializeApp();
    } catch (e) {
      debugPrint('Firebase initialization skipped or failed: $e');
    }

    // Initialize push notifications
    try {
      await NotificationService().initialize();
    } catch (e) {
      debugPrint('Notification service initialization failed: $e');
    }

    // Load saved theme mode from SharedPreferences
    final prefs = await SharedPreferences.getInstance();
    final savedThemeMode = prefs.getString('theme_mode');
    final initialThemeMode = _themeModeFromString(savedThemeMode);

    runApp(BchPayApp(initialThemeMode: initialThemeMode));
  }, (error, stackTrace) {
    debugPrint('Uncaught error: $error\n$stackTrace');
  });
}

ThemeMode _themeModeFromString(String? value) {
  switch (value) {
    case 'light':
      return ThemeMode.light;
    case 'dark':
      return ThemeMode.dark;
    case 'system':
    default:
      return ThemeMode.system;
  }
}

class BchPayApp extends StatefulWidget {
  final ThemeMode initialThemeMode;

  const BchPayApp({super.key, required this.initialThemeMode});

  /// Global ValueNotifier that the settings screen can update to change theme.
  static final ValueNotifier<ThemeMode> themeNotifier =
      ValueNotifier(ThemeMode.system);

  @override
  State<BchPayApp> createState() => _BchPayAppState();
}

class _BchPayAppState extends State<BchPayApp> {
  late final AuthProvider _authProvider;
  late final GoRouter _router;
  late final ConnectivityService _connectivityService;

  @override
  void initState() {
    super.initState();
    _authProvider = AuthProvider()..checkAuth();
    _router = createRouter(_authProvider);

    // Set initial theme mode on the global notifier
    BchPayApp.themeNotifier.value = widget.initialThemeMode;

    // Listen for SharedPreferences changes to theme_mode
    _listenForThemeChanges();

    // Start connectivity monitoring
    _connectivityService = ConnectivityService()..startMonitoring();

    // Set up foreground push notification handler
    _setupForegroundNotifications();
  }

  void _listenForThemeChanges() {
    BchPayApp.themeNotifier.addListener(_onThemeModeChanged);
  }

  void _onThemeModeChanged() async {
    // Persist the new theme mode to SharedPreferences
    final prefs = await SharedPreferences.getInstance();
    final mode = BchPayApp.themeNotifier.value;
    String modeString;
    switch (mode) {
      case ThemeMode.light:
        modeString = 'light';
      case ThemeMode.dark:
        modeString = 'dark';
      case ThemeMode.system:
        modeString = 'system';
    }
    await prefs.setString('theme_mode', modeString);
  }

  void _setupForegroundNotifications() {
    try {
      NotificationService().setupForegroundHandler((RemoteMessage message) {
        final title =
            message.notification?.title ?? 'BCH Pay';
        final body =
            message.notification?.body ?? 'You have a new notification.';

        // Show an overlay SnackBar-style notification
        final context = _router.routerDelegate.navigatorKey.currentContext;
        if (context != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    body,
                    style: const TextStyle(fontSize: 13),
                  ),
                ],
              ),
              backgroundColor: AppTheme.bchGreen,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              duration: const Duration(seconds: 4),
            ),
          );
        }
      });
    } catch (e) {
      debugPrint('Failed to set up foreground notification handler: $e');
    }
  }

  @override
  void dispose() {
    BchPayApp.themeNotifier.removeListener(_onThemeModeChanged);
    _connectivityService.stopMonitoring();
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: _authProvider),
        ChangeNotifierProvider(create: (_) => PaymentProvider()),
        ChangeNotifierProvider(create: (_) => WalletProvider()),
        ChangeNotifierProvider.value(value: _connectivityService),
      ],
      child: ValueListenableBuilder<ThemeMode>(
        valueListenable: BchPayApp.themeNotifier,
        builder: (context, themeMode, child) {
          return Directionality(
            textDirection: TextDirection.ltr,
            child: Column(
              children: [
                const OfflineBanner(),
                Expanded(
                  child: MaterialApp.router(
                    title: 'BCH Pay',
                    debugShowCheckedModeBanner: false,
                    theme: AppTheme.lightTheme,
                    darkTheme: AppTheme.darkTheme,
                    themeMode: themeMode,
                    routerConfig: _router,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
