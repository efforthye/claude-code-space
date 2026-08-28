import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/effects.dart';
import 'package:flame/events.dart';
import 'package:flutter/animation.dart' show Curves;

import '../core/design.dart';
import '../core/game_frame.dart';
import '../core/typography.dart';

/// A labelled action inside a modal.
class ModalAction {
  const ModalAction(this.label, this.onTap, {this.primary = false});

  final String label;
  final void Function() onTap;

  /// Primary actions get the filled treatment; everything else stays quiet, so
  /// the eye lands on the thing the player most likely wants.
  final bool primary;
}

/// Base for anything that interrupts the screen: the whole device dims, a soft
/// card scales in, and a row of actions offers the way out.
///
/// The dimming is drawn across [CameraComponent.visibleWorldRect], not across
/// the design rectangle — on a screen taller than 9:16 those are different, and
/// stopping at the design edge leaves lit bands top and bottom.
abstract class ModalCard extends PositionComponent
    with TapCallbacks, HasGameReference<GameFrame> {
  ModalCard({
    required this.title,
    required this.actions,
    this.cardSize,
    super.priority = 500,
  });

  final String title;
  final List<ModalAction> actions;
  final Vector2? cardSize;

  static const double _actionH = 84;
  static const double _actionGap = 16;
  static const double _padX = 48;
  static const double _titleY = 62;
  static const double _bodyTop = 118;
  static const double _scrimOpacity = 0.5;

  /// Eased in alongside the card, so the interruption arrives rather than snaps.
  double _dim = 0;

  /// Content between the title and the actions, in card-local coordinates.
  Future<void> buildBody(Rect body) async {}

  /// Height the body needs, so the card can size itself around it.
  double get bodyHeight => 0;

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    size = Design.size;

    final card = _CardSurface(
      size: cardSize ?? Vector2(560, _bodyTop + bodyHeight + _actionH + 72),
      position: Design.size / 2,
    );
    await add(card);

    await card.add(
      TextComponent(
        text: title,
        anchor: Anchor.center,
        position: Vector2(card.size.x / 2, _titleY),
        textRenderer: AppText.displayPaint(
          size: 44,
          color: const Color(0xFF4A3340),
          onArt: false,
        ),
      ),
    );

    _body = card;
    await buildBody(
      Rect.fromLTWH(_padX, _bodyTop, card.size.x - _padX * 2, bodyHeight),
    );

    // Actions share the row evenly.
    final n = actions.length;
    if (n > 0) {
      final rowW = card.size.x - _padX * 2;
      final each = (rowW - _actionGap * (n - 1)) / n;
      for (var i = 0; i < n; i++) {
        await card.add(
          _ActionButton(
            action: actions[i],
            position: Vector2(
              _padX + i * (each + _actionGap),
              card.size.y - 40 - _actionH,
            ),
            size: Vector2(each, _actionH),
          ),
        );
      }
    }

    card.scale = Vector2.all(0.9);
    await card.add(
      ScaleEffect.to(
        Vector2.all(1),
        EffectController(duration: 0.2, curve: Curves.easeOutBack),
      ),
    );
  }

  /// Where [buildBody] puts its children — the card, not the full-screen layer,
  /// so body content rides the scale-in with everything else.
  late final Component _body;

  /// Subclasses call this from [buildBody] instead of `add`, so their content
  /// sits on the card and inherits its scale-in rather than floating over the
  /// dimmed screen.
  Future<void> addToBody(Component component) async => _body.add(component);

  @override
  void update(double dt) {
    super.update(dt);
    if (_dim < 1) _dim = (_dim + dt * 7).clamp(0.0, 1.0);
  }

  @override
  void render(Canvas canvas) {
    canvas.drawRect(
      game.camera.visibleWorldRect,
      Paint()..color = Color.fromRGBO(11, 16, 32, _scrimOpacity * _dim),
    );
  }

  /// The whole screen is the hit area, so nothing behind the modal can be
  /// pressed by accident while it is open.
  @override
  bool containsLocalPoint(Vector2 point) => true;
}

