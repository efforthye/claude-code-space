import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flutter/painting.dart' show TextStyle;

import '../core/events.dart';
import '../core/scene.dart';
import '../core/scene_id.dart';
import '../ui/button.dart';
import '../world/background.dart';

/// Result screen.
///
/// It reads the finished run from the session rather than being handed data at
/// construction, which is what lets every scene be built by a zero-argument
/// factory and keeps the navigation table uniform.
class GameEndScene extends SceneComponent {
  @override
  SceneId get id => SceneId.gameEnd;

  @override
  Future<void> buildScene() async {
    final outcome = frame.session.lastOutcome ?? GameOutcome.quit;
    final score = frame.session.lastScore;

    await add(
      SolidBackground(
        switch (outcome) {
          GameOutcome.cleared => const Color(0xFF10241C),
          GameOutcome.failed => const Color(0xFF251215),
          GameOutcome.quit => const Color(0xFF12161F),
        },
      ),
    );

    await add(
      TextComponent(
        text: switch (outcome) {
          GameOutcome.cleared => 'CLEARED',
          GameOutcome.failed => 'FAILED',
          GameOutcome.quit => 'RUN ENDED',
        },
        anchor: Anchor.center,
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.3),
        textRenderer: TextPaint(
          style: TextStyle(
            color: outcome == GameOutcome.cleared
                ? const Color(0xFF8FD6B5)
                : const Color(0xFFF2F4F7),
            fontSize: 32,
            letterSpacing: 3,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );

    await add(
      TextComponent(
        text: 'score $score   ·   best ${frame.session.highScore}',
        anchor: Anchor.center,
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.3 + 34),
        textRenderer: TextPaint(
          style: const TextStyle(color: Color(0x99C8D2E0), fontSize: 14),
        ),
      ),
    );

    await add(
      Button(
        id: 'retry',
        label: 'PLAY AGAIN',
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.55),
        onPressed: () => goTo(SceneId.game),
      ),
    );

    await add(
      Button(
        id: 'to_menu',
        label: 'MAIN MENU',
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.55 + 70),
        onPressed: () => goTo(SceneId.mainMenu),
      ),
    );
  }
}
