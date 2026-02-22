import '../config/constants.dart';

class BchService {
  BchService._();

  /// Convert satoshis to BCH
  static double satoshisToBch(int satoshis) {
    return satoshis / AppConstants.satoshisPerBch;
  }

  /// Convert BCH to satoshis
  static int bchToSatoshis(double bch) {
    return (bch * AppConstants.satoshisPerBch).round();
  }

  /// Format BCH amount with appropriate decimal places
  static String formatBchAmount(double bch, {int decimals = 8}) {
    if (bch == 0) return '0';

    String formatted = bch.toStringAsFixed(decimals);

    // Remove trailing zeros but keep at least 2 decimal places
    if (formatted.contains('.')) {
      while (formatted.endsWith('0') && !formatted.endsWith('.00')) {
        formatted = formatted.substring(0, formatted.length - 1);
      }
      // Ensure we have at least a couple decimal places for readability
      final parts = formatted.split('.');
      if (parts.length == 2 && parts[1].length < 2) {
        formatted = '${parts[0]}.${parts[1].padRight(2, '0')}';
      }
    }

    return formatted;
  }

  /// Format BCH amount with the BCH suffix
  static String formatBchWithUnit(double bch) {
    return '${formatBchAmount(bch)} BCH';
  }

  /// Format USD amount
  static String formatUsdAmount(double usd) {
    return '\$${usd.toStringAsFixed(2)}';
  }

  /// Generate a BIP21 payment URI
  static String generatePaymentUri({
    required String address,
    double? amount,
    String? message,
    String? label,
  }) {
    // Remove prefix if already present
    String cleanAddress = address;
    if (cleanAddress.startsWith(AppConstants.bchMainnetPrefix)) {
      cleanAddress = cleanAddress.substring(AppConstants.bchMainnetPrefix.length);
    }

    final uri = StringBuffer('${AppConstants.bchMainnetPrefix}$cleanAddress');
    final params = <String>[];

    if (amount != null && amount > 0) {
      params.add('amount=${formatBchAmount(amount)}');
    }
    if (message != null && message.isNotEmpty) {
      params.add('message=${Uri.encodeComponent(message)}');
    }
    if (label != null && label.isNotEmpty) {
      params.add('label=${Uri.encodeComponent(label)}');
    }

    if (params.isNotEmpty) {
      uri.write('?${params.join('&')}');
    }

    return uri.toString();
  }

  /// Parse a BIP21 payment URI
  static Map<String, String> parsePaymentUri(String uri) {
    final result = <String, String>{};

    String remaining = uri;

    // Remove scheme prefix
    if (remaining.startsWith('bitcoincash:')) {
      remaining = remaining.substring('bitcoincash:'.length);
    } else if (remaining.startsWith('bchtest:')) {
      remaining = remaining.substring('bchtest:'.length);
    }

    // Split address and params
    final questionMark = remaining.indexOf('?');
    if (questionMark == -1) {
      result['address'] = remaining;
    } else {
      result['address'] = remaining.substring(0, questionMark);
      final params = remaining.substring(questionMark + 1).split('&');
      for (final param in params) {
        final eq = param.indexOf('=');
        if (eq != -1) {
          final key = param.substring(0, eq);
          final value = Uri.decodeComponent(param.substring(eq + 1));
          result[key] = value;
        }
      }
    }

    return result;
  }

  /// Validate a BCH address (basic validation)
  static bool isValidBchAddress(String address) {
    // Remove prefix if present
    String cleanAddress = address;
    if (cleanAddress.startsWith(AppConstants.bchMainnetPrefix)) {
      cleanAddress = cleanAddress.substring(AppConstants.bchMainnetPrefix.length);
    } else if (cleanAddress.startsWith(AppConstants.bchTestnetPrefix)) {
      cleanAddress = cleanAddress.substring(AppConstants.bchTestnetPrefix.length);
    }

    // CashAddr format: starts with q or p, 42 characters
    if (cleanAddress.startsWith('q') || cleanAddress.startsWith('p')) {
      return cleanAddress.length == 42;
    }

    // Legacy format: starts with 1 or 3, 25-34 characters
    if (cleanAddress.startsWith('1') || cleanAddress.startsWith('3')) {
      return cleanAddress.length >= 25 && cleanAddress.length <= 34;
    }

    return false;
  }

  /// Shorten an address for display
  static String shortenAddress(String address, {int prefixLen = 14, int suffixLen = 6}) {
    // Remove scheme prefix for shortening
    String display = address;
    String prefix = '';
    if (display.startsWith(AppConstants.bchMainnetPrefix)) {
      prefix = AppConstants.bchMainnetPrefix;
      display = display.substring(prefix.length);
    }

    if (display.length <= prefixLen + suffixLen + 3) return address;

    return '$prefix${display.substring(0, prefixLen)}...${display.substring(display.length - suffixLen)}';
  }

  /// Convert USD to BCH at given exchange rate
  static double usdToBch(double usd, double bchPriceUsd) {
    if (bchPriceUsd <= 0) return 0;
    return usd / bchPriceUsd;
  }

  /// Convert BCH to USD at given exchange rate
  static double bchToUsd(double bch, double bchPriceUsd) {
    return bch * bchPriceUsd;
  }
}
