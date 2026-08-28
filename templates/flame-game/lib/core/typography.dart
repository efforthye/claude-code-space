import 'dart:ui';

import 'package:flame/text.dart';

/// Every piece of type in the game comes from here.
///
/// Scenes asked for their own TextStyle before this existed, which meant the
/// font name, the shadow recipe and the palette were copied into a dozen places
/// and drifted. Changing the typeface is now one line rather than a search.
class AppText {
  const AppText._();

  /// Body copy. Named once so a licence problem or a change of mind is a single
  /// edit rather than a sweep.
  ///
  /// Both names must match a `family:` declared in pubspec.yaml. Until a font
  /// is registered there these resolve to the platform's default face, which
  /// works but looks like a placeholder — because it is one.
  static const String family = 'Body';

  /// Headings. Heavier and rounder, so titles hold against busy artwork where
  /// the body face would go soft.
  static const String displayFamily = 'Display';

  /// Type sits on illustrated backgrounds almost everywhere in this game, and
  /// pastel art eats unshadowed text alive. This is the default separation.
  static const List<Shadow> _lift = [
    Shadow(color: Color(0xE6101828), blurRadius: 12, offset: Offset(0, 3)),
    Shadow(color: Color(0x99101828), blurRadius: 3),
  ];

  /// Softer version for type on a solid card, where a heavy shadow reads as dirt.
  static const List<Shadow> _press = [
    Shadow(color: Color(0x2E4A3340), blurRadius: 3, offset: Offset(0, 2)),
  ];

  /// Heading type. Same shadow rules, heavier face.
  static TextStyle display({
    required double size,
    Color color = const Color(0xFFFFFFFF),
    double letterSpacing = 0,
    bool onArt = true,
  }) => TextStyle(
    fontFamily: displayFamily,
    fontSize: size,
    color: color,
    letterSpacing: letterSpacing,
    shadows: onArt ? _lift : _press,
  );

  static TextPaint displayPaint({
    required double size,
    Color color = const Color(0xFFFFFFFF),
    double letterSpacing = 0,
    bool onArt = true,
  }) => TextPaint(
    style: display(
      size: size,
      color: color,
      letterSpacing: letterSpacing,
      onArt: onArt,
    ),
  );

  static TextStyle style({
    required double size,
    Color color = const Color(0xFFFFFFFF),
    FontWeight weight = FontWeight.w400,
    double letterSpacing = 0,
    bool onArt = true,
  }) => TextStyle(
    fontFamily: family,
    fontSize: size,
    color: color,
    fontWeight: weight,
    letterSpacing: letterSpacing,
    shadows: onArt ? _lift : _press,
  );

  /// No shadow at all — for dense diagnostics where it would only smear.
  static TextStyle plain({
    required double size,
    Color color = const Color(0xFFFFFFFF),
    double letterSpacing = 0,
  }) => TextStyle(
    fontFamily: family,
    fontSize: size,
    color: color,
    letterSpacing: letterSpacing,
  );

  static TextPaint paint({
    required double size,
    Color color = const Color(0xFFFFFFFF),
    FontWeight weight = FontWeight.w400,
    double letterSpacing = 0,
    bool onArt = true,
  }) => TextPaint(
    style: style(
      size: size,
      color: color,
      weight: weight,
      letterSpacing: letterSpacing,
      onArt: onArt,
    ),
  );

  static TextPaint paintPlain({
    required double size,
    Color color = const Color(0xFFFFFFFF),
    double letterSpacing = 0,
  }) => TextPaint(
    style: plain(size: size, color: color, letterSpacing: letterSpacing),
  );
}
