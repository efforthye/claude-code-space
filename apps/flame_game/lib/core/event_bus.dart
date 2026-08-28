import 'dart:async';
import 'dart:collection';

import 'events.dart';

/// Decoupled messaging between scenes, systems and UI.
///
/// Nothing in this game holds a reference to another scene. A scene emits an
/// intent and whoever owns that concern reacts, which is what makes scenes
/// independently testable and replaceable.
///
/// Delivery is asynchronous (a plain broadcast stream) on purpose. A synchronous
/// bus lets a handler emit while the bus is still iterating its listeners, which
/// is how re-entrancy bugs get in. One microtask of latency is invisible at 60fps.
class EventBus {
  EventBus({int historyLimit = 12}) : _historyLimit = historyLimit;

  final StreamController<GameEvent> _controller =
      StreamController<GameEvent>.broadcast();

  final int _historyLimit;
  final Queue<GameEvent> _history = Queue<GameEvent>();

  /// Most recent events, newest last. Diagnostics only — game logic must never
  /// read this. State lives in the objects that own it, not in the bus.
  List<GameEvent> get history => List.unmodifiable(_history);

  bool get isClosed => _controller.isClosed;

  /// Every event, unfiltered.
  Stream<GameEvent> get stream => _controller.stream;

  /// Only events of type [T]. This is the subscription API callers should use.
  Stream<T> on<T extends GameEvent>() =>
      _controller.stream.where((event) => event is T).cast<T>();

  void emit(GameEvent event) {
    if (_controller.isClosed) return;
    _history.addLast(event);
    while (_history.length > _historyLimit) {
      _history.removeFirst();
    }
    _controller.add(event);
  }

  Future<void> dispose() => _controller.close();
}

/// Gives a component a bus plus subscription bookkeeping.
///
/// An uncancelled stream subscription is the classic leak in this architecture,
/// so cancellation is not left to the caller: everything registered through
/// [listen] is torn down by [disposeSubscriptions], which the scene base class
/// calls on removal.
mixin EventSubscriber {
  final List<StreamSubscription<dynamic>> _subscriptions = [];

  /// Supplied by whoever mixes this in — usually from the game reference.
  EventBus get bus;

  void listen<T extends GameEvent>(void Function(T event) handler) {
    _subscriptions.add(bus.on<T>().listen(handler));
  }

  void disposeSubscriptions() {
    for (final subscription in _subscriptions) {
      subscription.cancel();
    }
    _subscriptions.clear();
  }
}
