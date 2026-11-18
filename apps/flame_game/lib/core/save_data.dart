import 'progression.dart';

/// Everything the player has earned, in one object.
///
/// Deliberately one object rather than a spread of keys. A save that is written
/// field by field can be caught half-updated by a crash — level up, then the
/// process dies before the reward lands, and the player is a level higher with
/// nothing to show for it. One object is written in one atomic go or not at all.
///
/// Device *settings* deliberately stay in [GameSettings]/shared_preferences.
/// They answer a different question — how this phone should behave — and would
/// follow the wrong thing if they ever travelled with a player's progress.
class SaveData {
  SaveData({
    this.totalXp = 0,
    this.jelly = 0,
    this.highScore = 0,
    this.runs = 0,
    Set<String>? owned,
    this.equipped = Costumes.starter,
    Map<String, int>? items,
    this.boostRunsLeft = 0,
  }) : owned = owned ?? {Costumes.starter},
       items = items ?? {};

  /// Cumulative, never spent. Level is *derived* from it rather than stored
  /// beside it, so the two can never disagree — which is the usual way a save
  /// ends up claiming level 7 with level 3's experience.
  int totalXp;

  /// Soft currency. Earned by playing, spent in the shop.
  int jelly;

  int highScore;
  int runs;

  final Set<String> owned;
  String equipped;

  /// Consumables the player holds, by id.
  final Map<String, int> items;

  /// Runs still covered by an active experience booster.
  int boostRunsLeft;

  int get level => Progression.levelFor(totalXp);

  // ── serialisation ─────────────────────────────────────────────────────────

  /// Bumped whenever the shape changes, so [fromJson] knows what it is reading.
  static const int currentVersion = 1;

  Map<String, Object?> toJson() => {
    'version': currentVersion,
    'totalXp': totalXp,
    'jelly': jelly,
    'highScore': highScore,
    'runs': runs,
    'owned': owned.toList()..sort(),
    'equipped': equipped,
    'items': items,
    'boostRunsLeft': boostRunsLeft,
  };

  /// Reads a save, tolerating anything.
  ///
  /// Every field falls back to a default rather than throwing. A save file is
  /// the one input that is guaranteed to be older than the code reading it, and
  /// losing a player's progress to a missing key added in a later version is
  /// the worst possible trade.
  factory SaveData.fromJson(Map<String, Object?> json) {
    int asInt(String key, [int fallback = 0]) {
      final v = json[key];
      return v is int ? v : (v is num ? v.toInt() : fallback);
    }

    final ownedRaw = json['owned'];
    final owned = <String>{
      Costumes.starter,
      if (ownedRaw is List)
        for (final e in ownedRaw)
          if (e is String) e,
    };

    final itemsRaw = json['items'];
    final items = <String, int>{
      if (itemsRaw is Map)
        for (final entry in itemsRaw.entries)
          if (entry.key is String && entry.value is int)
            entry.key as String: entry.value as int,
    };

    final equipped = json['equipped'];
    return SaveData(
      totalXp: asInt('totalXp'),
      jelly: asInt('jelly'),
      highScore: asInt('highScore'),
      runs: asInt('runs'),
      owned: owned,
      // A costume that is no longer owned — or no longer exists, because a
      // later build removed it — must not leave the player with nothing on.
      equipped: equipped is String && owned.contains(equipped)
          ? equipped
          : Costumes.starter,
      items: items,
      boostRunsLeft: asInt('boostRunsLeft'),
    );
  }
}
