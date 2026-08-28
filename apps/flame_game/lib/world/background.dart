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

/// Full-bleed artwork.
///
/// Art almost never matches the design ratio, and stretching it to fit is the
/// one thing that always looks wrong. This crops instead: the sprite is scaled
/// until it covers the design space and the overflow is cut from a source rect,
/// so the picture keeps its proportions on every screen.
///
/// [dim] darkens it. Illustrated backgrounds are busy and bright, and text laid
/// over them stops being readable; a scrim is cheaper than outlining every label.
class SpriteBackground extends Background {
  SpriteBackground(
    this.sprite, {
    this.dim = 0,
    this.alignX = 0.5,
    this.alignY = 0.5,
    super.priority,
  });

  final Sprite sprite;

  /// 0 = untouched, 1 = black.
  final double dim;

  /// Which part survives the crop. 0 = keep the left/top edge, 1 = right/bottom.
  final double alignX;
  final double alignY;

  late final Sprite _cover = _buildCover();

  Sprite _buildCover() {
    final image = sprite.image;
    final imageSize = Vector2(image.width.toDouble(), image.height.toDouble());
    final targetRatio = size.x / size.y;
    final imageRatio = imageSize.x / imageSize.y;

    final Vector2 src;
    if (imageRatio > targetRatio) {
      src = Vector2(imageSize.y * targetRatio, imageSize.y); // too wide: trim sides
    } else {
      src = Vector2(imageSize.x, imageSize.x / targetRatio); // too tall: trim top/bottom
    }
    final offset = Vector2(
      (imageSize.x - src.x) * alignX,
      (imageSize.y - src.y) * alignY,
    );
    return Sprite(image, srcPosition: offset, srcSize: src);
  }

  @override
  void render(Canvas canvas) {
    _cover.render(canvas, position: Vector2.zero(), size: size);
    if (dim > 0) {
      canvas.drawRect(
        size.toRect(),
        Paint()..color = Color.fromRGBO(4, 6, 12, dim.clamp(0, 1)),
      );
    }
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
