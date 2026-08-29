import 'dart:math';
import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/events.dart';

import '../core/design.dart';
import '../core/events.dart';
import '../core/game_audio.dart';
import '../core/scene.dart';
import '../core/scene_id.dart';
import '../core/typography.dart';
import '../ui/button.dart';
import '../ui/modal_card.dart';
import '../ui/swipe_trail.dart';
import '../world/background.dart';
import '../world/squish_target.dart';

/// Stage one: things are thrown up from below and you squish them by swiping.
///
/// Chosen over tapping deliberately. A tap is a yes/no event — you hit it or
/// you did not — while a swipe is continuous, so one gesture can take three
/// things at once and the player feels the difference between a lucky poke and
/// a good line. It is also the mechanic that reads in a single screenshot,
/// which is most of what a game with no marketing budget has.
class SquishScene extends SceneComponent with DragCallbacks {
  /// Points needed to clear.
  static const int targetScore = 300;

  /// Base value; a swipe that takes several in one line is worth more per item.
  static const int pointsPerSquish = 20;

  /// Misses allowed. Three is the genre convention and, more usefully, it is
  /// small enough that the player feels each one.
  static const int lives = 3;

  /// Seconds between throws at the start and at full speed, and how long it
  /// takes to travel between the two.
  static const double _launchSlow = 0.95;
  static const double _launchFast = 0.42;
  static const double _rampSeconds = 45;

  static const List<Color> _hues = [
    Color(0xFFFF8FB8),
    Color(0xFFFFC46B),
    Color(0xFF8FD6B5),
    Color(0xFF9DB8FF),
    Color(0xFFD79DFF),
  ];

  final Random _random = Random();
  final List<SquishTarget> _targets = [];

  late final SwipeTrail _trail;
  late final TextComponent _scoreLabel;
  late final _Hearts _hearts;

  int _score = 0;
  int _missed = 0;
  double _sinceLaunch = 0;
  double _elapsed = 0;

  /// Squishes in the current swipe. Reset when the finger lifts, which is what
  /// makes a combo a *line* rather than a running total.
  int _comboThisSwipe = 0;

  bool _ending = false;

  @override
  SceneId get id => SceneId.game;

  @override
  Future<void> buildScene() async {
    await add(
      GradientBackground(
        top: const Color(0xFF2A1B3D),
        bottom: const Color(0xFF120B1C),
      ),
    );

    _scoreLabel = TextComponent(
      text: '0 / $targetScore',
      anchor: Anchor.topRight,
      position: Vector2(Design.width - Design.margin, 28),
      priority: 10,
      textRenderer: AppText.paint(size: 40, color: const Color(0xFFF0B34A)),
    );
    // Under the score rather than opposite it: the top-left corner belongs to
    // the developer overlay, and hearts drawn behind a debug panel are hearts
    // nobody can read.
    _hearts = _Hearts(
      total: lives,
      position: Vector2(
        Design.width - Design.margin - _Hearts.widthFor(lives),
        92,
      ),
      priority: 10,
    );
    await addAll([_scoreLabel, _hearts]);

    await add(
      TextComponent(
        text: '손가락으로 쓱 그어서 터뜨려요',
        anchor: Anchor.center,
        position: Vector2(Design.width / 2, Design.height - 210),
        priority: 10,
        textRenderer: AppText.paint(size: 26, color: const Color(0x66C8D2E0)),
      ),
    );

    await add(
      Button(
        id: 'quit_run',
        label: '그만하기',
        size: Vector2(260, 84),
        position: Vector2(Design.width / 2, Design.height - Design.margin - 42),
        onPressed: _confirmQuit,
      ),
    );

    // Above the targets, below the HUD: the streak should pass over what it is
    // cutting and under the numbers.
    _trail = SwipeTrail(priority: 5);
    await add(_trail);
  }

  @override
  Future<void> onEnterScene() async {
    await frame.audio.playBgm(GameAudio.bgmPlay);
    bus.emit(const GameStarted());
  }

  /// The whole screen is swipeable.
  ///
  /// Not optional: a bare [Component] answers false here, so without this the
  /// scene never receives a drag at all and the entire game is inert. It costs
  /// nothing — the buttons sit above this and consume their own presses first.
  @override
  bool containsLocalPoint(Vector2 point) => true;

  // ── swiping ───────────────────────────────────────────────────────────────

  /// The finger's previous position, in scene coordinates.
  Vector2? _last;

  @override
  void onDragStart(DragStartEvent event) {
    super.onDragStart(event);
    _last = event.localPosition.clone();
    _comboThisSwipe = 0;
    _trail.addPoint(event.localPosition);
  }

  @override
  void onDragUpdate(DragUpdateEvent event) {
    if (_ending || hasModal) return;
    final now = event.localEndPosition;
    _trail.addPoint(now);

    final from = _last;
    _last = now.clone();
    if (from == null) return;

    // A resting finger must not cut. Requiring real movement also means the
    // segment below has a direction, which is what the split is oriented by.
    final travel = now - from;
    if (travel.length < 12) return;

    for (final target in List<SquishTarget>.from(_targets)) {
      if (target.isBurst) continue;
      if (!_segmentHits(from, now, target.position, target.radius)) continue;
      _squish(target, travel);
    }
  }

  @override
  void onDragEnd(DragEndEvent event) {
    super.onDragEnd(event);
    _last = null;
    _comboThisSwipe = 0;
  }

  @override
  void onDragCancel(DragCancelEvent event) {
    super.onDragCancel(event);
    _last = null;
    _comboThisSwipe = 0;
  }

