/// The set of scenes the game can be in.
///
/// Lives alone in its own file so both the event catalogue and the scene layer
/// can depend on it without importing each other.
enum SceneId {
  mainMenu,
  game,
  stroll,
  gameEnd;

  String get displayName => switch (this) {
        SceneId.mainMenu => 'MAIN MENU',
        SceneId.game => 'GAME',
        SceneId.stroll => 'STROLL',
        SceneId.gameEnd => 'GAME END',
      };
}
