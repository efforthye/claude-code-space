import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/events.dart';
import 'package:flutter/painting.dart' show TextStyle;

import '../core/scene.dart';
import '../core/scene_id.dart';
import '../world/background.dart';

/// Splash. Hands over to the menu on its own after [hold]; a tap only skips the
/// wait. Nobody should be made to sit through a splash, and nobody should have to
/// tap to get past one either — hence both paths, and copy that says "skip"
/// rather than "continue" so the screen does not lie about which is required.
///
/// To make the tap mandatory instead, delete the TimerComponent in buildScene.
///
/// To put art here, drop a PNG in assets/images/ and add:
///
///     await add(TitleArt(
///       sprite: await Sprite.load('your_art.png'),
///       position: Vector2(sceneSize.x / 2, sceneSize.y * 0.33),
///       artSize: Vector2.all(440),
///     ));
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

    await add(
      TextComponent(
        text: 'NEW GAME',
        anchor: Anchor.center,
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.45),
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
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.45 + 66),
        textRenderer: TextPaint(
          style: const TextStyle(color: Color(0x99C8D2E0), fontSize: 24),
        ),
      ),
    );

    // Auto-advance. removeOnFinish keeps the scene from accumulating timers if
    // it is ever re-entered.
    await add(
      TimerComponent(
        period: hold.inMilliseconds / 1000,
        removeOnFinish: true,
        onTick: _advance,
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
