import 'package:flame/components.dart';
import 'package:flame/effects.dart';
import 'package:flutter/animation.dart' show Curves;

/// A sprite that breathes.
///
/// The first piece of real art in the project, and the template for every one
/// after it: a [SpriteComponent] plus Flame's effect system rather than an
/// `update()` full of hand-rolled sine maths. Effects compose, run on their own
/// controllers, and can be added or removed at runtime — a manual animation in
/// update() can do none of that.
class TitleArt extends SpriteComponent {
  TitleArt({
    required Sprite sprite,
    required Vector2 position,
    required Vector2 artSize,
    this.breathPeriod = 3.4,
    this.driftPeriod = 5.2,
  }) : super(
          sprite: sprite,
          position: position,
          size: artSize,
          anchor: Anchor.center,
        );

  /// Seconds for one full scale in-and-out.
  final double breathPeriod;

  /// Seconds for one full up-and-down drift.
  final double driftPeriod;

  @override
  Future<void> onLoad() async {
    await super.onLoad();

    // Two effects on different periods so the motion never looks like a loop:
    // the scale and the drift drift out of phase with each other.
    await add(
      ScaleEffect.by(
        Vector2.all(1.05),
        EffectController(
          duration: breathPeriod / 2,
          reverseDuration: breathPeriod / 2,
          infinite: true,
          curve: Curves.easeInOut,
        ),
      ),
    );
    await add(
      MoveEffect.by(
        Vector2(0, -14),
        EffectController(
          duration: driftPeriod / 2,
          reverseDuration: driftPeriod / 2,
          infinite: true,
          curve: Curves.easeInOut,
        ),
      ),
    );
  }
}
