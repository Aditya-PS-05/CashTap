import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Handles Firebase Cloud Messaging (FCM) push notifications.
class NotificationService {
  static final NotificationService _instance = NotificationService._();
  factory NotificationService() => _instance;
  NotificationService._();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  String? _fcmToken;
  String? get fcmToken => _fcmToken;

  /// Initialize FCM and request permissions.
  Future<void> initialize() async {
    try {
      // Request notification permissions
      final settings = await _messaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      debugPrint('FCM permission: ${settings.authorizationStatus}');

      if (settings.authorizationStatus == AuthorizationStatus.authorized ||
          settings.authorizationStatus == AuthorizationStatus.provisional) {
        // Get FCM token
        _fcmToken = await _messaging.getToken();
        debugPrint('FCM Token: $_fcmToken');

        if (_fcmToken != null) {
          await _storage.write(key: 'fcm_token', value: _fcmToken);
        }

        // Listen for token refresh
        _messaging.onTokenRefresh.listen((token) {
          _fcmToken = token;
          _storage.write(key: 'fcm_token', value: token);
          debugPrint('FCM Token refreshed: $token');
        });
      }
    } catch (e) {
      debugPrint('FCM initialization error: $e');
    }
  }

  /// Set up foreground message handler.
  void setupForegroundHandler(void Function(RemoteMessage) onMessage) {
    FirebaseMessaging.onMessage.listen(onMessage);
  }

  /// Set up background/terminated message handler.
  void setupBackgroundHandler() {
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageTap);
  }

  /// Check if app was opened from a notification.
  Future<RemoteMessage?> getInitialMessage() async {
    return _messaging.getInitialMessage();
  }

  void _handleMessageTap(RemoteMessage message) {
    debugPrint('Notification tapped: ${message.data}');
    // Navigation is handled by the app via callback
  }

  /// Subscribe to a topic for broadcast notifications.
  Future<void> subscribeToTopic(String topic) async {
    try {
      await _messaging.subscribeToTopic(topic);
    } catch (e) {
      debugPrint('Failed to subscribe to topic $topic: $e');
    }
  }

  /// Unsubscribe from a topic.
  Future<void> unsubscribeFromTopic(String topic) async {
    try {
      await _messaging.unsubscribeFromTopic(topic);
    } catch (e) {
      debugPrint('Failed to unsubscribe from topic $topic: $e');
    }
  }
}
