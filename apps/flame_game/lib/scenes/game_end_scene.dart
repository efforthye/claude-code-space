import 'dart:ui';

import 'package:flame/components.dart';

import '../core/events.dart';
import '../core/scene.dart';
import '../core/scene_id.dart';
import '../core/typography.dart';
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
          GameOutcome.cleared => '클리어!',
          GameOutcome.failed => '아쉬워요',
          GameOutcome.quit => '그만뒀어요',
        },
        anchor: Anchor.center,
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.3),
        textRenderer: AppText.displayPaint(
          size: 64,
          color: outcome == GameOutcome.cleared
              ? const Color(0xFF8FD6B5)
              : const Color(0xFFF2F4F7),
        ),
      ),
    );

    await add(
      TextComponent(
        text: '점수 $score   ·   최고 ${frame.session.highScore}',
        anchor: Anchor.center,
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.3 + 60),
        textRenderer: AppText.paint(size: 27, color: const Color(0x99C8D2E0)),
      ),
    );

    await add(
      Button(
        id: 'retry',
        label: '다시 하기',
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.55),
        onPressed: () => goTo(SceneId.game),
      ),
    );

    await add(
      Button(
        id: 'to_menu',
        label: '메인으로',
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.55 + 126),
        onPressed: () => goTo(SceneId.mainMenu),
      ),
    );
  }
}
