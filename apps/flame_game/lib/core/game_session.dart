import 'events.dart';

/// State that outlives a single scene.
///
/// Scenes are created fresh on every entry, so anything that must survive a
/// transition — the score the end screen shows, the best run so far — lives
/// here instead. Fields are private with read-only getters: the only way to
/// change a session is through a method that says what happened.
class GameSession {
  int _lastScore = 0;
  int _highScore = 0;
  GameOutcome? _lastOutcome;
  int _runCount = 0;
  int _carried = 0;

  /// Points banked by earlier stages of the run still in progress.
  ///
  /// A run is no longer one scene: clearing the first stage leads into the
  /// second rather than to the results, and a score that reset at the door
  /// would tell the player their first stage did not count.
  int get carriedScore => _carried;

  int get lastScore => _lastScore;
  int get highScore => _highScore;
  GameOutcome? get lastOutcome => _lastOutcome;
  int get runCount => _runCount;

  void beginRun() {
    _runCount++;
    _lastScore = 0;
    _lastOutcome = null;
  }

  /// Hands the current stage's total to the next one.
  void carry(int score) => _carried = score;

  void recordEnd({required GameOutcome outcome, required int score}) {
    _lastOutcome = outcome;
    _lastScore = score;
    if (score > _highScore) _highScore = score;
    // The run is over however it ended, so nothing is owed to a next stage.
    _carried = 0;
  }

  void resetAll() {
    _lastScore = 0;
    _highScore = 0;
    _lastOutcome = null;
    _runCount = 0;
    _carried = 0;
  }
}
