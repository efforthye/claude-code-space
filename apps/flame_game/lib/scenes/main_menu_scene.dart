import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/effects.dart';
import 'package:flutter/animation.dart' show Curves;

import '../core/design.dart';
import '../core/game_audio.dart';
import '../core/scene.dart';
import '../core/scene_id.dart';
import '../core/typography.dart';
import '../ui/gear_button.dart';
import '../ui/progress_bar.dart';
import '../ui/settings_panel.dart';
import '../ui/sprite_button.dart';

/// The hub. Owns its buttons and decides what each press means; the buttons
/// themselves know nothing about scenes.
class MainMenuScene extends SceneComponent {
  /// How long the opening beat runs before the controls appear.
  static const Duration introHold = Duration(milliseconds: 2200);

  /// Components that belong to the opening beat only.
  final List<Component> _transient = [];

  @override
  SceneId get id => SceneId.mainMenu;

  @override
  bool get showsDebugOverlay => false;

  @override
  void onExitScene() => frame.backdrop.clear();

  @override
  Future<void> buildScene() async {
    // Only on a return visit. On the very first launch the music waits for the
    // opening beat to finish; after that the player has already heard it and a
    // silent menu would read as a bug.
    if (frame.audio.track != null) {
      await frame.audio.playBgm(GameAudio.bgmMenu);
    }

    // Full-bleed, so the art runs into the letterbox bands instead of leaving
    // black bars above and below. Layout still happens in the design space.
    frame.backdrop.show(
      await Sprite.load('bg_main_menu.png'),
      alignY: 0.5,
      // Buys back the status bar, which the full-bleed art otherwise puts on a
      // bright sky. Fades out within the top sixth, so the picture is untouched.
      topScrim: 0.55,
    );

    // Logo instead of type: the wordmark is the brand, and a rendered font can
    // never match it. Design.gameName stays as the name for stores and metadata.
    const logoRatio = 2116 / 500;
    const logoWidth = 560.0;
    await add(
      SpriteComponent(
        sprite: await Sprite.load('logo.png'),
        anchor: Anchor.center,
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.24),
        size: Vector2(logoWidth, logoWidth / logoRatio),
      ),
    );

    // Nothing at all before the first run. A line announcing the absence of a
    // record tells the player something they already know, in a language the
    // rest of the screen does not speak.
    final best = frame.session.highScore;
    if (best > 0) {
      await add(
        TextComponent(
          text: '최고 기록 $best',
          anchor: Anchor.center,
          position: Vector2(
            sceneSize.x / 2,
            sceneSize.y * 0.24 + (logoWidth / logoRatio) / 2 + 34,
          ),
          textRenderer: AppText.paint(size: 26),
        ),
      );
    }

    // The opening beat happens here rather than on a separate splash: the player
    // looks at the actual game world while it settles, and there is one fewer
    // scene to transition through.
    final bar = ProgressBar(
      duration: introHold.inMilliseconds / 1000,
      position: Vector2(sceneSize.x / 2, sceneSize.y - 176),
      size: Vector2(300, 7),
      onComplete: _revealControls,
    );
    final copyright = TextComponent(
      text: '© 2026 creiip. All rights reserved.',
      anchor: Anchor.center,
      position: Vector2(sceneSize.x / 2, sceneSize.y - 132),
      textRenderer: AppText.paint(size: 18, color: const Color(0x8CFFFFFF)),
    );
    _transient.addAll([bar, copyright]);
    await addAll([bar, copyright]);
  }

  /// Swaps the loading line for the things the player can act on.
  Future<void> _revealControls() async {
    // Held back until the opening beat is over. Music under a loading bar reads
    // as an interruption; music arriving with the button reads as the game
    // opening its doors.
    await frame.audio.playBgm(GameAudio.bgmMenu);
    for (final component in _transient) {
      component.removeFromParent();
    }
    _transient.clear();

    // The art is 1384x808; keeping that ratio stops the bunny from stretching.
    const artRatio = 1384 / 808;
    const startWidth = 380.0;

    final start = SpriteButton(
      id: 'start_game',
      idleSprite: await Sprite.load('btn_game_start.png'),
      position: Vector2(sceneSize.x / 2, sceneSize.y * 0.76),
      size: Vector2(startWidth, startWidth / artRatio),
      pressSound: GameAudio.enter,
      onPressed: () {
        frame.settings.tapFeedback();
        goTo(SceneId.game);
      },
    );
    await add(start);
    // Pops in rather than appearing, so the arrival reads as intended.
    start.scale = Vector2.all(0.7);
    await start.add(
      ScaleEffect.to(
        Vector2.all(1),
        EffectController(duration: 0.32, curve: Curves.easeOutBack),
      ),
    );

    await add(
      GearButton(
        position: Vector2(
          sceneSize.x - Design.margin - 34,
          Design.margin + 40,
        ),
        onPressed: _openSettings,
      ),
    );
  }

  void _openSettings() {
    if (hasModal) return;
    frame.settings.tapFeedback();
    openModal(SettingsPanel(onClose: closeModal));
  }
}
