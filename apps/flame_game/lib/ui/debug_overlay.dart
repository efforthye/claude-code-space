import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flutter/painting.dart' show TextStyle;

import '../core/design.dart';
import '../core/event_bus.dart';
import '../core/events.dart';
import '../core/game_frame.dart';

/// Shows which scene is live and the last few events on the bus.
///
/// This exists so the architecture is *visible* while it is being built: if a
/// button fires but no event appears here, the wiring is wrong and you can see
/// it without a debugger. Delete or gate it behind a flag before shipping.
class DebugOverlay extends PositionComponent
    with HasGameReference<GameFrame>, EventSubscriber {
  DebugOverlay({super.priority});

  late final TextComponent _sceneLine;
  late final TextComponent _eventLines;

  /// Panel behind the text. Over an illustrated background the overlay is
  /// otherwise invisible, which defeats the whole point of having it.
  static final Paint _panel = Paint()..color = const Color(0xB2070B14);

  @override
  EventBus get bus => game.bus;

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    position = Vector2(Design.margin, 28);

    _sceneLine = TextComponent(
      text: 'scene: -',
      textRenderer: TextPaint(
        style: const TextStyle(
          color: Color(0xFF8FD6B5),
          fontSize: 21,
          letterSpacing: 0.8,
        ),
      ),
    );
    _eventLines = TextComponent(
      text: '',
      position: Vector2(0, 32),
      textRenderer: TextPaint(
        style: const TextStyle(color: Color(0x8899A3B5), fontSize: 18),
      ),
    );
    await addAll([_sceneLine, _eventLines]);

    // Any event at all redraws the list — including ones added later, because
    // the overlay listens to the base type rather than to a fixed set.
    listen<GameEvent>((_) => _refresh());
    _refresh();
  }

  @override
  void render(Canvas canvas) {
    final w = _eventLines.width > _sceneLine.width ? _eventLines.width : _sceneLine.width;
    canvas.drawRRect(
      RRect.fromLTRBR(-10, -8, w + 14, _eventLines.position.y + _eventLines.height + 8, const Radius.circular(6)),
      _panel,
    );
    super.render(canvas);
  }

  void _refresh() {
    final id = game.currentSceneId;
    _sceneLine.text = 'scene: ${id?.displayName ?? '-'}'
        '   |   run #${game.session.runCount}'
        '   best ${game.session.highScore}';
    final recent = bus.history.reversed.take(5).map((e) => '· ${e.label}');
    _eventLines.text = recent.join('\n');
  }
}
