import 'dart:math';
import 'dart:ui';

import 'package:flame/components.dart';

/// Shared physics for anything the launcher throws.
///
/// Design-space pixels per second squared. Tuned against the launch speeds in
/// [SquishTarget.launch] so an arc peaks in the upper third of the screen —
/// high enough to be reachable, low enough that the player is not waiting.
const double kGravity = 1600;

/// A soft thing arcing through the air, waiting to be squished.
///
/// It owns its flight and its own look, and knows nothing about score, lives,
/// or what a swipe is. The scene asks whether a swipe crossed it and tells it
/// to burst; everything that follows from that is the scene's business.
class SquishTarget extends PositionComponent {
  SquishTarget({
    required super.position,
    required this.velocity,
    required this.hue,
    required double radius,
    this.spin = 0,
  }) : _radius = radius,
       super(size: Vector2.all(radius * 2), anchor: Anchor.center);

  Vector2 velocity;
  final Color hue;
  final double _radius;
  double spin;

  double get radius => _radius;

  double _angle = 0;
  bool _burst = false;

  /// True once it has been squished. A burst target is inert — it stops
  /// counting as a miss and cannot be sliced twice by the same swipe.
  bool get isBurst => _burst;

  Color get _deep => Color.lerp(hue, const Color(0xFF6E2B47), 0.5)!;

  @override
  void update(double dt) {
    super.update(dt);
    velocity.y += kGravity * dt;
    position += velocity * dt;
    _angle += spin * dt;
  }

  @override
  void render(Canvas canvas) {
    final c = Offset(_radius, _radius);

    canvas.save();
    canvas.translate(c.dx, c.dy);
    canvas.rotate(_angle);

    // Squash and stretch along the direction of travel. A rigid circle reads as
    // a ball; a shape that stretches on the way up and rounds out at the apex
    // reads as something soft, which is the entire premise of the game.
    final speed = velocity.length;
    final stretch = (speed / 2600).clamp(0.0, 0.3);
    canvas.scale(1 - stretch * 0.6, 1 + stretch);

    canvas.drawCircle(
      Offset.zero,
      _radius,
      Paint()
        ..shader = Gradient.linear(
          Offset(0, -_radius),
          Offset(0, _radius),
          [hue, _deep],
        ),
    );
    // One highlight reads as gloss. Two read as a diagram.
    canvas.drawCircle(
      Offset(-_radius * 0.3, -_radius * 0.34),
      _radius * 0.22,
      Paint()..color = const Color(0x8CFFFFFF),
    );
    canvas.restore();
  }

  /// Splits along [cut] — the direction the finger was travelling.
  ///
  /// Returns the pieces for the scene to add. They are not added here because a
  /// component cannot outlive its own removal, and the halves have to keep
  /// flying after this one is gone.
  List<Component> burst(Vector2 cut) {
    _burst = true;
    removeFromParent();

    final direction = cut.length2 > 0 ? cut.normalized() : Vector2(1, 0);
    // Perpendicular to the cut: the two halves are pushed apart across the line
    // the finger drew, which is the only way the split reads as *that* swipe.
    final apart = Vector2(-direction.y, direction.x) * 210;
    final angle = atan2(direction.y, direction.x);

    return [
      for (final side in [1.0, -1.0])
        _Half(
          position: position.clone(),
          velocity: velocity + apart * side,
          radius: _radius,
          cutAngle: angle,
          flipped: side < 0,
          hue: hue,
          deep: _deep,
          spin: spin + side * 3.4,
        ),
      for (var i = 0; i < 7; i++)
        _Droplet(
          position: position.clone(),
          velocity: velocity * 0.35 + apart * (i.isEven ? 0.9 : -0.9) * (0.3 + i / 12),
          hue: hue,
          radius: _radius * (0.09 + (i % 3) * 0.035),
        ),
    ];
  }
}

/// One half of a burst target, still under gravity and fading as it falls.
class _Half extends PositionComponent {
  _Half({
    required super.position,
    required this.velocity,
    required double radius,
    required this.cutAngle,
    required this.flipped,
    required this.hue,
    required this.deep,
    required this.spin,
  }) : _radius = radius,
       super(size: Vector2.all(radius * 2), anchor: Anchor.center);

  Vector2 velocity;
  final double _radius;
  final double cutAngle;
  final bool flipped;
  final Color hue;
  final Color deep;
  double spin;

  double _angle = 0;
  double _life = 1;
  static const double _fadeSeconds = 0.9;

  @override
  void update(double dt) {
    super.update(dt);
    velocity.y += kGravity * dt;
    position += velocity * dt;
    _angle += spin * dt;
    _life -= dt / _fadeSeconds;
    if (_life <= 0) removeFromParent();
  }

  @override
  void render(Canvas canvas) {
    final alpha = (255 * _life.clamp(0.0, 1.0)).round();
    canvas.save();
    canvas.translate(_radius, _radius);
    canvas.rotate(cutAngle + _angle);

    // Clip to one side of the cut line, then draw the whole blob. Cheaper and
    // rounder than building a half-disc path, and the flat edge lands exactly
    // where the finger crossed.
    canvas.clipRect(
      Rect.fromLTWH(
        -_radius,
        flipped ? -_radius : 0,
        _radius * 2,
        _radius,
      ),
    );
    canvas.drawCircle(
      Offset.zero,
      _radius,
      Paint()
        ..shader = Gradient.linear(
          Offset(0, -_radius),
          Offset(0, _radius),
          [hue.withAlpha(alpha), deep.withAlpha(alpha)],
        ),
    );
    canvas.restore();
  }
}

/// A speck of jelly thrown out by the burst.
class _Droplet extends PositionComponent {
  _Droplet({
    required super.position,
    required this.velocity,
    required this.hue,
    required double radius,
  }) : _radius = radius,
       super(size: Vector2.all(radius * 2), anchor: Anchor.center);

  Vector2 velocity;
  final Color hue;
  final double _radius;

  double _life = 1;
  static const double _fadeSeconds = 0.6;

  @override
  void update(double dt) {
    super.update(dt);
    velocity.y += kGravity * dt;
    position += velocity * dt;
    _life -= dt / _fadeSeconds;
    if (_life <= 0) removeFromParent();
  }

  @override
  void render(Canvas canvas) {
    canvas.drawCircle(
      Offset(_radius, _radius),
      _radius,
      Paint()..color = hue.withAlpha((255 * _life.clamp(0.0, 1.0)).round()),
    );
  }
}
