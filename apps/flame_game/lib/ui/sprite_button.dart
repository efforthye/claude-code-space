import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/effects.dart';
import 'package:flame/events.dart';
import 'package:flutter/animation.dart' show Curves;

import '../core/events.dart';
import '../core/game_frame.dart';

/// A button whose face is artwork.
///
/// The button holds still until it is touched, then swells under the thumb and
/// settles back on release. Growing rather than sinking is what reads as "this
/// responded to me" on a phone, where the finger already covers the button and
/// a shrink mostly disappears under it.
///
/// [pressedSprite] is optional. Given one, it is drawn as-is. Given none, the
/// pressed state is derived from the idle art by darkening it — a derivation
/// that lines up with the idle art exactly, because it *is* the idle art. So
/// the seam stays open: drop in real pressed artwork whenever it exists and
/// nothing else changes.
class SpriteButton extends PositionComponent
    with TapCallbacks, HasGameReference<GameFrame> {
  SpriteButton({
    required this.id,
    required Sprite idleSprite,
    required super.position,
    required Vector2 size,
    Sprite? pressedSprite,
    this.onPressed,
    this.pressSound,
    bool enabled = true,
    this.pressTint = false,
    this.idlePulse = false,
    this.pulsePeriod = 2.6,
  })  : _idle = idleSprite,
        _pressedArt = pressedSprite,
        _enabled = enabled,
        super(size: size, anchor: Anchor.center);

  /// An optional slow breathing pulse. Off by default — a button that moves on
  /// its own competes with the press for the player's attention, and the press
  /// is the part that carries meaning.
  final bool idlePulse;
  final double pulsePeriod;

  /// Stable identifier for events — not the visible art, so swapping the image
  /// never breaks a listener.
  final String id;
  final void Function()? onPressed;

  /// Overrides the default click for this button. See [ButtonPressed.sound].
  final String? pressSound;

  final Sprite _idle;
  final Sprite? _pressedArt;

  bool _enabled;
  bool _pressed = false;

  /// Darkens the face while held, for art with no pressed variant.
  ///
  /// Off by default: on bright pastel artwork a tint reads as the picture going
  /// muddy rather than as a button going down, and with the movement and the
  /// click both present it has nothing left to add.
  final bool pressTint;

  /// How far the face swells when pressed, as a fraction of its size.
  ///
  /// Small on purpose. This is a nudge confirming the touch landed, not an
  /// animation — anything the eye can measure looks like the button is being
  /// inflated.
  static const double _pressGrow = 0.03;

  /// Eased 0..1 rather than switched, so press and release are both movements.
  /// A button that snaps between two sizes reads as a glitch.
  double _grow = 0;
  static const double _growRate = 18;

  bool get enabled => _enabled;
  set enabled(bool value) {
    if (_enabled == value) return;
    _enabled = value;
    if (!value) _pressed = false;
  }

  /// Darkens only the pixels the artwork actually paints, so the transparent
  /// margin stays transparent instead of becoming a grey box.
  static final Paint _pressTintPaint = Paint()
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
  void update(double dt) {
    super.update(dt);
    final target = _pressed ? 1.0 : 0.0;
    if ((_grow - target).abs() < 0.005) {
      _grow = target;
    } else {
      _grow += (target - _grow) * (dt * _growRate).clamp(0, 1);
    }
  }

  @override
  void render(Canvas canvas) {
    if (!_enabled) {
      _idle.render(canvas, position: Vector2.zero(), size: size, overridePaint: _disabledTint);
      return;
    }

    if (_grow <= 0.001 && !_pressed) {
      _idle.render(canvas, position: Vector2.zero(), size: size);
      return;
    }

    // Grown about its own centre, so the button stays where it was put. The
    // motion applies whether or not there is pressed artwork — a pressed
    // drawing changes the lighting, not the size. Only the tint is conditional:
    // art already drawn pressed must not be darkened a second time.
    final grown = size * (1 + _pressGrow * _grow);
    final inset = (size - grown) / 2;
    (_pressedArt ?? _idle).render(
      canvas,
      position: inset,
      size: grown,
      overridePaint: _pressedArt == null && _pressed && pressTint
          ? _pressTintPaint
          : null,
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
    game.bus.emit(ButtonPressed(id, sound: pressSound));
  }

  @override
  void onTapCancel(TapCancelEvent event) => _pressed = false;
}
