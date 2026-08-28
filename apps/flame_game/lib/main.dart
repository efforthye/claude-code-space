import 'package:flame/game.dart';
import 'package:flutter/widgets.dart';

import 'core/game_frame.dart';

/// Entry point.
///
/// Deliberately empty of game logic: the whole game is [GameFrame] and the
/// scenes it registers. Flow is
///   TITLE ("HELLO FLAME!") → auto/tap → MAIN MENU → START GAME → GAME → GAME END
/// and every hop is a `SceneRequested` event, never a direct call between scenes.
void main() {
  runApp(GameWidget(game: GameFrame()));
}
