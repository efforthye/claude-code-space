/// The set of scenes the game can be in.
///
/// Lives alone in its own file so both the event catalogue and the scene layer
/// can depend on it without importing each other.
enum SceneId {
  title,
  mainMenu,
  game,
  gameEnd;

  String get displayName => switch (this) {
        SceneId.title => 'TITLE',
        SceneId.mainMenu => 'MAIN MENU',
        SceneId.game => 'GAME',
        SceneId.gameEnd => 'GAME END',
      };
}
