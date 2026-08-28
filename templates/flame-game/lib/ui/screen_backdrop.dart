import 'dart:ui';

import 'package:flame/components.dart';

/// Artwork painted across the whole device, behind everything.
///
/// The layout lives in a fixed 9:16 design space so it is identical everywhere,
/// which necessarily letterboxes on a taller phone. Filling those bands with a
/// flat colour makes the game look boxed in; filling them with the same artwork
/// makes the screen feel like one piece while the layout stays predictable.
///
/// So this deliberately sits outside the camera: it is added to the game root
/// rather than to the world, and therefore is not clipped to the design
/// rectangle. It re-crops itself whenever the device size changes.
class ScreenBackdrop extends PositionComponent {
  ScreenBackdrop({super.priority});

  Sprite? _source;
  Sprite? _cover;
  double _dim = 0;
  double _alignY = 0.5;
  double _topScrim = 0;

  bool get isShowing => _source != null;

  /// Paint [sprite] full-bleed.
  ///
  /// [alignY] chooses which part survives the crop (0 keeps the top edge, 1 the
  /// bottom). [topScrim] fades a dark band down from the top edge: running the
  /// art to the top is what makes the screen feel whole, and it is also what
  /// puts the clock and battery on a bright sky. A gradient buys the status bar
  /// back for the cost of a few percent of one corner, which a flat overlay
  /// across the whole picture would not.
  void show(
    Sprite sprite, {
    double dim = 0,
    double alignY = 0.5,
    double topScrim = 0,
  }) {
    _source = sprite;
    _dim = dim;
    _alignY = alignY;
    _topScrim = topScrim;
    _cover = null;
  }

  void clear() {
    _source = null;
    _cover = null;
  }

  @override
  void onGameResize(Vector2 size) {
    super.onGameResize(size);
    this.size = size;
    _cover = null; // the crop depends on the device ratio
  }

  Sprite? _resolve() {
    final source = _source;
    if (source == null) return null;
    if (_cover != null) return _cover;
    if (size.x <= 0 || size.y <= 0) return null;

    final image = source.image;
    final imageSize = Vector2(image.width.toDouble(), image.height.toDouble());
    final targetRatio = size.x / size.y;
    final imageRatio = imageSize.x / imageSize.y;

    final Vector2 src;
    if (imageRatio > targetRatio) {
      src = Vector2(imageSize.y * targetRatio, imageSize.y);
    } else {
      src = Vector2(imageSize.x, imageSize.x / targetRatio);
    }
    return _cover = Sprite(
      image,
      srcPosition: Vector2(
        (imageSize.x - src.x) * 0.5,
        (imageSize.y - src.y) * _alignY,
      ),
      srcSize: src,
    );
  }

  @override
  void render(Canvas canvas) {
    final sprite = _resolve();
    if (sprite == null) return;
    sprite.render(canvas, position: Vector2.zero(), size: size);
    if (_dim > 0) {
      canvas.drawRect(
        size.toRect(),
        Paint()..color = Color.fromRGBO(4, 6, 12, _dim.clamp(0, 1)),
      );
    }
    if (_topScrim > 0) {
      final band = Rect.fromLTWH(0, 0, size.x, size.y * 0.16);
      canvas.drawRect(
        band,
        Paint()
          ..shader = Gradient.linear(band.topCenter, band.bottomCenter, [
            Color.fromRGBO(4, 6, 12, _topScrim.clamp(0, 1)),
            const Color(0x00040610),
          ]),
      );
    }
  }
}
