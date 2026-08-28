import 'package:flame/components.dart';

import 'event_bus.dart';
import 'events.dart';
import 'game_frame.dart';
import 'scene.dart';
import 'scene_id.dart';

/// Owns "which scene are we in" and performs the switch.
///
/// Scenes are built lazily from factories, so only the live scene exists in
/// memory and every entry starts from a clean object rather than a reused one
/// carrying last run's state.
class SceneManager extends Component
    with HasGameReference<GameFrame>, EventSubscriber {
  SceneManager({
    required Map<SceneId, SceneComponent Function()> factories,
    required SceneId initial,
  })  : _factories = Map.unmodifiable(factories),
        _initial = initial;

  final Map<SceneId, SceneComponent Function()> _factories;
  final SceneId _initial;

  SceneComponent? _current;

  @override
  EventBus get bus => game.bus;

  /// Where the player currently is. Read-only to everyone else — the manager is
  /// the single source of truth for navigation state.
  SceneId? get currentSceneId => _current?.id;

  /// The live scene itself. Read-only, and answered from the manager's own
  /// bookkeeping rather than from the component tree: a scene is current the
  /// moment it is chosen, but does not appear in the tree until it has finished
  /// loading its assets, so a tree walk gives the wrong answer during startup.
  SceneComponent? get currentScene => _current;

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    listen<SceneRequested>((event) => switchTo(event.target));
    await switchTo(_initial);
  }

  /// Switch to [target].
  ///
  /// Atomic: there is no await between committing the new scene and announcing
  /// it, so no request can slip in half-way and be lost. That is why there is no
  /// in-flight guard or pending queue here — there is no in-flight window to
  /// guard. A burst of requests simply applies in order, last one wins.
  Future<void> switchTo(SceneId target) async {
    // Already there: a repeat request (double tap, an event echoed by a system)
    // is a no-op rather than a scene rebuild.
    if (target == currentSceneId) return;

    final factory = _factories[target];
    if (factory == null) {
      throw StateError('No scene registered for $target');
    }

    final previous = _current?.id;

    _current
      ?..markSuperseded()
      ..removeFromParent();
    final next = factory()..bindFrame(game);
    _current = next;

    // Deliberately not awaited. `add()` completes only once the component is
    // mounted, and Flame does not drain the mount queue until the enclosing
    // onLoad has returned — awaiting here means the very first switch never
    // finishes, and every event after it arrives out of order. The switch is
    // committed the moment _current is reassigned; mounting catches up next tick.
    add(next);
    game.debugOverlay.visible = next.showsDebugOverlay;

    bus.emit(SceneChanged(from: previous, to: target));
  }

  @override
  void onRemove() {
    disposeSubscriptions();
    super.onRemove();
  }
}
