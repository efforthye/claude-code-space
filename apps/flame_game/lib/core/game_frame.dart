import 'dart:async';
import 'dart:math' as math;
import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/game.dart';

import '../scenes/game_end_scene.dart';
import '../scenes/game_scene.dart';
import '../scenes/main_menu_scene.dart';
import '../ui/debug_overlay.dart';
import '../ui/screen_backdrop.dart';
import 'design.dart';
import 'event_bus.dart';
import 'events.dart';
import 'game_audio.dart';
import 'game_session.dart';
import 'game_settings.dart';
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
/// Scenes lay out in [Design] space and the camera scales that onto the real
/// device. One layout, every screen — phone, tablet, or a desktop window the
/// player drags around.
///
/// The scaling is done with a full-screen viewport and a computed zoom rather
/// than with `CameraComponent.withFixedResolution`. Both centre the design
/// rectangle identically; the difference is that the fixed-resolution viewport
/// *clips* to it, so nothing in the game could ever paint the letterbox bands.
/// Nothing on the game root can cover them either — [CameraComponent] renders at
/// the maximum priority, above every root sibling — which left a full-screen
/// modal impossible to build. Here the bands are simply world space that happens
/// to fall outside the design rectangle, and an overlay can reach them.
class GameFrame extends FlameGame {
  GameFrame({EventBus? bus, GameSession? session, GameSettings? settings})
      : bus = bus ?? EventBus(),
        session = session ?? GameSession(),
        settings = settings ?? GameSettings(),
        super(camera: CameraComponent());

  final EventBus bus;
  final GameSession session;
  final GameSettings settings;

  /// Sound. Reads the volume from [settings] at playback, so the slider takes
  /// effect on the very next sound with nothing to notify.
  late final GameAudio audio = GameAudio(settings);

  late final SceneManager sceneManager;

  /// Full-device artwork behind everything. Lives on the game root rather than
  /// in the world, so it paints across the letterbox the fixed-resolution camera
  /// necessarily creates. Scenes set it and clear it as they come and go.
  late final ScreenBackdrop backdrop;

  /// Developer overlay. Scenes opt out via [SceneComponent.showsDebugOverlay].
  late final DebugOverlay debugOverlay;

  /// Where the player is right now.
  SceneId? get currentSceneId => sceneManager.currentSceneId;

  /// The live scene. Whoever needs to talk to it — a back button, a test —
  /// asks here rather than searching the tree.
  SceneComponent? get currentScene => sceneManager.currentScene;

  /// The letterbox colour — the area outside the 9:16 play field.
  @override
  Color backgroundColor() => const Color(0xFF05070C);

  @override
  Future<void> onLoad() async {
    await super.onLoad();

    // Scenes lay out from a top-left origin like every UI does, so the
    // viewfinder is anchored there rather than at its centre.
    camera.viewfinder.anchor = Anchor.topLeft;
    _fitCamera(size);

    // The scene table is the whole navigation graph in one readable place.
    // Factories, not instances, so each entry builds a clean scene.
    sceneManager = SceneManager(
      factories: <SceneId, SceneComponent Function()>{
        SceneId.mainMenu: MainMenuScene.new,
        SceneId.game: GameScene.new,
        SceneId.gameEnd: GameEndScene.new,
      },
      initial: SceneId.mainMenu,
    );
    // Added to the game, not the world: outside the camera and therefore not
    // clipped to the design rectangle.
    backdrop = ScreenBackdrop(priority: -1000);
    await add(backdrop);

    debugOverlay = DebugOverlay(priority: 1000);
    await world.add(debugOverlay);

    // Same reasoning as the settings read below — decoding audio must not hold
    // up the first frame, and a game that fails to load its clips is silent
    // rather than broken.
    unawaited(audio.preload());

    // The slider moves while music is already playing, so the change has to be
    // pushed into the player rather than picked up at the next playback.
    settings.onMusicChanged = audio.syncMusic;

    // Fire-and-forget: see GameSettings.load. Whoever reads a preference in the
    // first few frames gets the default, which is the same value a first-time
    // player would have had anyway.
    unawaited(settings.load());

    // Last, and deliberately so. Adding the manager runs its onLoad here, which
    // performs the first scene switch — and that switch touches the fields above.
    // Anything the manager can reach has to exist before this line.
    await world.add(sceneManager);

    // Session bookkeeping is the frame's job: scenes report what happened, the
    // frame remembers it.
    bus.on<GameEnded>().listen((event) {
      session.recordEnd(outcome: event.outcome, score: event.score);
      // Only a real loss gets a sound. Quitting was the player's own choice and
      // does not need to be scolded for it.
      if (event.outcome == GameOutcome.failed) audio.failed();
    });
    bus.on<GameStarted>().listen((_) => session.beginRun());

    // Every button already announces itself on the bus, so the click is wired
    // once here rather than in each button — a new button is audible the moment
    // it exists, with nothing to remember to hook up.
    bus.on<ButtonPressed>().listen(
      (event) => audio.play(event.sound ?? GameAudio.select),
    );

  }

  /// Fits the design rectangle into the device and centres it.
  ///
  /// With the viewfinder anchored top-left a world point maps to
  /// `(world - viewfinder.position) * zoom`, so putting design (0,0) at the
  /// centred offset means pulling the viewfinder back by that offset in world
  /// units. Everything outside the design rectangle stays visible — that is the
  /// letterbox, and it is now paintable.
  void _fitCamera(Vector2 size) {
    if (size.x <= 0 || size.y <= 0) return;
    final zoom = math.min(size.x / Design.width, size.y / Design.height);
    camera.viewfinder
      ..zoom = zoom
      ..position = Vector2(
        -(size.x - Design.width * zoom) / (2 * zoom),
        -(size.y - Design.height * zoom) / (2 * zoom),
      );
  }

  @override
  void onGameResize(Vector2 size) {
    super.onGameResize(size);
    if (isLoaded) _fitCamera(size);
  }

  @override
  void onRemove() {
    settings.onMusicChanged = null;
    unawaited(audio.stopBgm());
    bus.dispose();
    super.onRemove();
  }
}
