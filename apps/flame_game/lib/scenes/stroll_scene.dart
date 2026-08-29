import 'dart:math';
import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/effects.dart';
import 'package:flame/events.dart';
import 'package:flutter/animation.dart' show Curves;

import '../core/design.dart';
import '../core/events.dart';
import '../core/game_audio.dart';
import '../core/scene.dart';
import '../core/scene_id.dart';
import '../core/typography.dart';
import '../ui/button.dart';
import '../ui/modal_card.dart';
import '../world/background.dart';
import '../world/player.dart';

/// A jelly waiting to be walked over.
///
/// It has no idea who collects it or what that is worth — it reports being
/// reached and removes itself. The scene decides what that means.
class _Jelly extends PositionComponent {
  _Jelly({required super.position, required this.hue})
    : super(size: Vector2.all(58), anchor: Anchor.center);

  final Color hue;
  bool taken = false;

  /// Generous, because the character is walked into it rather than aimed at it.
  /// A radius the size of the drawing would demand pixel-accurate taps, which
  /// is the opposite of what this stage is for.
  static const double reach = 46;

  double _bob = 0;

  /// Fades out on collection.
  ///
  /// Done by hand rather than with OpacityEffect: that effect requires the
  /// component to be an OpacityProvider, which anything painting straight onto
  /// the canvas is not, and it throws at the moment of the very first pop.
  double _fade = 1;
  static const double _popSeconds = 0.18;

  @override
  void update(double dt) {
    super.update(dt);
    _bob += dt * 2.6;
    if (taken && _fade > 0) {
      _fade = (_fade - dt / _popSeconds).clamp(0.0, 1.0);
    }
  }

  int _alpha(double opacity) => (255 * opacity * _fade).round().clamp(0, 255);

  @override
  void render(Canvas canvas) {
    final lift = sin(_bob) * 4;
    final c = Offset(size.x / 2, size.y / 2 + lift);
    final r = size.x / 2;

    // Shadow stays put while the jelly bobs, which is what sells the hop.
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(c.dx, size.y - 4),
        width: r * 1.5,
        height: r * 0.5,
      ),
      Paint()..color = const Color(0xFF4A2436).withAlpha(_alpha(0.18)),
    );
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..shader = Gradient.linear(
          Offset(c.dx, c.dy - r),
          Offset(c.dx, c.dy + r),
          [
            hue.withAlpha(_alpha(1)),
            Color.lerp(hue, const Color(0xFF6E2B47), 0.45)!.withAlpha(_alpha(1)),
          ],
        ),
    );
    // A single highlight reads as gloss; two read as a diagram.
    canvas.drawCircle(
      Offset(c.dx - r * 0.3, c.dy - r * 0.34),
      r * 0.24,
      Paint()..color = const Color(0xFFFFFFFF).withAlpha(_alpha(0.55)),
    );
  }

  /// Swells and fades, then removes itself once the pop has been seen.
  void collect() {
    taken = true;
    add(
      ScaleEffect.to(
        Vector2.all(1.5),
        EffectController(duration: _popSeconds, curve: Curves.easeOut),
        onComplete: removeFromParent,
      ),
    );
  }
}

/// The second stage: clear it by walking, not by tapping the targets.
///
/// The first stage asks the player to hit things where they appear. This one
/// asks them to go somewhere, which is a different verb with the same single
/// finger — one tap sets a destination and the character does the rest. No
/// aiming, no dexterity, nothing to hold down.
class StrollScene extends SceneComponent with TapCallbacks {
  static const int jellyCount = 8;
  static const int pointsPerJelly = 15;

  /// The strip she can stand in. Jellies are placed inside it so none of them
  /// is ever behind the HUD or under the quit button.
  static const double _fieldTop = 300;
  static const double _fieldBottom = Design.height - 260;

  late final Player _player;
  late final TextComponent _leftLabel;
  final List<_Jelly> _jellies = [];

  int _score = 0;
  int _collected = 0;
  bool _ending = false;

  @override
  SceneId get id => SceneId.stroll;

