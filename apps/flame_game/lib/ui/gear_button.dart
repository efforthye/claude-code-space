import 'dart:math';
import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/events.dart';

import '../core/events.dart';
import '../core/game_frame.dart';

/// The settings entry point: a gear, drawn rather than imported.
///
/// Icons this simple are cheaper as geometry than as an asset — no file to keep
/// in step with the art, no resolution to pick, and it scales cleanly to any
/// size the layout wants.
class GearButton extends PositionComponent
    with TapCallbacks, HasGameReference<GameFrame> {
  GearButton({
    required super.position,
    double radius = 34,
    this.onPressed,
    this.teeth = 8,
  }) : _radius = radius,
       super(size: Vector2.all(radius * 2), anchor: Anchor.center);

  final void Function()? onPressed;
  final int teeth;
  final double _radius;

  bool _pressed = false;

  /// Eased 0..1. Same swell every other button in the game uses — a press
  /// should feel the same wherever it lands, and a colour change alone is
  /// invisible under the thumb that caused it.
  double _grow = 0;
  static const double _pressGrow = 0.08;
  static const double _growRate = 18;

  static final Paint _plate = Paint()..color = const Color(0xB3FFFFFF);
  static final Paint _plateDown = Paint()..color = const Color(0xE6FFE3F0);
  static final Paint _ink = Paint()
    ..color = const Color(0xFF9B5C74)
    ..style = PaintingStyle.fill;
  static final Paint _rim = Paint()
    ..color = const Color(0x33000000)
    ..style = PaintingStyle.stroke
    ..strokeWidth = 2;

  @override
  void update(double dt) {
    super.update(dt);
    final target = _pressed ? 1.0 : 0.0;
    if ((_grow - target).abs() < 0.005) {
      _grow = target;
    } else {
      _grow += (target - _grow) * (dt * _growRate).clamp(0, 1);
    }
  }

  @override
  void render(Canvas canvas) {
    final c = Offset(_radius, _radius);
    // Scaled about the centre, so the gear grows in place rather than drifting
    // toward a corner.
    if (_grow > 0.001) {
      canvas.save();
      canvas.translate(c.dx, c.dy);
      canvas.scale(1 + _pressGrow * _grow);
      canvas.translate(-c.dx, -c.dy);
    }
    canvas.drawCircle(c, _radius, _pressed ? _plateDown : _plate);
    canvas.drawCircle(c, _radius, _rim);

    // Body plus separate teeth. Alternating two radii around a polygon draws a
    // star, not a gear — the teeth have to be stubs standing off a solid ring.
    final body = _radius * 0.42;
    final toothLen = _radius * 0.2;
    final toothW = _radius * 0.19;
    for (var i = 0; i < teeth; i++) {
      final a = (i / teeth) * pi * 2;
      canvas.save();
      canvas.translate(c.dx, c.dy);
      canvas.rotate(a);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(-toothW / 2, -(body + toothLen), toothW, toothLen + 4),
          const Radius.circular(3),
        ),
        _ink,
      );
      canvas.restore();
    }
    canvas.drawCircle(c, body, _ink);

    // Hub drawn in the plate colour rather than cleared: clearing punches
    // through the plate and everything behind it, leaving a hole in the scene.
    canvas.drawCircle(c, _radius * 0.16, _pressed ? _plateDown : _plate);

    if (_grow > 0.001) canvas.restore();
  }

  @override
  bool containsLocalPoint(Vector2 point) =>
      (point - Vector2.all(_radius)).length <= _radius;

  @override
  void onTapDown(TapDownEvent event) => _pressed = true;

  @override
  void onTapUp(TapUpEvent event) {
    _pressed = false;
    game.bus.emit(const ButtonPressed('settings'));
    onPressed?.call();
  }

  @override
  void onTapCancel(TapCancelEvent event) => _pressed = false;
}
