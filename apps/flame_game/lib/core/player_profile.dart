import 'dart:async';

import 'progression.dart';
import 'save_data.dart';
import 'save_store.dart';

/// What a finished run paid out.
class RunReward {
  const RunReward({
    required this.xp,
    required this.jelly,
    required this.boosted,
    required this.levelsGained,
    required this.levelUpJelly,
    required this.newHighScore,
  });

  final int xp;
  final int jelly;

  /// Whether a booster was consumed to earn that experience.
  final bool boosted;

  final int levelsGained;
  final int levelUpJelly;
  final bool newHighScore;

  bool get leveledUp => levelsGained > 0;
}

/// The player's progress, and the only thing allowed to change it.
///
/// [SaveData] is a bag of numbers; every rule about how those numbers move
/// lives here. Scenes ask for an outcome — "this run finished with 340" — and
/// are told what it was worth. They never add experience themselves, which is
/// what stops the payout formula from being reimplemented slightly differently
/// in each of three scenes.
class PlayerProfile {
  PlayerProfile({SaveStore? store}) : _store = store ?? SaveStore();

  final SaveStore _store;
  SaveData _data = SaveData();
  Future<void>? _loading;

  /// Read-only view. Mutating it directly would skip the save.
  SaveData get data => _data;

  int get level => _data.level;
  int get totalXp => _data.totalXp;
  int get jelly => _data.jelly;
  int get highScore => _data.highScore;
  double get levelProgress => Progression.progressWithin(_data.totalXp);
  String get equippedCostume => _data.equipped;
  bool get hasBoost => _data.boostRunsLeft > 0;

  /// Fires whenever anything changes, so open UI can redraw. A shop panel that
  /// shows a stale jelly count after a purchase is worse than no shop.
  final _changes = StreamController<void>.broadcast();
  Stream<void> get changes => _changes.stream;

  Future<void> load() => _loading ??= _load();

  Future<void> _load() async {
    _data = await _store.load();
    _notify();
  }

  void _notify() {
    _store.save(_data);
    if (!_changes.isClosed) _changes.add(null);
  }

  /// Writes now rather than on the debounce. Called when a run ends, because
  /// that is when the player would most resent losing anything.
  Future<void> flush() => _store.flush();

  // ── earning ───────────────────────────────────────────────────────────────

  /// Banks a finished run and reports what it paid.
  RunReward finishRun({required int score, required bool cleared}) {
    final before = _data.level;

    var xp = Progression.xpForRun(score: score, cleared: cleared);
    final boosted = _data.boostRunsLeft > 0;
    if (boosted) {
      xp *= 2;
      _data.boostRunsLeft--;
    }

    final jelly = Progression.jellyForRun(score: score, cleared: cleared);

    _data.totalXp += xp;
    _data.jelly += jelly;
    _data.runs++;

    final newHigh = score > _data.highScore;
    if (newHigh) _data.highScore = score;

    // Every level crossed pays out, so gaining two at once is worth two
    // rewards rather than quietly one.
    final after = _data.level;
    var bonus = 0;
    for (var l = before + 1; l <= after; l++) {
      bonus += Progression.levelUpJelly(l);
    }
    _data.jelly += bonus;

    _notify();
    unawaited(flush());

    return RunReward(
      xp: xp,
      jelly: jelly,
      boosted: boosted,
      levelsGained: after - before,
      levelUpJelly: bonus,
      newHighScore: newHigh,
    );
  }

  // ── spending ──────────────────────────────────────────────────────────────

  bool canAfford(int price) => _data.jelly >= price;

  /// Adds currency. The one door real money comes through, so purchases and
  /// rewarded ads both land here rather than each touching the save.
  void grantJelly(int amount) {
    if (amount <= 0) return;
    _data.jelly += amount;
    _notify();
    unawaited(flush());
  }

  bool ownsCostume(String id) => _data.owned.contains(id);

  /// Whether the costume is buyable right now, and why not if it is not.
  String? costumeBlockedReason(CostumeInfo costume) {
    if (ownsCostume(costume.id)) return null;
    if (level < costume.levelRequired) return '레벨 ${costume.levelRequired} 필요';
    if (!canAfford(costume.price)) return '젤리 부족';
    return null;
  }

  bool buyCostume(CostumeInfo costume) {
    if (ownsCostume(costume.id)) return false;
    if (level < costume.levelRequired) return false;
    if (!canAfford(costume.price)) return false;
    _data.jelly -= costume.price;
    _data.owned.add(costume.id);
    _data.equipped = costume.id;
    _notify();
    unawaited(flush());
    return true;
  }

  bool equipCostume(String id) {
    if (!ownsCostume(id) || _data.equipped == id) return false;
    _data.equipped = id;
    _notify();
    unawaited(flush());
    return true;
  }

  int itemCount(String id) => _data.items[id] ?? 0;

  bool buyItem(ItemInfo item) {
    if (!canAfford(item.price)) return false;
    _data.jelly -= item.price;
    _data.items[item.id] = itemCount(item.id) + 1;
    _notify();
    unawaited(flush());
    return true;
  }

  /// Spends one, if there is one. Returns whether it was spent, so a caller
  /// never has to check the count and then decrement — the pair of those is
  /// where an item gets consumed twice.
  bool useItem(String id) {
    final held = itemCount(id);
    if (held <= 0) return false;
    _data.items[id] = held - 1;

    if (id == Items.xpBoost) {
      _data.boostRunsLeft += Items.byId(id).runs;
    }

    _notify();
    unawaited(flush());
    return true;
  }

  Future<void> dispose() async {
    await flush();
    await _changes.close();
  }
}