  @override
  Future<void> buildScene() async {
    await add(
      GradientBackground(
        top: const Color(0xFF1B2A4A),
        bottom: const Color(0xFF0B1220),
      ),
    );

    _player = Player(
      position: Vector2(Design.width / 2, (_fieldTop + _fieldBottom) / 2),
    );
    await add(_player);

    // A fixed seed would make every run identical; a fresh one makes the stage
    // worth replaying. Positions are still constrained to the walkable strip.
    final random = Random();
    const hues = [
      Color(0xFFFF8FB8),
      Color(0xFFFFC46B),
      Color(0xFF8FD6B5),
      Color(0xFF9DB8FF),
    ];
    for (var i = 0; i < jellyCount; i++) {
      // Rejection sampling, capped so a cramped field can never spin forever.
      // Without it a jelly can land on the starting spot and be collected
      // before the player has touched anything.
      var spot = _randomSpot(random);
      for (var tries = 0; tries < 40; tries++) {
        if (_isClear(spot)) break;
        spot = _randomSpot(random);
      }
      final jelly = _Jelly(position: spot, hue: hues[i % hues.length]);
      _jellies.add(jelly);
      await add(jelly);
    }

    _leftLabel = TextComponent(
      text: '남은 젤리 $jellyCount',
      anchor: Anchor.topRight,
      position: Vector2(Design.width - Design.margin, 28),
      priority: 10,
      textRenderer: AppText.paint(size: 34, color: const Color(0xFFF0B34A)),
    );
    await add(_leftLabel);

    await add(
      TextComponent(
        text: '가고 싶은 곳을 톡 누르면 걸어가요',
        anchor: Anchor.center,
        position: Vector2(Design.width / 2, Design.height - 210),
        priority: 10,
        textRenderer: AppText.paint(size: 26, color: const Color(0x66C8D2E0)),
      ),
    );

    await add(
      Button(
        id: 'quit_stroll',
        label: '그만하기',
        size: Vector2(260, 84),
        position: Vector2(Design.width / 2, Design.height - Design.margin - 42),
        onPressed: _confirmQuit,
      ),
    );
  }

  /// Far enough from the start that the stage cannot collect itself, and far
  /// enough from its neighbours that two jellies are two things rather than one
  /// blob the player pops in a single step.
  bool _isClear(Vector2 spot) {
    if (spot.distanceTo(_player.position) <= _Jelly.reach * 2.2) return false;
    for (final other in _jellies) {
      if (spot.distanceTo(other.position) <= 84) return false;
    }
    return true;
  }

  Vector2 _randomSpot(Random random) => Vector2(
    Design.margin +
        40 +
        random.nextDouble() * (Design.width - Design.margin * 2 - 80),
    _fieldTop + random.nextDouble() * (_fieldBottom - _fieldTop),
  );

  @override
  Future<void> onEnterScene() async {
    await frame.audio.playBgm(GameAudio.bgmPlay);
    // No GameStarted: the run began in the previous stage and is still the same
    // run. Announcing a start here would bump the run counter mid-run.
    _score = frame.session.carriedScore;
  }

  /// Anywhere in the field is a destination. The buttons sit above this in
  /// priority, so a tap on one never also sends her walking under it.
  @override
  void onTapUp(TapUpEvent event) {
    if (_ending || hasModal) return;
    final p = event.localPosition;
    _player.walkTo(
      Vector2(
        p.x.clamp(Design.margin, Design.width - Design.margin),
        p.y.clamp(_fieldTop, _fieldBottom),
      ),
    );
  }

  @override
  bool containsLocalPoint(Vector2 point) => true;

  @override
  void update(double dt) {
    super.update(dt);
    if (_ending || hasModal) return;

    for (final jelly in _jellies) {
      if (jelly.taken) continue;
      if (jelly.position.distanceTo(_player.position) > _Jelly.reach) continue;

      jelly.collect();
      _collected++;
      _score += pointsPerJelly;
      _leftLabel.text = '남은 젤리 ${jellyCount - _collected}';
      frame.audio.pop();
      // Every jelly is one step further up the ladder. Nothing to break the
      // chain here — the reward for a tidy route is that it keeps rising.
      frame.audio.combo(_collected - 1);
      bus.emit(ScoreChanged(_score));
    }

    if (_collected >= jellyCount) _finish(GameOutcome.cleared);
  }

  void _confirmQuit() {
    if (hasModal) return;
    frame.settings.tapFeedback();
    _player.stop();
    openModal(
      ConfirmDialog(
        title: '그만할까요?',
        message: '지금 나가면 모은 젤리는 사라져요.',
        confirmLabel: '나갈래요',
        cancelLabel: '더 할래요',
        confirmTone: ModalTone.depart,
        onConfirm: () {
          closeModal();
          _finish(GameOutcome.quit);
        },
        onCancel: closeModal,
      ),
    );
  }

  void _finish(GameOutcome outcome) {
    if (_ending) return;
    _ending = true;
    _player.stop();
    bus.emit(GameEnded(outcome: outcome, score: _score));
    if (outcome == GameOutcome.cleared) frame.audio.cleared();
    goTo(SceneId.gameEnd);
  }
}
