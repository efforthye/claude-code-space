import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/events.dart';

/// Anything that can be hurt. An interface rather than a base class so a wall,
/// an actor and a destructible prop can all be damageable without sharing an
/// ancestor they have no other use for.
abstract interface class Damageable {
  bool get isAlive;
  void takeDamage(int amount);
}

/// Anything the game world contains and can switch off.
///
/// The base holds only what every world object truly shares — a position, an
/// active flag, and a disposal path. Behaviour belongs to subclasses.
abstract class GameObject extends PositionComponent {
  GameObject({super.position, super.size, super.anchor, super.priority});

  bool _active = true;
  bool get isActive => _active;

  /// Switch the object off without removing it, for pooling or pausing.
  void deactivate() => _active = false;
  void activate() => _active = true;

  /// Subclasses override this instead of [update]; the base skips it entirely
  /// while inactive, so no subclass has to remember the check.
  void step(double dt) {}

  @override
  void update(double dt) {
    super.update(dt);
    if (_active) step(dt);
  }
}

/// A moving, damageable, tappable object — the ancestor of anything that behaves.
///
/// It reports its own death through [onDefeated] instead of reaching for an
/// event bus. An actor that imported the bus would be untestable without one and
/// unusable outside this game; a callback keeps it a plain object that anybody
/// can construct.
class Actor extends GameObject with TapCallbacks implements Damageable {
  Actor({
    required super.position,
    required Vector2 velocity,
    required double radius,
    int health = 1,
    Color color = const Color(0xFFF0B34A),
    this.onDefeated,
  })  : _velocity = velocity,
        _radius = radius,
        _health = health,
        _color = color,
        super(size: Vector2.all(radius * 2), anchor: Anchor.center);

  /// Called once, when this actor is defeated.
  final void Function(Actor actor)? onDefeated;

  final Vector2 _velocity;
  final double _radius;
  final Color _color;
  int _health;

  Vector2 get velocity => _velocity;
  double get radius => _radius;

  @override
  bool get isAlive => _health > 0;

  /// A tap is a hit. The actor does not know it is worth points — it only knows
  /// it was struck, which is the whole reason [takeDamage] is an interface.
  @override
  void onTapDown(TapDownEvent event) {
    if (!isActive) return;
    takeDamage(1);
  }

  /// Round hit area, so a tap near the corner of the bounding box misses like
  /// the player expects it to.
  @override
  bool containsLocalPoint(Vector2 point) =>
      (point - Vector2.all(_radius)).length <= _radius;

  @override
  void takeDamage(int amount) {
    if (amount <= 0 || !isAlive) return;
    _health -= amount;
    if (!isAlive) onDeath();
  }

  /// Hook for subclasses. Polymorphism where it earns its keep: whatever dealt
  /// the damage calls [takeDamage] and never needs to know what dying means for
  /// a particular actor.
  void onDeath() {
    deactivate();
    onDefeated?.call(this);
    removeFromParent();
  }

  @override
  void step(double dt) {
    position += _velocity * dt;
    _bounceInsideBounds();
  }

  void _bounceInsideBounds() {
    final bounds = findGame()?.size;
    if (bounds == null) return;
    if (position.x - _radius < 0 && _velocity.x < 0) _velocity.x = -_velocity.x;
    if (position.x + _radius > bounds.x && _velocity.x > 0) {
      _velocity.x = -_velocity.x;
    }
    if (position.y - _radius < 0 && _velocity.y < 0) _velocity.y = -_velocity.y;
    if (position.y + _radius > bounds.y && _velocity.y > 0) {
      _velocity.y = -_velocity.y;
    }
  }

  @override
  void render(Canvas canvas) {
    canvas.drawCircle(
      Offset(_radius, _radius),
      _radius,
      Paint()..color = _color,
    );
  }
}
