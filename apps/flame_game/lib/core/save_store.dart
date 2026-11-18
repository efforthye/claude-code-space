import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';

import 'save_data.dart';

/// Reads and writes the save file.
///
/// A single JSON document in the app's documents directory, not a database and
/// not a pile of preference keys. The save is read once at launch and written
/// whole on change — there is nothing to query, so a database would buy schema
/// migrations and a native dependency in exchange for nothing.
///
/// What it does buy over preferences is **atomicity**. Writes go to a temp file
/// and are renamed over the real one, and rename is atomic on every platform we
/// ship to. A crash mid-save therefore leaves either the old save or the new
/// one, never a half of each — which is exactly the failure that loses a
/// player's progress and cannot be apologised for.
///
/// It is also, unavoidably, **editable by the player.** That is fine for what
/// lives here: costumes and a soft currency. It would not be fine for anything
/// competitive or anything backed by real money, and if this game ever gets a
/// leaderboard worth cheating on, that number has to be settled by a server.
class SaveStore {
  SaveStore({this.fileName = 'mallang_save.json'});

  final String fileName;

  File? _file;
  Timer? _pending;
  SaveData? _queued;

  /// Writes are debounced. A run can change the save several times in a second
  /// — score, jelly, level, item — and each one hitting the disk is wasted I/O
  /// on the frame budget for a file nobody reads until next launch.
  static const Duration _debounce = Duration(milliseconds: 400);

  Future<File> _open() async {
    final dir = await getApplicationDocumentsDirectory();
    return _file ??= File('${dir.path}/$fileName');
  }

  /// Loads the save, or a fresh one if there is nothing readable there.
  ///
  /// Every failure returns defaults instead of throwing. A corrupt or absent
  /// save must start a new game, not prevent the game from starting.
  Future<SaveData> load() async {
    try {
      final file = await _open();
      if (!await file.exists()) return SaveData();
      final raw = await file.readAsString();
      if (raw.trim().isEmpty) return SaveData();
      final json = jsonDecode(raw);
      if (json is! Map<String, Object?>) return SaveData();
      return SaveData.fromJson(json);
    } catch (_) {
      return SaveData();
    }
  }

  /// Schedules a write. Repeated calls collapse into one.
  void save(SaveData data) {
    _queued = data;
    _pending?.cancel();
    _pending = Timer(_debounce, () => unawaited(flush()));
  }

  /// Writes immediately. Call before anything that might end the process.
  Future<void> flush() async {
    _pending?.cancel();
    _pending = null;
    final data = _queued;
    if (data == null) return;
    _queued = null;

    try {
      final file = await _open();
      final temp = File('${file.path}.tmp');
      await temp.writeAsString(jsonEncode(data.toJson()), flush: true);
      // Atomic: the save is the old one until this instant, then the new one.
      await temp.rename(file.path);
    } catch (_) {
      // Out of space, no permission, no filesystem. The session keeps its
      // progress in memory; only its persistence is lost.
    }
  }
}
