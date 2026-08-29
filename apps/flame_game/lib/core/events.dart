import 'scene_id.dart';

/// Base type for everything that travels on the EventBus.
///
/// `sealed` gives exhaustiveness: a `switch` over GameEvent stops compiling the
/// day someone adds an event and forgets to handle it. Dart scopes sealing to
/// the library, so the whole catalogue lives in this one file by design.
sealed class GameEvent {
  const GameEvent();

  /// Short label for logs and the debug overlay.
  String get label => runtimeType.toString();
}

// ── navigation ────────────────────────────────────────────────────────────────

/// "Somebody should take us to [target]." An intent, not a command — the emitter
/// does not know or care who performs the switch.
final class SceneRequested extends GameEvent {
  const SceneRequested(this.target);

  final SceneId target;

  @override
  String get label => 'SceneRequested(${target.name})';
}

/// Emitted by the scene manager once a switch has actually happened.
final class SceneChanged extends GameEvent {
  const SceneChanged({required this.from, required this.to});

  final SceneId? from;
  final SceneId to;

  @override
  String get label => 'SceneChanged(${from?.name ?? '-'} > ${to.name})';
}

// ── gameplay ──────────────────────────────────────────────────────────────────

final class GameStarted extends GameEvent {
  const GameStarted();
}

/// A target was tapped out of existence. The actor announces the hit; the score
/// system decides what it is worth to the score. Neither knows the other exists.
final class TargetPopped extends GameEvent {
  const TargetPopped(this.points);

  final int points;

  @override
  String get label => 'TargetPopped(+$points)';
}

final class ScoreChanged extends GameEvent {
  const ScoreChanged(this.score);

  final int score;

  @override
  String get label => 'ScoreChanged($score)';
}

/// How a run finished.
enum GameOutcome { cleared, failed, quit }

final class GameEnded extends GameEvent {
  const GameEnded({required this.outcome, required this.score});

  final GameOutcome outcome;
  final int score;

  @override
  String get label => 'GameEnded(${outcome.name}, $score)';
}

// ── ui ────────────────────────────────────────────────────────────────────────

/// A button reports that it was pressed and nothing more. What a press *means*
/// is decided by the scene that owns it, which is why one Button class serves
/// every screen without a single subclass.
final class ButtonPressed extends GameEvent {
  const ButtonPressed(this.id, {this.sound});

  final String id;

  /// What this particular button should sound like, if not the default click.
  ///
  /// The click is played once, centrally, by whoever listens for this event —
  /// which means a button whose handler *also* played a sound fired two at
  /// once, and two UI sounds landing together is heard as a glitch rather than
  /// as two sounds. Declaring the exception here keeps it one sound per press.
  final String? sound;

  @override
  String get label => 'ButtonPressed($id)';
}
