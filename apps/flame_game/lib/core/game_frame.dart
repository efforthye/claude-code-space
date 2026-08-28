import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/game.dart';

import '../scenes/game_end_scene.dart';
import '../scenes/game_scene.dart';
import '../scenes/main_menu_scene.dart';
import '../scenes/title_scene.dart';
import '../ui/debug_overlay.dart';
import '../ui/screen_backdrop.dart';
import 'design.dart';
import 'event_bus.dart';
import 'events.dart';
import 'game_session.dart';
import 'scene.dart';
import 'scene_id.dart';
import 'scene_manager.dart';

/// The frame the whole game hangs off.
///
/// It owns exactly three things and no gameplay: the event bus, the session
/// state that outlives scenes, and the scene manager. Keeping the frame this
/// thin is what lets scenes be added, removed or rewritten without touching the
/// shell.
///
/// The camera is fixed-resolution: scenes lay out in [Design] space and the
/// camera letterboxes that onto the real device. One layout, every screen —
/// phone, tablet, or a desktop window the player drags around.
class GameFrame extends FlameGame {
  GameFrame({EventBus? bus, GameSession? session})
      : bus = bus ?? EventBus(),
        session = session ?? GameSession(),
        super(
          camera: CameraComponent.withFixedResolution(
            width: Design.width,
            height: Design.height,
          ),
        );

  final EventBus bus;
  final GameSession session;

  late final SceneManager sceneManager;

  /// Full-device artwork behind everything. Lives on the game root rather than
  /// in the world, so it paints across the letterbox the fixed-resolution camera
  /// necessarily creates. Scenes set it and clear it as they come and go.
  late final ScreenBackdrop backdrop;

  /// Developer overlay. Scenes opt out via [SceneComponent.showsDebugOverlay].
  late final DebugOverlay debugOverlay;

  /// Where the player is right now.
  SceneId? get currentSceneId => sceneManager.currentSceneId;

  /// The letterbox colour — the area outside the 9:16 play field.
  @override
  Color backgroundColor() => const Color(0xFF05070C);

  @override
  Future<void> onLoad() async {
    await super.onLoad();

    // withFixedResolution centres the viewfinder, which puts world (0,0) in the
    // middle of the screen. Scenes lay out from a top-left origin like every UI
    // does, so anchor the viewfinder there and the visible world becomes exactly
    // (0,0)–(Design.width, Design.height).
    camera.viewfinder
      ..anchor = Anchor.topLeft
      ..position = Vector2.zero();

    // The scene table is the whole navigation graph in one readable place.
    // Factories, not instances, so each entry builds a clean scene.
    sceneManager = SceneManager(
      factories: <SceneId, SceneComponent Function()>{
        SceneId.title: TitleScene.new,
        SceneId.mainMenu: MainMenuScene.new,
        SceneId.game: GameScene.new,
        SceneId.gameEnd: GameEndScene.new,
      },
      initial: SceneId.title,
    );
    // Added to the game, not the world: outside the camera and therefore not
    // clipped to the design rectangle.
    backdrop = ScreenBackdrop(priority: -1000);
    await add(backdrop);

    debugOverlay = DebugOverlay(priority: 1000);
    await world.add(debugOverlay);

    // Last, and deliberately so. Adding the manager runs its onLoad here, which
    // performs the first scene switch — and that switch touches the fields above.
    // Anything the manager can reach has to exist before this line.
    await world.add(sceneManager);

    // Session bookkeeping is the frame's job: scenes report what happened, the
    // frame remembers it.
    bus.on<GameEnded>().listen((event) {
      session.recordEnd(outcome: event.outcome, score: event.score);
    });
    bus.on<GameStarted>().listen((_) => session.beginRun());

  }

  @override
  void onRemove() {
    bus.dispose();
    super.onRemove();
  }
}
