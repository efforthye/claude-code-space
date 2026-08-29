import 'dart:ui';

import 'package:flame/components.dart';

import '../core/design.dart';
import '../core/events.dart';
import '../core/game_audio.dart';
import '../core/scene.dart';
import '../core/scene_id.dart';
import '../core/typography.dart';
import '../systems/game_system.dart';
import '../ui/button.dart';
import '../ui/modal_card.dart';
import '../world/background.dart';
import '../world/game_object.dart';

/// The play scene.
///
/// Rules, stated once: orbs appear on a timer, tapping one is worth points, and
/// the run ends when the score reaches [targetScore] (cleared) or too many orbs
/// pile up unpopped (failed).
///
/// Note what this class does *not* contain: no scoring maths, no spawn timing.
/// Those live in [GameSystem] implementations it steps without knowing what they
/// do, so this stays about composition and stays short as the game grows.
class GameScene extends SceneComponent {
  /// Points needed to clear. Ten orbs at ten points each.
  static const int targetScore = 100;

  /// Lose the run when this many orbs are alive at once.
  static const int crowdLimit = 8;

  final List<GameSystem> _systems = [];
  late final Component _world;
  late final ScoreSystem _score;
  late final SpawnSystem _spawner;
  late final TextComponent _scoreLabel;
  late final TextComponent _crowdLabel;

  bool _ending = false;

  /// Consecutive pops, and how long the chain has left.
  ///
  /// The rising bell is most of what makes a match game feel good, and it only
  /// works if the chain can actually break — a counter that never resets is
  /// just a score with a sound attached.
  int _combo = 0;
  double _comboLeft = 0;
  static const double comboWindow = 1.4;

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

    // Orbs live in their own container so the HUD never collides with them and
    // the whole field can be cleared in one call.
    _world = Component();
    await add(_world);

    _scoreLabel = TextComponent(
      text: '0 / $targetScore',
      anchor: Anchor.topRight,
      position: Vector2(sceneSize.x - Design.margin, 28),
      priority: 10,
      textRenderer: AppText.paint(size: 40, color: const Color(0xFFF0B34A)),
    );
    _crowdLabel = TextComponent(
      text: '구슬 0 / $crowdLimit',
      anchor: Anchor.topRight,
      position: Vector2(sceneSize.x - Design.margin, 76),
      priority: 10,
      textRenderer: AppText.paint(size: 22, color: const Color(0x8899A3B5)),
    );
    await addAll([_scoreLabel, _crowdLabel]);

    await add(
      TextComponent(
        text: '구슬을 톡톡 터뜨려요',
        anchor: Anchor.center,
        position: Vector2(sceneSize.x / 2, sceneSize.y - 210),
        priority: 10,
        textRenderer: AppText.paint(size: 26, color: const Color(0x66C8D2E0)),
      ),
    );

    await add(
      Button(
        id: 'quit_run',
        label: '그만하기',
        size: Vector2(260, 84),
        position: Vector2(sceneSize.x / 2, sceneSize.y - Design.margin - 42),
        onPressed: _confirmQuit,
      ),
    );

    _score = ScoreSystem();
    _spawner = SpawnSystem(parent: _world, area: sceneSize);
    _systems
      ..add(_score)
      ..add(_spawner);
  }

  @override
  Future<void> onEnterScene() async {
    // Stated on entry rather than switched at the button, so however the player
    // got here — a fresh start, PLAY AGAIN, a future level select — the right
    // track is playing.
    await frame.audio.playBgm(GameAudio.bgmPlay);
    bus.emit(const GameStarted());
    for (final system in _systems) {
      system.onAttach(bus);
    }
    // The HUD listens rather than polls — the score system is the only owner of
    // the number and everyone else finds out the same way.
    listen<ScoreChanged>((event) {
      frame.audio.pop();
      frame.audio.combo(_combo);
      _combo++;
      _comboLeft = comboWindow;
      _scoreLabel.text = '${event.score} / $targetScore';
      if (event.score >= targetScore) _finish(GameOutcome.cleared);
    });
  }

  @override
  void update(double dt) {
    super.update(dt);
    // Frozen while a prompt is up. Asking "really quit?" and then letting the
    // orbs pile up behind it would punish the player for reading the question.
    if (_ending || hasModal) return;

    for (final system in _systems) {
      system.step(dt);
    }

    if (_comboLeft > 0) {
      _comboLeft -= dt;
      if (_comboLeft <= 0) _combo = 0;
    }

    final live = _spawner.liveTargets;
    _crowdLabel.text = '구슬 $live / $crowdLimit';
    if (live >= crowdLimit) _finish(GameOutcome.failed);
  }

  /// Quitting mid-run throws away points, so it asks first.
  void _confirmQuit() {
    if (hasModal) return;
    frame.settings.tapFeedback();
    openModal(
      ConfirmDialog(
        title: '그만할까요?',
        message: '지금 나가면 이번 판 점수는 사라져요.',
        confirmLabel: '나갈래요',
        cancelLabel: '더 할래요',
        // Walking out of a run is not an achievement, and the resolving chime
        // made it sound like one.
        confirmTone: ModalTone.depart,
        onConfirm: () {
          closeModal();
          _finish(GameOutcome.quit);
        },
        onCancel: () {
          frame.settings.tapFeedback();
          closeModal();
        },
      ),
    );
  }

  void _finish(GameOutcome outcome) {
    if (_ending) return;
    _ending = true;

    // Clearing is not the end of the run any more, it is the door to the next
    // stage — so no GameEnded here, or the results screen would appear behind
    // it and the session would record a finished run that is still going.
    if (outcome == GameOutcome.cleared) {
      frame.audio.cleared();
      frame.session.carry(_score.score);
      goTo(SceneId.stroll);
      return;
    }

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
