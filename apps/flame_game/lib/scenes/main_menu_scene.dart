import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flutter/painting.dart' show TextStyle;

import '../core/scene.dart';
import '../core/scene_id.dart';
import '../ui/sprite_button.dart';

/// The hub. Owns its buttons and decides what each press means; the buttons
/// themselves know nothing about scenes.
class MainMenuScene extends SceneComponent {
  @override
  SceneId get id => SceneId.mainMenu;

  @override
  void onExitScene() => frame.backdrop.clear();

  @override
  Future<void> buildScene() async {
    // Full-bleed, so the art runs into the letterbox bands instead of leaving
    // black bars above and below. Layout still happens in the design space.
    frame.backdrop.show(
      await Sprite.load('bg_main_menu.png'),
      alignY: 0.5,
      // Buys back the status bar, which the full-bleed art otherwise puts on a
      // bright sky. Fades out within the top sixth, so the picture is untouched.
      topScrim: 0.55,
    );

    await add(
      TextComponent(
        text: 'MAIN MENU',
        anchor: Anchor.center,
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.28),
        textRenderer: TextPaint(
          style: const TextStyle(
            color: Color(0xFFFFFFFF),
            fontSize: 54,
            letterSpacing: 5,
            fontWeight: FontWeight.w600,
            // Illustrated backgrounds are bright and busy. A shadow keeps the
            // label readable without dimming the art everyone came to see.
            shadows: [
              Shadow(color: Color(0xCC101828), blurRadius: 14, offset: Offset(0, 3)),
              Shadow(color: Color(0x99101828), blurRadius: 3),
            ],
          ),
        ),
      ),
    );

    final best = frame.session.highScore;
    await add(
      TextComponent(
        text: best > 0 ? 'best $best' : 'no runs yet',
        anchor: Anchor.center,
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.28 + 54),
        textRenderer: TextPaint(
          style: const TextStyle(
            color: Color(0xFFE8ECF2),
            fontSize: 23,
            shadows: [Shadow(color: Color(0xCC101828), blurRadius: 10, offset: Offset(0, 2))],
          ),
        ),
      ),
    );

    // The art is 1384x808; keeping that ratio stops the bunny from stretching.
    const artRatio = 1384 / 808;
    const startWidth = 380.0;
    final startSize = Vector2(startWidth, startWidth / artRatio);
    final startCentre = Vector2(sceneSize.x / 2, sceneSize.y * 0.66);

    await add(
      SpriteButton(
        id: 'start_game',
        idleSprite: await Sprite.load('btn_game_start.png'),
        // Cropped from the same rect as the idle art, so the two frames line up
        // to the pixel and the button does not jump when it is pressed.
        pressedSprite: await Sprite.load('btn_game_start_pressed.png'),
        position: startCentre,
        size: startSize,
        onPressed: () => goTo(SceneId.game),
      ),
    );

  }
}
