import 'dart:math';

import 'package:flame/components.dart';

import '../core/event_bus.dart';
import '../core/events.dart';
import '../world/game_object.dart';

/// A slice of gameplay rules with a lifecycle.
///
/// Systems are how the game scene stays readable: instead of one scene class
/// that scores, spawns, and checks win conditions, each concern is a small
/// object the scene owns and steps. The scene calls [step] on `List<GameSystem>`
/// without knowing what any of them do — add a system, change nothing else.
abstract interface class GameSystem {
  String get name;

  /// Called when the system joins a running scene.
  void onAttach(EventBus bus);

  /// Called once per frame while the scene is active.
  void step(double dt);

  /// Called when the scene tears down. Release anything held here.
  void onDetach();
}

/// Keeps the score and announces every change. Nothing else in the game stores
/// the score — listeners hear about it and render it.
class ScoreSystem implements GameSystem {
  ScoreSystem({this.pointsPerSecond = 10});

  final int pointsPerSecond;

  EventBus? _bus;
  double _accumulated = 0;
  int _score = 0;

  int get score => _score;

  @override
  String get name => 'score';

  @override
  void onAttach(EventBus bus) {
    _bus = bus;
    _score = 0;
    _accumulated = 0;
    bus.emit(ScoreChanged(_score));
  }

  @override
  void step(double dt) {
    _accumulated += dt * pointsPerSecond;
    if (_accumulated < 1) return;
    final gained = _accumulated.floor();
    _accumulated -= gained;
    _score += gained;
    _bus?.emit(ScoreChanged(_score));
  }

  @override
  void onDetach() => _bus = null;
}

/// Adds actors to the scene on a timer, up to a cap.
///
/// It holds a reference to the parent it spawns into rather than to the scene
/// class, so it works in any scene that can accept children.
class SpawnSystem implements GameSystem {
  SpawnSystem({
    required this.parent,
    required this.area,
    this.interval = 1.4,
    this.maxActors = 12,
    Random? random,
  }) : _random = random ?? Random();

  final Component parent;
  final Vector2 area;
  final double interval;
  final int maxActors;
  final Random _random;

  double _elapsed = 0;

  @override
  String get name => 'spawn';

  @override
  void onAttach(EventBus bus) => _elapsed = 0;

  @override
  void step(double dt) {
    _elapsed += dt;
    if (_elapsed < interval) return;
    _elapsed = 0;
    if (parent.children.whereType<Actor>().length >= maxActors) return;
    parent.add(_makeActor());
  }

  Actor _makeActor() {
    final angle = _random.nextDouble() * pi * 2;
    final speed = 60 + _random.nextDouble() * 120;
    return Actor(
      position: Vector2(
        area.x * (0.2 + _random.nextDouble() * 0.6),
        area.y * (0.25 + _random.nextDouble() * 0.5),
      ),
      velocity: Vector2(cos(angle), sin(angle)) * speed,
      radius: 10 + _random.nextDouble() * 16,
    );
  }

  @override
  void onDetach() {}
}
