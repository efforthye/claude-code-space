import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flutter/painting.dart' show TextStyle;

import '../core/scene.dart';
import '../core/scene_id.dart';
import '../ui/button.dart';
import '../ui/settings_panel.dart';
import '../world/background.dart';

/// The hub. Owns its buttons and decides what each press means; the buttons
/// themselves know nothing about scenes.
class MainMenuScene extends SceneComponent {
  @override
  SceneId get id => SceneId.mainMenu;

  @override
  Future<void> buildScene() async {
    await add(
      GradientBackground(
        top: const Color(0xFF16203A),
        bottom: const Color(0xFF0A0F1B),
      ),
    );

    await add(
      TextComponent(
        text: 'MAIN MENU',
        anchor: Anchor.center,
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.28),
        textRenderer: TextPaint(
          style: const TextStyle(
            color: Color(0xFFF2F4F7),
            fontSize: 54,
            letterSpacing: 5,
            fontWeight: FontWeight.w600,
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
          style: const TextStyle(color: Color(0x8899A3B5), fontSize: 23),
        ),
      ),
    );

    await add(
      Button(
        id: 'start_game',
        label: 'START GAME',
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.5),
        onPressed: () => goTo(SceneId.game),
      ),
    );

    await add(
      Button(
        id: 'settings',
        label: 'SETTINGS',
        position: Vector2(sceneSize.x / 2, sceneSize.y * 0.5 + 126),
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
