import 'dart:math' as math;

import 'package:flutter/services.dart' show HapticFeedback;
import 'package:shared_preferences/shared_preferences.dart';

/// Player preferences, kept across launches.
///
/// Volumes are levels, not switches. A player who finds the music slightly loud
/// wants it quieter, not gone, and an on/off pair throws away the only setting
/// most of them actually want to change. Muting is still one tap — the speaker
/// icon — and remembers the level it muted from, so unmuting restores it rather
/// than jumping to full.
///
/// Writes are fire-and-forget: a drag must feel instant, and a preference that
/// fails to save is not worth blocking one over. The in-memory value is the
/// truth for the running session; storage catches up.
class GameSettings {
  static const _kSound = 'settings.sound.volume';
  static const _kMusic = 'settings.music.volume';
  static const _kHaptics = 'settings.haptics';

  /// Where an unmute lands when nothing better is remembered.
  static const double defaultVolume = 0.8;

  SharedPreferences? _store;
  Future<void>? _loading;

  /// Completes when stored values have been read. Nothing needs to wait for it
  /// — the defaults are live from the first frame — but a test can.
  Future<void> get ready => _loading ?? Future<void>.value();

  double _soundVolume = defaultVolume;
  double _musicVolume = defaultVolume;
  bool _haptics = true;

  /// Levels to restore when a mute is lifted.
  double _soundBeforeMute = defaultVolume;
  double _musicBeforeMute = defaultVolume;

  /// Called whenever the music level changes.
  ///
  /// Sound effects read the level at playback, so they need nothing. Music is
  /// already playing when the slider moves, so something has to reach in and
  /// change it — a callback rather than a poll, because a slider drag is rare
  /// and a poll would run every frame forever to catch it.
  void Function()? onMusicChanged;

  /// Reads stored values.
  ///
  /// Deliberately *not* awaited by the game's startup: this crosses a platform
  /// channel, and holding the first frame hostage to a disk read is how a game
  /// gets a blank launch. The in-memory defaults are usable immediately and are
  /// replaced in place a few milliseconds later. Safe to fail — a storage error
  /// costs the player their preferences, not the game.
  Future<void> load() => _loading ??= _read();

  Future<void> _read() async {
    try {
      final store = await SharedPreferences.getInstance();
      _store = store;
      _soundVolume = _clamp(store.getDouble(_kSound) ?? _soundVolume);
      _musicVolume = _clamp(store.getDouble(_kMusic) ?? _musicVolume);
      _haptics = store.getBool(_kHaptics) ?? _haptics;
      // A player who quit muted should not have unmuting drop them to silence.
      if (_soundVolume > 0) _soundBeforeMute = _soundVolume;
      if (_musicVolume > 0) _musicBeforeMute = _musicVolume;
      // Stored preferences arrive after the first frame, so anything already
      // playing at the default level has to be corrected to the saved one.
      onMusicChanged?.call();
    } catch (_) {
      // No storage on this platform or it failed to open. Defaults stand.
    }
  }

  static double _clamp(double v) => v.isNaN ? 0 : math.min(1, math.max(0, v));

  double get soundVolume => _soundVolume;
  double get musicVolume => _musicVolume;
  bool get haptics => _haptics;

  /// Muted is simply "no volume" — there is no separate flag that could fall
  /// out of step with the level.
  bool get sound => _soundVolume > 0;
  bool get music => _musicVolume > 0;

  void setSoundVolume(double value) {
    _soundVolume = _clamp(value);
    if (_soundVolume > 0) _soundBeforeMute = _soundVolume;
    _store?.setDouble(_kSound, _soundVolume);
  }

  void setMusicVolume(double value) {
    _musicVolume = _clamp(value);
    if (_musicVolume > 0) _musicBeforeMute = _musicVolume;
    _store?.setDouble(_kMusic, _musicVolume);
    onMusicChanged?.call();
  }

  void toggleSound() =>
      setSoundVolume(_soundVolume > 0 ? 0 : _orDefault(_soundBeforeMute));

  void toggleMusic() =>
      setMusicVolume(_musicVolume > 0 ? 0 : _orDefault(_musicBeforeMute));

  static double _orDefault(double remembered) =>
      remembered > 0 ? remembered : defaultVolume;

  void toggleHaptics() {
    _haptics = !_haptics;
    _store?.setBool(_kHaptics, _haptics);
  }

  /// A light tap, if the player has not switched it off.
  ///
  /// Routing feedback through settings rather than calling the platform directly
  /// is what makes the toggle mean something — otherwise the switch is a picture
  /// of a switch.
  void tapFeedback() {
    if (_haptics) HapticFeedback.lightImpact();
  }
}
