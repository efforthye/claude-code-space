import 'dart:math';

import 'package:flame_audio/flame_audio.dart';

import 'game_settings.dart';

/// Every sound the game makes goes through here.
///
/// Everything is AAC (`.m4a`), including clips that arrived as Ogg Vorbis.
/// iOS routes audio through AVFoundation, which cannot decode Ogg at all — the
/// clips loaded without complaint and then failed at the moment of playback,
/// which read as "the button has no sound" rather than as an error. Converted
/// once here rather than shipping two formats and a platform switch.
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
  static const String select = 'ui_select.m4a';

  /// The lighter one, for incidental controls — toggles, the gear, a slider.
  static const String click = 'ui_click.m4a';

  /// Rising and unresolved, for a modal that is asking something.
  ///
  /// Nothing uses it yet: on the quit prompt it made the button sound unlike
  /// every other button, which was worse than the shade of meaning was worth.
  /// Kept because it is the right sound for a prompt the player did not ask
  /// for — a timer running out, a life lost — which this game will have.
  static const String ask = 'ui_ask.m4a';

  /// Resolving, for the answer to [ask] — the pair reads as a question and a
  /// reply, which is most of why a confirm dialog feels finished.
  static const String confirm = 'ui_confirm.m4a';

  /// Falling and flat, for a run that did not go well.
  static const String error = 'ui_error.m4a';

  /// A switch flipping.
  static const String switchToggle = 'ui_switch.m4a';

  /// One notch of a slider. Short enough to fire repeatedly during a drag
  /// without turning into a buzz.
  static const String tick = 'ui_tick.m4a';

  static const List<String> _all = [
    select,
    click,
    ask,
    confirm,
    clear,
    error,
    switchToggle,
    tick,
    enter,
    leave,
  ];

  // ---- Music -------------------------------------------------------------

  /// The menu, from the moment the controls appear until something is pressed.
  static const String bgmMenu = 'bgm_menu.mp3';

  /// A round in progress.
  static const String bgmPlay = 'bgm_main.mp3';

  /// For when something is at stake.
  static const String bgmTense = 'bgm_tense.mp3';

  /// For a moment that is meant to be a treat — a draw, a reward, an opening.
  static const String bgmFun = 'bgm_fun.mp3';

  String? _track;

  /// The track that should be playing, whether or not it currently is. Muting
  /// stops the audio but must not lose the intent, or unmuting would leave the
  /// game silent with no way back.
  String? get track => _track;

  /// The pops a block makes when it bursts.
  ///
  /// Ten of them, and one is picked at random each time. A single clip repeated
  /// a few hundred times a round is the fastest way to make a game feel cheap —
  /// the ear locks onto the sameness within seconds. Soft impacts specifically:
  /// the whole point of this game is that popping things is pleasant, and the
  /// glass and metal families in the same pack are anything but.
  static const List<String> pops = [
    'impact/impactSoft_medium_000.m4a',
    'impact/impactSoft_medium_001.m4a',
    'impact/impactSoft_medium_002.m4a',
    'impact/impactSoft_medium_003.m4a',
    'impact/impactSoft_medium_004.m4a',
    'impact/impactSoft_heavy_000.m4a',
    'impact/impactSoft_heavy_001.m4a',
    'impact/impactSoft_heavy_002.m4a',
    'impact/impactSoft_heavy_003.m4a',
    'impact/impactSoft_heavy_004.m4a',
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
      await FlameAudio.audioCache.loadAll([..._all, ...comboSteps, ...pops]);
      _ready = true;
    } catch (_) {
      _ready = false;
    }
  }

  /// Asks for a track. Idempotent — asking for the one already playing does
  /// nothing, so a scene can state what it wants on entry without checking.
  Future<void> playBgm(String asset) async {
    if (_track == asset) return;
    _track = asset;
    await _syncBgm(restart: true);
  }

  Future<void> stopBgm() async {
    _track = null;
    try {
      await FlameAudio.bgm.stop();
    } catch (_) {}
  }

  /// Applies the current music level to the current intent.
  ///
  /// Called on every change to the music slider, which is why muting is a stop
  /// rather than a volume of zero: a silent track still burns battery decoding
  /// audio nobody can hear.
  Future<void> syncMusic() => _syncBgm(restart: false);

  Future<void> _syncBgm({required bool restart}) async {
    final asset = _track;
    final volume = _settings.musicVolume;
    try {
      if (asset == null || volume <= 0) {
        if (FlameAudio.bgm.isPlaying) await FlameAudio.bgm.stop();
        return;
      }
      if (restart || !FlameAudio.bgm.isPlaying) {
        await FlameAudio.bgm.play(asset, volume: volume);
      } else {
        await FlameAudio.bgm.audioPlayer.setVolume(volume);
      }
    } catch (_) {
      // Music is a nicety. A device that will not play it still plays the game.
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
  void switched() => play(switchToggle);

  /// A slider crossing a notch.
  void ticked() => play(tick);

  /// A run cleared. Deliberately the same clip as [confirm] for now — they are
  /// both "yes, that worked", and one file is one thing to get right.
  static const String clear = 'ui_clear.m4a';

  void cleared() => play(clear);

  /// Moving forward into a scene, and coming back out of one.
  static const String enter = 'ui_enter.m4a';
  static const String leave = 'ui_leave.m4a';

  void sceneEnter() => play(enter);
  void sceneLeave() => play(leave);

  /// The combo ladder: the same bell, pre-rendered a whole tone apart per step.
  ///
  /// Rendered offline rather than pitched at runtime because playback-rate APIs
  /// disagree across platforms about whether they move pitch at all — several
  /// time-stretch instead, which would make the ladder silent in effect. Eight
  /// files settle it everywhere.
  static const List<String> comboSteps = [
    'ui_combo_0.wav',
    'ui_combo_1.wav',
    'ui_combo_2.wav',
    'ui_combo_3.wav',
    'ui_combo_4.wav',
    'ui_combo_5.wav',
    'ui_combo_6.wav',
    'ui_combo_7.wav',
  ];

  /// [step] counts from zero and is clamped, so the ladder tops out rather than
  /// crashing on a long streak.
  void combo(int step) =>
      play(comboSteps[step.clamp(0, comboSteps.length - 1)]);

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
