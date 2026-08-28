import 'package:flame/components.dart';

import '../ui/modal_card.dart';
import 'design.dart';
import 'event_bus.dart';
import 'events.dart';
import 'game_frame.dart';
import 'scene_id.dart';

/// The contract every scene honours. Kept as an interface so the scene manager
/// depends on behaviour, not on any particular scene class.
abstract interface class Scene {
  SceneId get id;

  /// Called once the scene is mounted and its content is built.
  Future<void> onEnterScene();

  /// Called immediately before the scene is torn down.
  void onExitScene();
}

/// Base class for scenes: a Flame [Component] that fulfils [Scene].
///
/// Template method pattern — this class owns the lifecycle (mount, build,
/// enter, exit, unsubscribe) and subclasses only fill in [buildScene]. That way
/// no scene can forget to cancel its subscriptions, because it never manages
/// them in the first place.
abstract class SceneComponent extends Component
    with HasGameReference<GameFrame>, EventSubscriber
    implements Scene {
  GameFrame? _frame;

  /// Injected by the scene manager *before* the scene is mounted.
  ///
  /// Scenes must not depend on being attached to the tree to reach their
  /// dependencies: a scene can be replaced while its async `onLoad` is still
  /// running, and the tree lookup asserts once detached. Injection makes rapid
  /// navigation safe instead of a crash waiting for a fast player.
  void bindFrame(GameFrame frame) => _frame = frame;

  /// The frame, from injection first and the component tree as a fallback.
  GameFrame get frame => _frame ?? game;

  bool _superseded = false;

  /// Told by the scene manager that this scene has been replaced. Explicit
  /// rather than inferred from tree state, which is ambiguous mid-teardown.
  ///
  /// Takes the modal down here as well as in [onRemove]: a scene swapped out
  /// while it is still loading never mounts, so `onRemove` never runs, and its
  /// modal would sit on the game root over the next scene with nothing left
  /// alive to dismiss it.
  void markSuperseded() {
    _superseded = true;
    closeModal();
  }

  /// True once this scene has been swapped out — its work no longer matters.
  bool get isSuperseded => _superseded;

  @override
  EventBus get bus => frame.bus;

  /// The layout space scenes position themselves in.
  ///
  /// Deliberately the fixed design size, never the device size: the camera
  /// letterboxes this onto the real screen, so a scene laid out once looks the
  /// same on every device instead of drifting with the aspect ratio.
  Vector2 get sceneSize => Design.size;

  /// Whether the developer overlay belongs on this scene. Off for anything a
  /// player is meant to look at.
  bool get showsDebugOverlay => true;

  /// Subclass hook: add backgrounds, UI and objects here.
  Future<void> buildScene();

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    // Replaced before we finished loading: skip the work entirely rather than
    // building a scene nobody will see.
    if (isSuperseded) return;
    await buildScene();
    await onEnterScene();
  }

  @override
  Future<void> onEnterScene() async {}

  @override
  void onExitScene() {}

  @override
  void onRemove() {
    closeModal();
    onExitScene();
    disposeSubscriptions();
    super.onRemove();
  }

  ModalCard? _modal;

  /// True while an interruption is on screen. Gameplay should check this and
  /// hold still — a timer that keeps running behind a "really quit?" prompt
  /// punishes the player for reading it.
  bool get hasModal => _modal != null;

  /// Puts a modal in the world alongside the scene manager rather than inside
  /// this scene.
  ///
  /// It has to be in the world to cover the scene at all — the camera renders
  /// at maximum priority, so nothing on the game root can draw over it — and a
  /// sibling of the manager rather than a child of the scene so its priority is
  /// weighed against the whole scene rather than against its contents. The scene
  /// still owns it and takes it down on exit, so navigating away can never
  /// strand one on screen.
  void openModal(ModalCard modal) {
    if (_modal != null) return;
    _modal = modal;
    frame.world.add(modal);
  }

  void closeModal() {
    _modal?.removeFromParent();
    _modal = null;
  }

  /// Ask for a scene change. Scenes never switch each other directly; they
  /// state an intent and the scene manager decides.
  void goTo(SceneId target) => bus.emit(SceneRequested(target));
}
