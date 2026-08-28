import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/effects.dart';
import 'package:flame/events.dart';
import 'package:flutter/animation.dart' show Curves;

import '../core/events.dart';
import '../core/game_frame.dart';

/// A button whose face is artwork.
///
/// [pressedSprite] is optional on purpose. Given one, it is drawn as-is. Given
/// none, the pressed state is derived from the idle art — shrunk toward its own
/// centre, dropped a few pixels, and darkened. That derivation is what most
/// shipped mobile games actually do, and it has one property a second drawing
/// cannot: it lines up with the idle art exactly, because it *is* the idle art.
///
/// So the seam stays open — drop in real pressed artwork whenever it exists,
/// and nothing else changes.
class SpriteButton extends PositionComponent
    with TapCallbacks, HasGameReference<GameFrame> {
  SpriteButton({
    required this.id,
    required Sprite idleSprite,
    required super.position,
    required Vector2 size,
    Sprite? pressedSprite,
    this.onPressed,
    bool enabled = true,
    this.idlePulse = true,
    this.pulsePeriod = 2.6,
  })  : _idle = idleSprite,
        _pressedArt = pressedSprite,
        _enabled = enabled,
        super(size: size, anchor: Anchor.center);

  /// A slow scale pulse while idle, so the button reads as the live thing on
  /// screen. Applied as a transform, which leaves [render] free to handle the
  /// press independently — the two never fight over the same property.
  final bool idlePulse;
  final double pulsePeriod;

  /// Stable identifier for events — not the visible art, so swapping the image
  /// never breaks a listener.
  final String id;
  final void Function()? onPressed;

  final Sprite _idle;
  final Sprite? _pressedArt;

  bool _enabled;
  bool _pressed = false;

  /// How far the face shrinks when pressed, as a fraction of its size.
  static const double _pressShrink = 0.045;

  /// How far it sinks, in design-space pixels.
  static const double _pressSink = 9;

  bool get enabled => _enabled;
  set enabled(bool value) {
    if (_enabled == value) return;
    _enabled = value;
    if (!value) _pressed = false;
  }

  /// Darkens only the pixels the artwork actually paints, so the transparent
  /// margin stays transparent instead of becoming a grey box.
  static final Paint _pressTint = Paint()
    ..colorFilter = const ColorFilter.mode(Color(0x59000000), BlendMode.srcATop);

  static final Paint _disabledTint = Paint()
    ..colorFilter = const ColorFilter.mode(Color(0x8C2A2F3A), BlendMode.srcATop);

  /// Downsampled alpha map of the idle art, in mask coordinates.
  ///
  /// A sprite's bounding box is a rectangle; the drawing inside it usually is
  /// not. Without this, the transparent corners around a rounded button are
  /// still tappable, and on a screen with several sprites the invisible margins
  /// start stealing each other's presses.
  List<bool>? _alphaMask;
  int _maskW = 0;
  int _maskH = 0;

  /// Alpha at or below this counts as "not the button".
  static const int _alphaCutoff = 24;

  /// Mask resolution cap. 128x128 booleans is 16KB and lands well inside a
  /// fingertip's worth of precision — sampling the full image would cost
  /// megabytes for accuracy nobody can touch.
  static const int _maskMax = 128;

  Future<void> _buildAlphaMask() async {
    final image = _idle.image;
    final data = await image.toByteData(format: ImageByteFormat.rawRgba);
    if (data == null) return;

    final srcX = _idle.srcPosition.x.round();
    final srcY = _idle.srcPosition.y.round();
    final srcW = _idle.srcSize.x.round();
    final srcH = _idle.srcSize.y.round();

    final scale = srcW > srcH ? _maskMax / srcW : _maskMax / srcH;
    _maskW = (srcW * scale).ceil().clamp(1, _maskMax);
    _maskH = (srcH * scale).ceil().clamp(1, _maskMax);

    final mask = List<bool>.filled(_maskW * _maskH, false);
    final bytes = data.buffer.asUint8List();
    for (var my = 0; my < _maskH; my++) {
      final iy = srcY + (my * srcH / _maskH).floor();
      for (var mx = 0; mx < _maskW; mx++) {
        final ix = srcX + (mx * srcW / _maskW).floor();
        final alpha = bytes[(iy * image.width + ix) * 4 + 3];
        mask[my * _maskW + mx] = alpha > _alphaCutoff;
      }
    }
    _alphaMask = mask;
  }

  @override
  bool containsLocalPoint(Vector2 point) {
    if (!super.containsLocalPoint(point)) return false;
    final mask = _alphaMask;
    // Until the mask is ready the rectangle stands in, so the button is never
    // dead — a press landing in that window is better than one that vanishes.
    if (mask == null) return true;

    final mx = (point.x / size.x * _maskW).floor().clamp(0, _maskW - 1);
    final my = (point.y / size.y * _maskH).floor().clamp(0, _maskH - 1);
    return mask[my * _maskW + mx];
  }

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    await _buildAlphaMask();
    if (!idlePulse) return;
    await add(
      ScaleEffect.by(
        Vector2.all(1.035),
        EffectController(
          duration: pulsePeriod / 2,
          reverseDuration: pulsePeriod / 2,
          infinite: true,
          curve: Curves.easeInOut,
        ),
      ),
    );
  }

  @override
  void render(Canvas canvas) {
    if (!_enabled) {
      _idle.render(canvas, position: Vector2.zero(), size: size, overridePaint: _disabledTint);
      return;
    }

    if (!_pressed) {
      _idle.render(canvas, position: Vector2.zero(), size: size);
      return;
    }

    // The motion applies either way — a pressed drawing changes the lighting,
    // not the position, and it is the sink that the thumb actually feels.
    // Only the tint is conditional: art that is already drawn pressed must not
    // be darkened a second time.
    final shrunk = size * (1 - _pressShrink);
    final inset = (size - shrunk) / 2;
    (_pressedArt ?? _idle).render(
      canvas,
      position: Vector2(inset.x, inset.y + _pressSink),
      size: shrunk,
      overridePaint: _pressedArt == null ? _pressTint : null,
    );
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
    game.bus.emit(ButtonPressed(id));
  }

  @override
  void onTapCancel(TapCancelEvent event) => _pressed = false;
}
