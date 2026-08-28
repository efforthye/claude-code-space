import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/events.dart';
import 'package:flutter/painting.dart' show TextStyle;

import '../core/scene.dart';
import '../core/scene_id.dart';
import '../ui/progress_bar.dart';
import '../ui/title_art.dart';
import '../world/background.dart';

/// Splash. Hands over to the menu on its own after [hold]; a tap only skips the
/// wait. Nobody should be made to sit through a splash, and nobody should have to
/// tap to get past one either — hence both paths, and copy that says "skip"
/// rather than "continue" so the screen does not lie about which is required.
///
/// To make the tap mandatory instead, delete the TimerComponent in buildScene.
class TitleScene extends SceneComponent with TapCallbacks {
  static const Duration hold = Duration(milliseconds: 2200);

  bool _advanced = false;

  @override
  SceneId get id => SceneId.title;

  @override
  Future<void> buildScene() async {
    await add(
      GradientBackground(
        top: const Color(0xFF101A2E),
        bottom: const Color(0xFF070B14),
      ),
    );

    // First real art asset. Sprite.load reads from assets/images/, which is why
    // the folder is named that — it is Flame's convention, not a preference.
    await add(
      TitleArt(
        sprite: await Sprite.load('blossom_tree.png'),
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.33),
        artSize: Vector2.all(440),
      ),
    );

    await add(
      TextComponent(
        text: 'HELLO FLAME!',
        anchor: Anchor.center,
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.60),
        textRenderer: TextPaint(
          style: const TextStyle(
            color: Color(0xFFF0B34A),
            fontSize: 64,
            letterSpacing: 4,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );

    await add(
      TextComponent(
        text: 'tap to skip',
        anchor: Anchor.center,
        position: Vector2(sceneSize.x / 2, sceneSize.y - 110),
        textRenderer: TextPaint(
          style: const TextStyle(color: Color(0x66C8D2E0), fontSize: 20, letterSpacing: 2),
        ),
      ),
    );

    // The bar and the hand-off run off the same duration, so the bar reaching
    // its end *is* the transition rather than something that merely happens near
    // it. One clock, not two that drift.
    await add(
      ProgressBar(
        duration: hold.inMilliseconds / 1000,
        position: Vector2(sceneSize.x / 2, sceneSize.y - 150),
        size: Vector2(300, 7),
        onComplete: _advance,
      ),
    );
  }

  void _advance() {
    if (_advanced) return;
    _advanced = true;
    goTo(SceneId.mainMenu);
  }

  @override
  void onTapUp(TapUpEvent event) => _advance();

  @override
  bool containsLocalPoint(Vector2 point) => true;
}
