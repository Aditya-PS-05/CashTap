class AppConstants {
  AppConstants._();

  // API
  static const String apiBaseUrl = 'https://bch-pay-api-production.up.railway.app';
  static const String wsBaseUrl = 'wss://bch-pay-api-production.up.railway.app/ws';

  // BCH Network
  static const String bchMainnetPrefix = 'bitcoincash:';
  static const String bchTestnetPrefix = 'bchtest:';
  static const String blockExplorerUrl = 'https://blockchair.com/bitcoin-cash/transaction';

  // Satoshi conversion
  static const int satoshisPerBch = 100000000;
  static const double bchPerSatoshi = 1.0 / satoshisPerBch;

  // App
  static const String appName = 'BCH Pay';
  static const String appVersion = '1.0.0';
  static const int defaultConfirmations = 0; // 0-conf by default
  static const double defaultMinimumAmount = 0.0001; // minimum BCH amount

  // Storage keys
  static const String jwtTokenKey = 'jwt_token';
  static const String merchantIdKey = 'merchant_id';
  static const String walletAddressKey = 'wallet_address';
  static const String seedPhraseKey = 'seed_phrase';
  static const String onboardedKey = 'onboarded';
  static const String themeModeKey = 'theme_mode';
  static const String bchAcceptedKey = 'bch_accepted';
  static const String cashTokenAcceptedKey = 'cashtoken_accepted';
  static const String minimumAmountKey = 'minimum_amount';
  static const String loyaltyEnabledKey = 'loyalty_enabled';
  static const String loyaltyTokenNameKey = 'loyalty_token_name';
  static const String loyaltyTokenSymbolKey = 'loyalty_token_symbol';
  static const String loyaltyRewardRateKey = 'loyalty_reward_rate';
  static const String pushPaymentReceivedKey = 'push_payment_received';
  static const String pushPaymentConfirmedKey = 'push_payment_confirmed';
  static const String pushInvoicePaidKey = 'push_invoice_paid';
  static const String largePaymentThresholdKey = 'large_payment_threshold';
  static const String webhookUrlKey = 'webhook_url';
  static const String soundEnabledKey = 'sound_enabled';
  static const String cachedTransactionsKey = 'cached_transactions';

  // Payment
  static const Duration paymentPollInterval = Duration(seconds: 3);
  static const Duration paymentTimeout = Duration(minutes: 15);

  // Pagination
  static const int transactionsPageSize = 20;

  // External wallet links
  static const String paytacaDeepLink = 'paytaca://';
  static const String paytacaPlayStoreUrl = 'https://play.google.com/store/apps/details?id=com.paytaca.app';
}
