/// Levels, what they cost, and what they hand back.
///
/// The whole curve lives here as data. Tuning a free-to-play game means moving
/// these numbers a dozen times, and every one of them being in one file is the
/// difference between a tuning pass and an archaeology expedition.
class Progression {
  const Progression._();

  /// Experience to get from [level] to the next one.
  ///
  /// Linear growth rather than exponential. An exponential curve is how a
  /// casual game quietly becomes a job around level 15 — and this one gates
  /// costumes, not power, so there is nothing to protect by slowing people down.
  static int xpToAdvance(int level) => 120 + 70 * (level - 1);

  /// Cumulative experience needed to *be* [level].
  static int xpForLevel(int level) {
    var total = 0;
    for (var l = 1; l < level; l++) {
      total += xpToAdvance(l);
    }
    return total;
  }

  /// The level a given lifetime total buys.
  static int levelFor(int totalXp) {
    var level = 1;
    var spent = 0;
    while (true) {
      final next = spent + xpToAdvance(level);
      if (totalXp < next) return level;
      spent = next;
      level++;
      // A run cannot realistically reach this, but an edited save can, and an
      // unbounded loop on bad input is a hang rather than a bug report.
      if (level >= 999) return level;
    }
  }

  /// How far through the current level a total sits, 0..1.
  static double progressWithin(int totalXp) {
    final level = levelFor(totalXp);
    final floor = xpForLevel(level);
    final need = xpToAdvance(level);
    return need <= 0 ? 0 : ((totalXp - floor) / need).clamp(0.0, 1.0);
  }

  // ── what a run is worth ───────────────────────────────────────────────────

  /// Experience for a finished run.
  ///
  /// Score-proportional with a floor, so a bad run still moves the bar. A run
  /// that visibly earns nothing teaches the player that trying was pointless.
  static int xpForRun({required int score, required bool cleared}) {
    final base = 20 + score ~/ 4;
    return cleared ? (base * 1.5).round() : base;
  }

  /// Soft currency for a finished run.
  static int jellyForRun({required int score, required bool cleared}) {
    final base = 5 + score ~/ 20;
    return cleared ? base * 2 : base;
  }

  /// Currency handed over on reaching [level]. Levels have to pay out something
  /// the player can spend, or levelling is a number that does nothing.
  static int levelUpJelly(int level) => 40 + 10 * level;
}

/// Costume ids. Strings rather than an enum because they are written into the
/// save file, and an enum's ordinal would silently reassign every costume the
/// day one is inserted in the middle.
class Costumes {
  const Costumes._();

  static const String starter = 'schoolgirl_2';
  static const String navy = 'schoolgirl_1';
  static const String cardigan = 'schoolgirl_3';

  static const List<CostumeInfo> all = [
    CostumeInfo(
      id: starter,
      name: '기본 교복',
      sheetPrefix: 'schoolgirl',
      price: 0,
      levelRequired: 1,
    ),
    CostumeInfo(
      id: navy,
      name: '남색 교복',
      sheetPrefix: 'schoolgirl1',
      price: 300,
      levelRequired: 3,
    ),
    CostumeInfo(
      id: cardigan,
      name: '가디건',
      sheetPrefix: 'schoolgirl3',
      price: 600,
      levelRequired: 6,
    ),
  ];

  static CostumeInfo byId(String id) =>
      all.firstWhere((c) => c.id == id, orElse: () => all.first);
}

class CostumeInfo {
  const CostumeInfo({
    required this.id,
    required this.name,
    required this.sheetPrefix,
    required this.price,
    required this.levelRequired,
  });

  final String id;
  final String name;

  /// Asset name stem: `character/<sheetPrefix>_walk.png` and friends.
  final String sheetPrefix;

  /// In jelly. Zero means it was never for sale.
  final int price;

  /// Locked until the player is at least this level. Levels gate *looks*, never
  /// power — a booster sold for money must never buy an advantage in a run.
  final int levelRequired;
}

/// Consumables. These are what a player can spend real money on to level faster.
class Items {
  const Items._();

  /// Doubles experience for the next few runs.
  static const String xpBoost = 'xp_boost';

  /// One extra life, offered at the moment a run ends.
  static const String revive = 'revive';

  static const List<ItemInfo> all = [
    ItemInfo(
      id: xpBoost,
      name: '말랑 사탕',
      description: '다음 5판 동안 경험치 2배',
      price: 250,
      runs: 5,
    ),
    ItemInfo(
      id: revive,
      name: '하트 사탕',
      description: '쓰러졌을 때 하트 하나를 채워요',
      price: 150,
      runs: 0,
    ),
  ];

  static ItemInfo byId(String id) => all.firstWhere((i) => i.id == id);
}

class ItemInfo {
  const ItemInfo({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.runs,
  });

  final String id;
  final String name;
  final String description;

  /// In jelly. Real-money bundles buy jelly; jelly buys these. One currency
  /// between money and effect keeps every price in one place.
  final int price;

  /// How many runs the effect lasts, for the ones that last.
  final int runs;
}