/// The card itself: draws its own surface and hosts the modal's content.
class _CardSurface extends PositionComponent {
  _CardSurface({required Vector2 size, required Vector2 position})
    : super(size: size, position: position, anchor: Anchor.center);

  @override
  void render(Canvas canvas) {
    final rect = size.toRect();
    final card = RRect.fromRectAndRadius(rect, const Radius.circular(30));
    // Drop shadow first, so the card lifts off the art behind it.
    canvas.drawRRect(
      card.shift(const Offset(0, 10)),
      Paint()
        ..color = const Color(0x594A2436)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18),
    );
    // Translucent gradient rather than a flat fill: the artwork stays faintly
    // present through the card, which keeps the modal part of the scene.
    canvas.drawRRect(
      card,
      Paint()
        ..shader = Gradient.linear(rect.topCenter, rect.bottomCenter, [
          const Color(0xF7FFF8FB),
          const Color(0xEBFFE9F3),
        ]),
    );
    canvas.drawRRect(
      card,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4
        ..shader = Gradient.linear(rect.topLeft, rect.bottomRight, [
          const Color(0xFFFFC2DC),
          const Color(0xFFF06BA0),
        ]),
    );
  }
}

class _ActionButton extends PositionComponent with TapCallbacks {
  _ActionButton({
    required this.action,
    required super.position,
    required Vector2 size,
  }) : super(size: size);

  final ModalAction action;
  bool _down = false;

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    await add(
      TextComponent(
        text: action.label,
        anchor: Anchor.center,
        position: size / 2,
        textRenderer: AppText.paint(
          size: 30,
          color: action.primary
              ? const Color(0xFFFFFFFF)
              : const Color(0xFF9B7A88),
          weight: action.primary ? FontWeight.w700 : FontWeight.w400,
          onArt: false,
        ),
      ),
    );
  }

  @override
  void render(Canvas canvas) {
    final r = RRect.fromRectAndRadius(size.toRect(), const Radius.circular(20));
    if (action.primary) {
      canvas.drawRRect(
        r,
        Paint()
          ..shader = Gradient.linear(
            size.toRect().topCenter,
            size.toRect().bottomCenter,
            _down
                ? [const Color(0xFFE0568C), const Color(0xFFCE3F77)]
                : [const Color(0xFFFF8FB8), const Color(0xFFF06BA0)],
          ),
      );
    } else {
      canvas.drawRRect(
        r,
        Paint()
          ..color = _down ? const Color(0x2E9B7A88) : const Color(0x149B7A88),
      );
      canvas.drawRRect(
        r,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..color = const Color(0x459B7A88),
      );
    }
  }

  @override
  void onTapDown(TapDownEvent event) => _down = true;

  @override
  void onTapUp(TapUpEvent event) {
    _down = false;
    action.onTap();
  }

  @override
  void onTapCancel(TapCancelEvent event) => _down = false;
}

/// Yes/no interruption.
class ConfirmDialog extends ModalCard {
  ConfirmDialog({
    required super.title,
    required this.message,
    required String confirmLabel,
    required void Function() onConfirm,
    required void Function() onCancel,
    String cancelLabel = '아니요',
  }) : super(
         actions: [
           ModalAction(cancelLabel, onCancel),
           ModalAction(confirmLabel, onConfirm, primary: true),
         ],
       );

  final String message;

  @override
  double get bodyHeight => 70;

  @override
  Future<void> buildBody(Rect body) async {
    await addToBody(
      TextComponent(
        text: message,
        anchor: Anchor.center,
        position: Vector2(body.center.dx, body.center.dy),
        textRenderer: AppText.paint(
          size: 27,
          color: const Color(0xFF7A5C6A),
          onArt: false,
        ),
      ),
    );
  }
}