  /// Closest-point-on-segment test.
  ///
  /// Against the segment the finger swept this frame, not against its position:
  /// at a flick's speed the finger jumps most of the screen between frames, and
  /// a point test would pass straight through everything in between.
  static bool _segmentHits(Vector2 a, Vector2 b, Vector2 centre, double radius) {
    final ab = b - a;
    final lengthSquared = ab.length2;
    if (lengthSquared == 0) return centre.distanceTo(a) <= radius;
    final t = ((centre - a).dot(ab) / lengthSquared).clamp(0.0, 1.0);
    return centre.distanceTo(a + ab * t) <= radius;
  }

  void _squish(SquishTarget target, Vector2 cut) {
    _targets.remove(target);
    for (final piece in target.burst(cut)) {
      add(piece);
    }

    // Each further squish in the same swipe is worth more, so a good line beats
    // the same number of separate pokes.
    _score += pointsPerSquish + _comboThisSwipe * 10;
    frame.audio.pop();
    frame.audio.combo(_comboThisSwipe);
    _comboThisSwipe++;

    _scoreLabel.text = '$_score / $targetScore';
    bus.emit(ScoreChanged(_score));
    if (_score >= targetScore) _finish(GameOutcome.cleared);
  }

  // ── launching ─────────────────────────────────────────────────────────────

  @override
  void update(double dt) {
    super.update(dt);
    if (_ending || hasModal) return;

    _elapsed += dt;
    _sinceLaunch += dt;
    if (_sinceLaunch >= _interval) {
      _sinceLaunch = 0;
      _launch();
    }

    for (final target in List<SquishTarget>.from(_targets)) {
      // Only once it is on the way down and fully past the edge, or a launch
      // would count as a miss the instant it left the bottom of the screen.
      if (target.velocity.y > 0 &&
          target.position.y - target.radius > Design.height) {
        _targets.remove(target);
        target.removeFromParent();
        _miss();
      }
    }
  }

  /// Throws speed up over the first minute, then holds.
  double get _interval {
    final t = (_elapsed / _rampSeconds).clamp(0.0, 1.0);
    return _launchSlow + (_launchFast - _launchSlow) * t;
  }

  void _launch() {
    final radius = 46 + _random.nextDouble() * 20;
    final x = Design.margin + _random.nextDouble() * (Design.width - Design.margin * 2);

    // Aimed loosely back toward the middle, so a throw from the edge arcs into
    // reach instead of leaving along the wall it started at.
    final drift = (Design.width / 2 - x) / (Design.width / 2);
    final target = SquishTarget(
      position: Vector2(x, Design.height + radius + 20),
      velocity: Vector2(
        drift * 120 + (_random.nextDouble() - 0.5) * 90,
        -(1650 + _random.nextDouble() * 260),
      ),
      hue: _hues[_random.nextInt(_hues.length)],
      radius: radius,
      spin: (_random.nextDouble() - 0.5) * 3.2,
    );
    _targets.add(target);
    add(target);
  }

  void _miss() {
    if (_ending) return;
    _missed++;
    _hearts.lost = _missed;
    frame.audio.failed();
    if (_missed >= lives) _finish(GameOutcome.failed);
  }

  // ── ending ────────────────────────────────────────────────────────────────

  void _confirmQuit() {
    if (hasModal) return;
    frame.settings.tapFeedback();
    openModal(
      ConfirmDialog(
        title: '그만할까요?',
        message: '지금 나가면 이번 판 점수는 사라져요.',
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

    // Clearing opens the next stage rather than the results, so no GameEnded
    // here — the run is still going.
    if (outcome == GameOutcome.cleared) {
      frame.audio.cleared();
      frame.session.carry(_score);
      goTo(SceneId.stroll);
      return;
    }

    bus.emit(GameEnded(outcome: outcome, score: _score));
    goTo(SceneId.gameEnd);
  }

  @override
  void onExitScene() {
    _targets.clear();
  }
}

/// Lives, as hearts that hollow out rather than disappear.
///
/// A row that shrinks makes the player count what is left; a row that stays put
/// and empties shows how much has been spent without any counting.
class _Hearts extends PositionComponent {
  _Hearts({required this.total, required super.position, super.priority});

  final int total;
  int lost = 0;

  static const double _size = 30;
  static const double _gap = 12;

  static double widthFor(int total) => total * (_size + _gap) - _gap;

  @override
  void render(Canvas canvas) {
    for (var i = 0; i < total; i++) {
      final full = i < total - lost;
      final left = i * (_size + _gap);
      _heart(
        canvas,
        Offset(left + _size / 2, _size / 2),
        _size / 2,
        full
            ? (Paint()..color = const Color(0xFFFF6B9D))
            : (Paint()
                ..style = PaintingStyle.stroke
                ..strokeWidth = 2.5
                ..color = const Color(0x59FF6B9D)),
      );
    }
  }

  /// Two lobes and a point — enough of a heart at 30px, and cheaper than a
  /// bezier nobody can see the difference in at this size.
  static void _heart(Canvas canvas, Offset c, double r, Paint paint) {
    final path = Path()
      ..moveTo(c.dx, c.dy + r * 0.95)
      ..cubicTo(
        c.dx - r * 1.7, c.dy - r * 0.25,
        c.dx - r * 0.55, c.dy - r * 1.25,
        c.dx, c.dy - r * 0.42,
      )
      ..cubicTo(
        c.dx + r * 0.55, c.dy - r * 1.25,
        c.dx + r * 1.7, c.dy - r * 0.25,
        c.dx, c.dy + r * 0.95,
      )
      ..close();
    canvas.drawPath(path, paint);
  }
}
