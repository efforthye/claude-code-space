import 'dart:ui';

import 'package:flame/components.dart';

/// The streak the finger leaves behind.
///
/// Purely cosmetic — it decides nothing. The scene does its own hit testing
/// against the segment the finger actually moved this frame, because a trail
/// tuned for looks and a trail used for collision would drift apart the first
/// time either was adjusted.
class SwipeTrail extends PositionComponent {
  SwipeTrail({super.priority});

  /// Points and how long each has left to live.
  final List<_Point> _points = [];

  /// How long a point stays visible. Long enough to read as a stroke, short
  /// enough that the tail never suggests the finger is somewhere it is not.
  static const double _life = 0.16;

  static const double _width = 22;

  void addPoint(Vector2 p) => _points.add(_Point(p.clone(), _life));

  void clear() => _points.clear();

  @override
  void update(double dt) {
    super.update(dt);
    for (final p in _points) {
      p.left -= dt;
    }
    _points.removeWhere((p) => p.left <= 0);
  }

  @override
  void render(Canvas canvas) {
    if (_points.length < 2) return;

    // Drawn as a run of segments rather than one path, so each can taper and
    // fade with its own age. A single stroked path can only have one width.
    for (var i = 1; i < _points.length; i++) {
      final a = _points[i - 1];
      final b = _points[i];
      final t = (b.left / _life).clamp(0.0, 1.0);
      canvas.drawLine(
        Offset(a.at.x, a.at.y),
        Offset(b.at.x, b.at.y),
        Paint()
          ..strokeCap = StrokeCap.round
          ..strokeWidth = _width * t
          ..color = const Color(0xFFFFFFFF).withAlpha((215 * t * t).round()),
      );
    }
  }
}

class _Point {
  _Point(this.at, this.left);

  final Vector2 at;
  double left;
}
