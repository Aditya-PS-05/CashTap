import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class Numpad extends StatelessWidget {
  final void Function(String key) onKeyPressed;

  const Numpad({super.key, required this.onKeyPressed});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final buttonHeight = (constraints.maxHeight / 4).clamp(64.0, 80.0);

        return Column(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            _buildRow(['1', '2', '3'], buttonHeight, context),
            _buildRow(['4', '5', '6'], buttonHeight, context),
            _buildRow(['7', '8', '9'], buttonHeight, context),
            _buildRow(['.', '0', 'backspace'], buttonHeight, context),
          ],
        );
      },
    );
  }

  Widget _buildRow(List<String> keys, double height, BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: keys.map((key) => _buildKey(key, height, context)).toList(),
      ),
    );
  }

  Widget _buildKey(String key, double height, BuildContext context) {
    final theme = Theme.of(context);
    final isBackspace = key == 'backspace';

    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () => onKeyPressed(key),
            borderRadius: BorderRadius.circular(14),
            splashColor: theme.colorScheme.primary.withValues(alpha: 0.08),
            highlightColor: theme.colorScheme.primary.withValues(alpha: 0.04),
            child: Container(
              height: height,
              alignment: Alignment.center,
              child: isBackspace
                  ? Icon(
                      Icons.backspace_outlined,
                      size: 26,
                      color: theme.textTheme.bodyLarge?.color,
                    )
                  : Text(
                      key,
                      style: GoogleFonts.inter(
                        fontSize: 28,
                        fontWeight: FontWeight.w500,
                        color: theme.textTheme.bodyLarge?.color,
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
