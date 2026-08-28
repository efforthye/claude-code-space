import 'dart:ui';

import 'package:flame/game.dart';

import '../scenes/game_end_scene.dart';
import '../scenes/game_scene.dart';
import '../scenes/main_menu_scene.dart';
import '../scenes/title_scene.dart';
import '../ui/debug_overlay.dart';
import 'event_bus.dart';
import 'events.dart';
import 'game_session.dart';
import 'scene.dart';
import 'scene_id.dart';
import 'scene_manager.dart';

/// The frame the whole game hangs off.
///
/// It owns exactly three things and no gameplay: the event bus, the session
/// state that outlives scenes, and the scene manager. Everything else is a
/// scene's business. Keeping the frame this thin is what lets scenes be added,
/// removed or rewritten without touching the shell.
class GameFrame extends FlameGame {
  GameFrame({EventBus? bus, GameSession? session})
      : bus = bus ?? EventBus(),
        session = session ?? GameSession();

  final EventBus bus;
  final GameSession session;

  late final SceneManager sceneManager;

  /// Where the player is right now.
  SceneId? get currentSceneId => sceneManager.currentSceneId;

  @override
  Color backgroundColor() => const Color(0xFF0B0F17);

  @override
  Future<void> onLoad() async {
    await super.onLoad();

    // The scene table is the whole navigation graph, in one readable place.
    // Factories (not instances) so each entry builds a clean scene.
    sceneManager = SceneManager(
      factories: <SceneId, SceneComponent Function()>{
        SceneId.title: TitleScene.new,
        SceneId.mainMenu: MainMenuScene.new,
        SceneId.game: GameScene.new,
        SceneId.gameEnd: GameEndScene.new,
      },
      initial: SceneId.title,
    );
    await add(sceneManager);

    // Session bookkeeping is the frame's job: scenes report what happened, the
    // frame remembers it. Renders above everything else.
    bus.on<GameEnded>().listen((event) {
      session.recordEnd(outcome: event.outcome, score: event.score);
    });
    bus.on<GameStarted>().listen((_) => session.beginRun());

    await add(DebugOverlay(priority: 1000));
  }

  @override
  void onRemove() {
    bus.dispose();
    super.onRemove();
  }
}
