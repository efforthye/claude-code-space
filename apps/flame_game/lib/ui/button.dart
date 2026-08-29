import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/events.dart';

import '../core/events.dart';
import '../core/typography.dart';
import '../core/game_frame.dart';

/// One button class for the whole game.
///
/// It knows how to look pressed and how to announce itself; it does not know
/// what pressing it means. The owning scene supplies [onPressed], and the press
/// is also published as a [ButtonPressed] event so systems that care (analytics,
/// tutorials, sound) can react without the scene wiring them up.
class Button extends PositionComponent
    with TapCallbacks, HasGameReference<GameFrame> {
  Button({
    required this.id,
    required this.label,
    required super.position,
    Vector2? size,
    this.onPressed,
    this.pressSound,
    bool enabled = true,
  })  : _enabled = enabled,
        super(size: size ?? Vector2(400, 96), anchor: Anchor.center);

  /// Stable identifier used in events — not the visible text, so copy changes
  /// never break a listener.
  final String id;
  final String label;
  final void Function()? onPressed;

  /// Overrides the default click for this button. See [ButtonPressed.sound].
  final String? pressSound;

  bool _enabled;
  bool _pressed = false;

  late final TextComponent _text;

  bool get enabled => _enabled;
  set enabled(bool value) {
    if (_enabled == value) return;
    _enabled = value;
    _text.textRenderer = _labelStyle;
  }

  TextPaint get _labelStyle => AppText.paint(
        size: 32,
        color: _enabled ? const Color(0xFFF2F4F7) : const Color(0xFF6B7280),
      );

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    _text = TextComponent(
      text: label,
      anchor: Anchor.center,
      position: size / 2,
      textRenderer: _labelStyle,
    );
    await add(_text);
  }

  @override
  void render(Canvas canvas) {
    final rect = size.toRect();
    final fill = Paint()
      ..color = !_enabled
          ? const Color(0xFF161B24)
          : _pressed
              ? const Color(0xFF2C3646)
              : const Color(0xFF1D2530);
    final border = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..color = !_enabled
          ? const Color(0xFF2A3140)
          : _pressed
              ? const Color(0xFF8FA6C4)
              : const Color(0xFF55627A);

    canvas.drawRect(rect, fill);
    canvas.drawRect(rect, border);
  }

  @override
  void onTapDown(TapDownEvent event) {
    if (!_enabled) return;
    _pressed = true;
  }

  @override
  void onTapUp(TapUpEvent event) {
    if (!_enabled || !_pressed) return;
    _pressed = false;
    onPressed?.call();
    game.bus.emit(ButtonPressed(id, sound: pressSound));
  }

  @override
  void onTapCancel(TapCancelEvent event) => _pressed = false;
}
