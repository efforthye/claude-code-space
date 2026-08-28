import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flutter/painting.dart' show TextStyle;

import '../core/events.dart';
import '../core/scene.dart';
import '../core/scene_id.dart';
import '../systems/game_system.dart';
import '../ui/button.dart';
import '../world/background.dart';
import '../world/game_object.dart';

/// The play scene.
///
/// It owns a world layer, a HUD layer and a list of [GameSystem]s. Note what it
/// does *not* contain: no scoring maths, no spawn timing. Those live in systems,
/// so this class stays about composition and stays short as the game grows.
class GameScene extends SceneComponent {
  static const int targetScore = 60;

  final List<GameSystem> _systems = [];
  late final Component _world;
  late final ScoreSystem _score;
  late final TextComponent _scoreLabel;

  bool _ending = false;

  @override
  SceneId get id => SceneId.game;

  @override
  Future<void> buildScene() async {
    await add(
      GridBackground(
        top: const Color(0xFF12203A),
        bottom: const Color(0xFF070C16),
      ),
    );

    // Actors live in their own container so the HUD never collides with them
    // and the whole world can be cleared in one call.
    _world = Component();
    await add(_world);

    _scoreLabel = TextComponent(
      text: 'score 0',
      anchor: Anchor.topRight,
      position: Vector2(sceneSize.x - 16, 16),
      priority: 10,
      textRenderer: TextPaint(
        style: const TextStyle(
          color: Color(0xFFF0B34A),
          fontSize: 20,
          letterSpacing: 1,
        ),
      ),
    );
    await add(_scoreLabel);

    await add(
      TextComponent(
        text: 'reach $targetScore to clear',
        anchor: Anchor.topRight,
        position: Vector2(sceneSize.x - 16, 42),
        priority: 10,
        textRenderer: TextPaint(
          style: const TextStyle(color: Color(0x8899A3B5), fontSize: 12),
        ),
      ),
    );

    await add(
      Button(
        id: 'quit_run',
        label: 'MENU',
        size: Vector2(120, 40),
        position: Vector2(sceneSize.x - 76, sceneSize.y - 32),
        onPressed: () => _finish(GameOutcome.quit),
      ),
    );

    _score = ScoreSystem();
    _systems
      ..add(_score)
      ..add(SpawnSystem(parent: _world, area: sceneSize));
  }

  @override
  Future<void> onEnterScene() async {
    bus.emit(const GameStarted());
    for (final system in _systems) {
      system.onAttach(bus);
    }
    // The HUD listens rather than polls — the score system is the only owner of
    // the number, and everyone else finds out the same way.
    listen<ScoreChanged>((event) {
      _scoreLabel.text = 'score ${event.score}';
      if (event.score >= targetScore) _finish(GameOutcome.cleared);
    });
  }

  @override
  void update(double dt) {
    super.update(dt);
    if (_ending) return;
    for (final system in _systems) {
      system.step(dt);
    }
  }

  void _finish(GameOutcome outcome) {
    if (_ending) return;
    _ending = true;
    bus.emit(GameEnded(outcome: outcome, score: _score.score));
    goTo(SceneId.gameEnd);
  }

  @override
  void onExitScene() {
    for (final system in _systems) {
      system.onDetach();
    }
    _systems.clear();
    _world.removeWhere((child) => child is GameObject);
  }
}
