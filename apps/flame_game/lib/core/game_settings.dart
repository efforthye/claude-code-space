import 'package:flutter/services.dart' show HapticFeedback;

/// Player preferences.
///
/// In memory only for now — they reset when the app is killed. That is a
/// deliberate stopgap, not an oversight: persisting them means adding a storage
/// dependency, and it is worth doing in the same change that gives the game
/// something worth remembering. Swap the getters and setters for a persisted
/// store and nothing above this file changes.
class GameSettings {
  bool _sound = true;
  bool _music = true;
  bool _haptics = true;

  bool get sound => _sound;
  bool get music => _music;
  bool get haptics => _haptics;

  // Changes go through these rather than through setters: when this starts
  // persisting, one line inside each is the whole change.
  void toggleSound() => _sound = !_sound;
  void toggleMusic() => _music = !_music;
  void toggleHaptics() => _haptics = !_haptics;

  /// A light tap, if the player has not switched it off.
  ///
  /// Routing feedback through settings rather than calling the platform directly
  /// is what makes the toggle mean something — otherwise the switch is a picture
  /// of a switch.
  void tapFeedback() {
    if (_haptics) HapticFeedback.lightImpact();
  }
}
