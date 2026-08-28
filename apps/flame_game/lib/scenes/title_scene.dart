import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/events.dart';
import 'package:flutter/painting.dart' show TextStyle;

import '../core/scene.dart';
import '../core/scene_id.dart';
import '../world/background.dart';

/// Splash. Shows the title, then hands over to the menu on its own — or sooner
/// if the player taps, because nobody should be made to wait through a splash.
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
        text: 'HELLO FLAME!',
        anchor: Anchor.center,
        position: sceneSize / 2 - Vector2(0, 14),
        textRenderer: TextPaint(
          style: const TextStyle(
            color: Color(0xFFF0B34A),
            fontSize: 44,
            letterSpacing: 4,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );

    await add(
      TextComponent(
        text: 'tap to continue',
        anchor: Anchor.center,
        position: sceneSize / 2 + Vector2(0, 34),
        textRenderer: TextPaint(
          style: const TextStyle(color: Color(0x99C8D2E0), fontSize: 14),
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
