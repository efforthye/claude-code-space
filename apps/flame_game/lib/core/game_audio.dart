import 'dart:math';

import 'package:flame_audio/flame_audio.dart';

import 'game_settings.dart';

/// Every sound the game makes goes through here.
///
/// Two reasons it is a class rather than scattered `FlameAudio.play` calls.
/// One, the volume slider has to mean something: the level is read at the
/// moment of playback, so a change applies to the very next sound without
/// anything having to be notified. Two, the file names live in exactly one
/// place — swapping a click for a different one is a single edit, and no
/// caller ever names an asset.
class GameAudio {
  GameAudio(this._settings);

  final GameSettings _settings;

  /// The heavier of the two, for things the player deliberately chose:
  /// GAME START, a modal's confirm, closing a panel.
  static const String select = 'ui_select.ogg';

  /// The lighter one, for incidental controls — toggles, the gear, a slider.
  static const String click = 'ui_click.ogg';

  /// Rising and unresolved, for a modal that is asking something. The shape of
  /// the sound does the work a label would otherwise have to.
  static const String ask = 'ui_ask.ogg';

  /// Resolving, for the answer to [ask] — the pair reads as a question and a
  /// reply, which is most of why a confirm dialog feels finished.
  static const String confirm = 'ui_confirm.ogg';

  /// Falling and flat, for a run that did not go well.
  static const String error = 'ui_error.ogg';

  /// A switch flipping.
  static const String toggle = 'ui_switch.ogg';

  /// One notch of a slider. Short enough to fire repeatedly during a drag
  /// without turning into a buzz.
  static const String tick = 'ui_tick.ogg';

  static const List<String> _all = [
    select,
    click,
    ask,
    confirm,
    error,
    toggle,
    tick,
  ];

  /// The pops a block makes when it bursts.
  ///
  /// Ten of them, and one is picked at random each time. A single clip repeated
  /// a few hundred times a round is the fastest way to make a game feel cheap —
  /// the ear locks onto the sameness within seconds. Soft impacts specifically:
  /// the whole point of this game is that popping things is pleasant, and the
  /// glass and metal families in the same pack are anything but.
  static const List<String> pops = [
    'impact/impactSoft_medium_000.ogg',
    'impact/impactSoft_medium_001.ogg',
    'impact/impactSoft_medium_002.ogg',
    'impact/impactSoft_medium_003.ogg',
    'impact/impactSoft_medium_004.ogg',
    'impact/impactSoft_heavy_000.ogg',
    'impact/impactSoft_heavy_001.ogg',
    'impact/impactSoft_heavy_002.ogg',
    'impact/impactSoft_heavy_003.ogg',
    'impact/impactSoft_heavy_004.ogg',
  ];

  /// Draws from a shuffled bag rather than calling random each time. Plain
  /// random repeats itself often enough to be audible — two identical pops in a
  /// row sounds like a bug, however fair the coin was.
  final List<String> _bag = [];
  final Random _random = Random();

  bool _ready = false;

  /// Decodes and caches the clips up front.
  ///
  /// A sound loaded on first use arrives after the tap that asked for it, which
  /// is worse than no sound at all — the player reads the delay as lag in the
  /// button. Failure is survivable: the game is silent, not broken.
  Future<void> preload() async {
    try {
      await FlameAudio.audioCache.loadAll([..._all, ...pops]);
      _ready = true;
    } catch (_) {
      _ready = false;
    }
  }

  void play(String asset) {
    if (!_ready) return;
    final volume = _settings.soundVolume;
    // Muted is a level of zero, so there is no second condition to check —
    // and no chance of the flag and the level disagreeing.
    if (volume <= 0) return;
    FlameAudio.play(asset, volume: volume);
  }

  /// A press on something the player aimed at.
  void tapSelect() => play(select);

  /// A press on a control they are adjusting.
  void tapClick() => play(click);

  /// A modal opening with a question in it.
  void askOpen() => play(ask);

  /// The player answering it.
  void confirmed() => play(confirm);

  /// Something did not work out.
  void failed() => play(error);

  /// A switch flipping.
  void switched() => play(toggle);

  /// A slider crossing a notch.
  void ticked() => play(tick);

  /// A block bursting. Never the same clip twice in a row.
  void pop() {
    if (_bag.isEmpty) {
      _bag.addAll(pops);
      _bag.shuffle(_random);
      // Drawing is from the end, so it is the *last* entry that would repeat
      // across a refill — the exact repetition the bag exists to prevent.
      if (_bag.length > 1 && _bag.last == _lastPop) {
        _bag.insert(0, _bag.removeLast());
      }
    }
    _lastPop = _bag.removeLast();
    play(_lastPop!);
  }

  String? _lastPop;
}
