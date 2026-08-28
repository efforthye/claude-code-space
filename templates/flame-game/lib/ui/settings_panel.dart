import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/events.dart';
import 'package:flutter/painting.dart' show TextStyle;

import '../core/design.dart';
import '../core/game_frame.dart';

/// A row with a label and a switch.
class _ToggleRow extends PositionComponent with TapCallbacks {
  _ToggleRow({
    required this.label,
    required bool value,
    required super.position,
    required Vector2 size,
    required this.onChanged,
  }) : _value = value,
       super(size: size);

  final String label;
  final void Function(bool value) onChanged;
  bool _value;

  /// 0 = off, 1 = on. Eased toward [_value] so the knob slides.
  double _t = 0;

  static const double _trackW = 96;
  static const double _trackH = 50;

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    _t = _value ? 1 : 0;
    await add(
      TextComponent(
        text: label,
        anchor: Anchor.centerLeft,
        position: Vector2(0, size.y / 2),
        textRenderer: TextPaint(
          style: const TextStyle(color: Color(0xFF4A3340), fontSize: 30),
        ),
      ),
    );
  }

  @override
  void update(double dt) {
    super.update(dt);
    final target = _value ? 1.0 : 0.0;
    if ((_t - target).abs() < 0.01) {
      _t = target;
    } else {
      _t += (target - _t) * (dt * 14).clamp(0, 1);
    }
  }

  @override
  void render(Canvas canvas) {
    final left = size.x - _trackW;
    final top = (size.y - _trackH) / 2;
    final track = RRect.fromLTRBR(
      left,
      top,
      left + _trackW,
      top + _trackH,
      const Radius.circular(_trackH / 2),
    );
    final off = const Color(0xFFD9CFD4);
    final on = const Color(0xFFF06BA0);
    canvas.drawRRect(
      track,
      Paint()..color = Color.lerp(off, on, _t) ?? on,
    );

    final knobR = _trackH / 2 - 5;
    final knobX = left + 5 + knobR + (_trackW - 10 - knobR * 2) * _t;
    canvas.drawCircle(
      Offset(knobX, top + _trackH / 2),
      knobR,
      Paint()..color = const Color(0xFFFFFFFF),
    );
  }

  @override
  void onTapUp(TapUpEvent event) {
    _value = !_value;
    onChanged(_value);
  }
}

/// The settings card.
///
/// Modal by construction: it covers the screen with a scrim that swallows taps,
/// so nothing behind it can be pressed by accident while it is open. Closing is
/// the scene's business — the panel just reports it.
class SettingsPanel extends PositionComponent
    with TapCallbacks, HasGameReference<GameFrame> {
  SettingsPanel({required this.onClose, super.priority = 500});

  final void Function() onClose;

  static final Paint _scrim = Paint()..color = const Color(0x8C0B1020);
  static final Paint _card = Paint()..color = const Color(0xFFFFF6FA);
  static final Paint _cardEdge = Paint()
    ..color = const Color(0xFFF06BA0)
    ..style = PaintingStyle.stroke
    ..strokeWidth = 4;

  late final Rect _cardRect;

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    size = Design.size;

    const w = 560.0;
    const h = 460.0;
    _cardRect = Rect.fromLTWH(
      (Design.width - w) / 2,
      (Design.height - h) / 2,
      w,
      h,
    );

    await add(
      TextComponent(
        text: '설정',
        anchor: Anchor.center,
        position: Vector2(Design.width / 2, _cardRect.top + 58),
        textRenderer: TextPaint(
          style: const TextStyle(
            color: Color(0xFF4A3340),
            fontSize: 40,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );

    final settings = game.settings;
    final rowW = _cardRect.width - 96;
    var y = _cardRect.top + 120;
    for (final row in [
      ('효과음', settings.sound, settings.toggleSound),
      ('배경음악', settings.music, settings.toggleMusic),
      ('진동', settings.haptics, settings.toggleHaptics),
    ]) {
      await add(
        _ToggleRow(
          label: row.$1,
          value: row.$2,
          position: Vector2(_cardRect.left + 48, y),
          size: Vector2(rowW, 72),
          onChanged: (_) {
            row.$3();
            settings.tapFeedback();
          },
        ),
      );
      y += 88;
    }

    await add(
      TextComponent(
        text: '닫기',
        anchor: Anchor.center,
        position: Vector2(Design.width / 2, _cardRect.bottom - 52),
        textRenderer: TextPaint(
          style: const TextStyle(
            color: Color(0xFFB0879A),
            fontSize: 28,
            letterSpacing: 2,
          ),
        ),
      ),
    );
  }

  @override
  void render(Canvas canvas) {
    canvas.drawRect(size.toRect(), _scrim);
    final card = RRect.fromRectAndRadius(_cardRect, const Radius.circular(28));
    canvas.drawRRect(card, _card);
    canvas.drawRRect(card, _cardEdge);
  }

  /// The whole screen is the hit area, so a tap outside the card closes it and a
  /// tap inside is caught before it can reach the menu behind.
  @override
  bool containsLocalPoint(Vector2 point) => true;

  @override
  void onTapUp(TapUpEvent event) {
    if (!_cardRect.contains(event.localPosition.toOffset())) {
      onClose();
      return;
    }
    // Inside the card: only the close label acts, the rest is absorbed.
    if (event.localPosition.y > _cardRect.bottom - 84) onClose();
  }
}
