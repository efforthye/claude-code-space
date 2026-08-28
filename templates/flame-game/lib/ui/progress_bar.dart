import 'dart:ui';

import 'package:flame/components.dart';

/// A thin bar that fills over a fixed duration.
///
/// Honest about what it measures: this tracks the splash hold, not asset
/// loading. Everything the title needs is already in memory by the time it
/// draws. It exists so the wait reads as deliberate rather than as a freeze —
/// which is the actual job of most loading bars anyway.
///
/// If real loading ever takes long enough to need reporting, drive [progress]
/// from that instead of from [duration] and the visuals stay the same.
class ProgressBar extends PositionComponent {
  ProgressBar({
    required this.duration,
    required super.position,
    required Vector2 size,
    this.trackColor = const Color(0x1FFFFFFF),
    this.fillColor = const Color(0xB3FFFFFF),
    this.onComplete,
  }) : super(size: size, anchor: Anchor.center);

  /// Seconds to go from empty to full.
  final double duration;
  final Color trackColor;
  final Color fillColor;
  final void Function()? onComplete;

  double _elapsed = 0;
  bool _completed = false;

  /// 0..1.
  double get progress => duration <= 0 ? 1 : (_elapsed / duration).clamp(0, 1);

  @override
  void update(double dt) {
    super.update(dt);
    if (_completed) return;
    _elapsed += dt;
    if (progress >= 1) {
      _completed = true;
      onComplete?.call();
    }
  }

  @override
  void render(Canvas canvas) {
    final radius = Radius.circular(size.y / 2);
    final track = RRect.fromRectAndRadius(size.toRect(), radius);
    canvas.drawRRect(track, Paint()..color = trackColor);

    final filled = size.x * progress;
    if (filled <= 0) return;
    // Clip to the track so the fill keeps the rounded ends instead of poking
    // out of them while it is short.
    canvas.save();
    canvas.clipRRect(track);
    canvas.drawRect(
      Rect.fromLTWH(0, 0, filled, size.y),
      Paint()..color = fillColor,
    );
    canvas.restore();
  }
}
