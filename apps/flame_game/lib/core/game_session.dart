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

  int get lastScore => _lastScore;
  int get highScore => _highScore;
  GameOutcome? get lastOutcome => _lastOutcome;
  int get runCount => _runCount;

  void beginRun() {
    _runCount++;
    _lastScore = 0;
    _lastOutcome = null;
  }

  void recordEnd({required GameOutcome outcome, required int score}) {
    _lastOutcome = outcome;
    _lastScore = score;
    if (score > _highScore) _highScore = score;
  }

  void resetAll() {
    _lastScore = 0;
    _highScore = 0;
    _lastOutcome = null;
    _runCount = 0;
  }
}
