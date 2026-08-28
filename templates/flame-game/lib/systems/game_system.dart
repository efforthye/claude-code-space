import 'dart:async';
import 'dart:math';

import 'package:flame/components.dart';

import '../core/event_bus.dart';
import '../core/events.dart';
import '../world/game_object.dart';

/// A slice of gameplay rules with a lifecycle.
///
/// Systems are how the game scene stays readable: instead of one scene class
/// that scores, spawns and checks win conditions, each concern is a small object
/// the scene owns and steps. The scene calls [step] on `List<GameSystem>` without
/// knowing what any of them do — add a system, change nothing else.
abstract interface class GameSystem {
  String get name;

  /// Called when the system joins a running scene.
  void onAttach(EventBus bus);

  /// Called once per frame while the scene is active.
  void step(double dt);

  /// Called when the scene tears down. Release anything held here.
  void onDetach();
}

/// Owns the score. Nothing else in the game stores it — listeners hear about
/// changes and render them.
///
/// It never touches an actor: it counts [TargetPopped] events. That is why the
/// scoring rule can change (combos, multipliers, streaks) without a single edit
/// to the things being tapped.
class ScoreSystem implements GameSystem {
  EventBus? _bus;
  StreamSubscription<TargetPopped>? _subscription;
  int _score = 0;

  int get score => _score;

  @override
  String get name => 'score';

  @override
  void onAttach(EventBus bus) {
    _bus = bus;
    _score = 0;
    _subscription = bus.on<TargetPopped>().listen(_award);
    bus.emit(ScoreChanged(_score));
  }

  void _award(TargetPopped event) {
    _score += event.points;
    _bus?.emit(ScoreChanged(_score));
  }

  @override
  void step(double dt) {}

  @override
  void onDetach() {
    _subscription?.cancel();
    _subscription = null;
    _bus = null;
  }
}

/// Adds actors to the scene on a timer.
///
/// It holds the parent it spawns into rather than the scene class, so it works
/// in any scene that can accept children, and it wires each actor's defeat back
/// to the bus so the actors themselves stay bus-free.
class SpawnSystem implements GameSystem {
  SpawnSystem({
    required this.parent,
    required this.area,
    this.interval = 0.85,
    this.pointsPerTarget = 10,
    Random? random,
  }) : _random = random ?? Random();

  final Component parent;
  final Vector2 area;
  final double interval;
  final int pointsPerTarget;
  final Random _random;

  EventBus? _bus;
  double _elapsed = 0;

  /// How many targets are on screen right now — the scene's failure signal.
  int get liveTargets => parent.children.whereType<Actor>().length;

  @override
  String get name => 'spawn';

  @override
  void onAttach(EventBus bus) {
    _bus = bus;
    _elapsed = 0;
  }

  @override
  void step(double dt) {
    _elapsed += dt;
    if (_elapsed < interval) return;
    _elapsed = 0;
    parent.add(_makeActor());
  }

  Actor _makeActor() {
    final angle = _random.nextDouble() * pi * 2;
    final speed = 70 + _random.nextDouble() * 130;
    // Touch targets, not decoration: nothing smaller than a fingertip.
    final radius = 40 + _random.nextDouble() * 30;
    return Actor(
      position: Vector2(
        radius + _random.nextDouble() * (area.x - radius * 2),
        area.y * 0.18 + _random.nextDouble() * (area.y * 0.6),
      ),
      velocity: Vector2(cos(angle), sin(angle)) * speed,
      radius: radius,
      onDefeated: (_) => _bus?.emit(TargetPopped(pointsPerTarget)),
    );
  }

  @override
  void onDetach() => _bus = null;
}
