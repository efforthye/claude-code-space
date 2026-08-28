import 'dart:ui';

import 'package:flame/components.dart';

import '../core/design.dart';

/// A full-screen backdrop that resizes itself.
///
/// Abstract on purpose: every scene wants a background, none of them should
/// care how it is painted. Swapping a scene's look is changing one constructor
/// call, not editing the scene.
abstract class Background extends PositionComponent {
  Background({super.priority = -100}) {
    // Fills the design space. The camera handles the device; a background that
    // chased the real window size would fight the letterbox.
    size = Design.size;
  }
}

/// Flat colour. The cheapest possible backdrop.
class SolidBackground extends Background {
  SolidBackground(this.color, {super.priority});

  final Color color;

  @override
  void render(Canvas canvas) {
    canvas.drawRect(size.toRect(), Paint()..color = color);
  }
}

/// Vertical two-stop gradient.
class GradientBackground extends Background {
  GradientBackground({
    required this.top,
    required this.bottom,
    super.priority,
  });

  final Color top;
  final Color bottom;

  @override
  void render(Canvas canvas) {
    final rect = size.toRect();
    final paint = Paint()
      ..shader = Gradient.linear(
        rect.topCenter,
        rect.bottomCenter,
        [top, bottom],
      );
    canvas.drawRect(rect, paint);
  }
}

/// Gradient plus a faint grid, so the play area reads as a distinct space.
class GridBackground extends Background {
  GridBackground({
    required this.top,
    required this.bottom,
    this.cell = 48,
    super.priority,
  });

  final Color top;
  final Color bottom;
  final double cell;

  @override
  void render(Canvas canvas) {
    final rect = size.toRect();
    canvas.drawRect(
      rect,
      Paint()
        ..shader = Gradient.linear(rect.topLeft, rect.bottomRight, [top, bottom]),
    );

    final line = Paint()
      ..color = const Color(0x14FFFFFF)
      ..strokeWidth = 1;
    for (var x = 0.0; x < size.x; x += cell) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.y), line);
    }
    for (var y = 0.0; y < size.y; y += cell) {
      canvas.drawLine(Offset(0, y), Offset(size.x, y), line);
    }
  }
}
