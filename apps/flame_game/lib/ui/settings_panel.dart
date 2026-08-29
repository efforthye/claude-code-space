import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/events.dart';

import '../core/game_frame.dart';
import '../core/typography.dart';
import 'modal_card.dart';

const Color _ink = Color(0xFF5C4150);
const Color _mutedInk = Color(0xFFB9A3AE);
const Color _trackOff = Color(0xFFE4DAE0);
const List<Color> _hot = [Color(0xFFFF8FB8), Color(0xFFF06BA0)];

/// Speaker glyph that doubles as the mute button.
///
/// Drawn rather than shipped as art: at this size a PNG buys nothing, and the
/// muted state needs to be the *same* speaker with a cross through it, which is
/// easier to guarantee from one path than from two files that can drift apart.
class _SpeakerIcon extends PositionComponent with TapCallbacks {
  _SpeakerIcon({
    required super.position,
    required this.isOn,
    required this.onTap,
  }) : super(size: Vector2.all(46), anchor: Anchor.centerLeft);

  final bool Function() isOn;
  final void Function() onTap;

  @override
  void render(Canvas canvas) {
    final on = isOn();
    final colour = on ? _ink : _mutedInk;
    final w = size.x, h = size.y;

    // Cone: a small rectangle at the back opening out into a trapezoid.
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.06, h * 0.36)
        ..lineTo(w * 0.26, h * 0.36)
        ..lineTo(w * 0.50, h * 0.14)
        ..lineTo(w * 0.50, h * 0.86)
        ..lineTo(w * 0.26, h * 0.64)
        ..lineTo(w * 0.06, h * 0.64)
        ..close(),
      Paint()..color = colour,
    );

    final stroke = Paint()
      ..color = colour
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.4
      ..strokeCap = StrokeCap.round;

    if (on) {
      // Arcs of sound, present only when there is sound to represent.
      for (final r in [w * 0.16, w * 0.30]) {
        canvas.drawArc(
          Rect.fromCircle(center: Offset(w * 0.50, h / 2), radius: r),
          -0.85,
          1.7,
          false,
          stroke,
        );
      }
    } else {
      // The universal cross, which reads faster than a greyed-out speaker.
      canvas.drawLine(
        Offset(w * 0.62, h * 0.34),
        Offset(w * 0.92, h * 0.66),
        stroke,
      );
      canvas.drawLine(
        Offset(w * 0.92, h * 0.34),
        Offset(w * 0.62, h * 0.66),
        stroke,
      );
    }
  }

  @override
  void onTapUp(TapUpEvent event) => onTap();
}

/// A label, a mute button, a draggable level and a percentage.
///
/// A level rather than a switch: a player who finds the music slightly loud
/// wants it quieter, not gone, and on/off throws away the only adjustment most
/// of them actually want.
class _VolumeRow extends PositionComponent
    with TapCallbacks, DragCallbacks, HasGameReference<GameFrame> {
  _VolumeRow({
    required this.label,
    required this.read,
    required this.write,
    required this.onMute,
    required super.position,
    required Vector2 size,
  }) : super(size: size);

  final String label;
  final double Function() read;
  final void Function(double value) write;
  final void Function() onMute;

  static const double _labelW = 128;
  static const double _iconW = 76;
  static const double _percentW = 76;
  static const double _trackH = 14;
  static const double _knobR = 15;

  /// The slider is continuous, but the *sound* is not. A drag crosses dozens of
  /// values a second; firing on each one is a buzz, not feedback. Ticking once
  /// per notch gives the track the feel of detents it does not actually have.
  static const int _notches = 20;
  int _lastNotch = -1;

  late final TextComponent _percent;

  double get _left => _labelW + _iconW;
  double get _right => size.x - _percentW;

  /// The knob's centre travels inside the track, not to its edges. At zero it
  /// would otherwise hang a whole radius past the left end and collide with the
  /// speaker icon — which is exactly what it did.
  double get _knobMin => _left + _knobR;
  double get _knobMax => _right - _knobR;

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    await add(
      TextComponent(
        text: label,
        anchor: Anchor.centerLeft,
        position: Vector2(0, size.y / 2),
        textRenderer: AppText.paint(size: 30, color: _ink, onArt: false),
      ),
    );
    await add(
      _SpeakerIcon(
        position: Vector2(_labelW, size.y / 2),
        isOn: () => read() > 0,
        onTap: () {
          onMute();
          _refresh();
          // After the change, so unmuting is audible and muting is not — the
          // sound is the confirmation.
          game.audio.tapClick();
        },
      ),
    );
    _percent = TextComponent(
      anchor: Anchor.centerRight,
      position: Vector2(size.x, size.y / 2),
      textRenderer: AppText.paint(size: 26, color: _mutedInk, onArt: false),
    );
    await add(_percent);
    _refresh();
  }

  void _refresh() => _percent.text = '${(read() * 100).round()}%';

  /// Maps a horizontal position to a level, so a tap anywhere on the track
  /// jumps there and a drag follows the finger past either end.
  void _seek(double localX) {
    final value = ((localX - _knobMin) / (_knobMax - _knobMin)).clamp(0.0, 1.0);
    write(value);
    _refresh();

    final notch = (value * _notches).round();
    if (notch != _lastNotch) {
      _lastNotch = notch;
      game.audio.ticked();
    }
  }

  /// Only the track responds — tapping the label or the percentage does
  /// nothing, and the speaker icon keeps its own hits.
  bool _onTrack(Vector2 p) => p.x >= _left && p.x <= _right;

  @override
  void render(Canvas canvas) {
    final y = size.y / 2;
    final rect = Rect.fromLTWH(_left, y - _trackH / 2, _right - _left, _trackH);
    const radius = Radius.circular(_trackH / 2);

    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, radius),
      Paint()..color = _trackOff,
    );

    final value = read();
    final knobX = _knobMin + (_knobMax - _knobMin) * value;
    if (value > 0) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(rect.left, rect.top, knobX - rect.left, rect.height),
          radius,
        ),
        Paint()
          ..shader = Gradient.linear(rect.centerLeft, rect.centerRight, _hot),
      );
    }

    final knob = Offset(knobX, y);
    canvas.drawCircle(
      knob.translate(0, 2),
      _knobR,
      Paint()
        ..color = const Color(0x334A2436)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );
    canvas.drawCircle(knob, _knobR, Paint()..color = const Color(0xFFFFFFFF));
    canvas.drawCircle(
      knob,
      _knobR,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..color = value > 0 ? _hot.last : _trackOff,
    );
  }

  @override
  void onTapUp(TapUpEvent event) {
    if (_onTrack(event.localPosition)) _seek(event.localPosition.x);
  }

  @override
  void onDragStart(DragStartEvent event) {
    super.onDragStart(event);
    // Reset so a fresh drag always ticks on its first move, even if it starts
    // exactly where the last one ended.
    _lastNotch = -1;
    if (_onTrack(event.localPosition)) _seek(event.localPosition.x);
  }

  @override
  void onDragUpdate(DragUpdateEvent event) => _seek(event.localEndPosition.x);
}

/// A label and a switch, for the things that genuinely are on or off.
class _ToggleRow extends PositionComponent
    with TapCallbacks, HasGameReference<GameFrame> {
  _ToggleRow({
    required this.label,
    required this.read,
    required this.onChanged,
    required super.position,
    required Vector2 size,
  }) : super(size: size);

  final String label;
  final bool Function() read;
  final void Function() onChanged;

  /// 0 = off, 1 = on. Eased toward the value so the knob slides rather than
  /// teleports — the movement is what tells the player the tap registered.
  double _t = 0;

  static const double _trackW = 96;
  static const double _trackH = 50;

  @override
  Future<void> onLoad() async {
    await super.onLoad();
    _t = read() ? 1 : 0;
    await add(
      TextComponent(
        text: label,
        anchor: Anchor.centerLeft,
        position: Vector2(0, size.y / 2),
        textRenderer: AppText.paint(size: 30, color: _ink, onArt: false),
      ),
    );
  }

  @override
  void update(double dt) {
    super.update(dt);
    final target = read() ? 1.0 : 0.0;
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
    final rect = Rect.fromLTWH(left, top, _trackW, _trackH);
    final track = RRect.fromRectAndRadius(
      rect,
      const Radius.circular(_trackH / 2),
    );

    canvas.drawRRect(
      track,
      Paint()
        ..shader = Gradient.linear(
          rect.topCenter,
          rect.bottomCenter,
          _t > 0.5 ? _hot : const [_trackOff, Color(0xFFD3C6CE)],
        ),
    );

    final knobR = _trackH / 2 - 5;
    final knobX = left + 5 + knobR + (_trackW - 10 - knobR * 2) * _t;
    final knob = Offset(knobX, top + _trackH / 2);
    canvas.drawCircle(
      knob.translate(0, 2),
      knobR,
      Paint()
        ..color = const Color(0x334A2436)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
    );
    canvas.drawCircle(knob, knobR, Paint()..color = const Color(0xFFFFFFFF));
  }

  @override
  void onTapUp(TapUpEvent event) {
    game.audio.switched();
    onChanged();
  }
}

/// Sound, music and haptics.
class SettingsPanel extends ModalCard {
  SettingsPanel({required void Function() onClose})
    : super(
        title: '설정',
        actions: [ModalAction('닫기', onClose, primary: true)],
      );

  static const double _rowH = 76;
  static const double _rowGap = 20;
  static const double _creditH = 46;

  /// Three rows, the gaps between them, and the credit line under it all.
  @override
  double get bodyHeight => _rowH * 3 + _rowGap * 2 + _creditH;

  @override
  Future<void> buildBody(Rect body) async {
    final settings = game.settings;
    final rowSize = Vector2(body.width, _rowH);
    var y = body.top;

    await addToBody(
      _VolumeRow(
        label: '배경음악',
        read: () => settings.musicVolume,
        write: settings.setMusicVolume,
        onMute: () {
          settings.toggleMusic();
          settings.tapFeedback();
        },
        position: Vector2(body.left, y),
        size: rowSize,
      ),
    );
    y += _rowH + _rowGap;

    await addToBody(
      _VolumeRow(
        label: '효과음',
        read: () => settings.soundVolume,
        write: settings.setSoundVolume,
        onMute: () {
          settings.toggleSound();
          settings.tapFeedback();
        },
        position: Vector2(body.left, y),
        size: rowSize,
      ),
    );
    y += _rowH + _rowGap;

    await addToBody(
      _ToggleRow(
        label: '진동',
        read: () => settings.haptics,
        onChanged: () {
          settings.toggleHaptics();
          // Fired after the toggle, so switching it off is silent and switching
          // it on confirms itself.
          settings.tapFeedback();
        },
        position: Vector2(body.left, y),
        size: rowSize,
      ),
    );
    y += _rowH + _rowGap;

    // Not decoration and not optional. 魔王魂's licence permits commercial use
    // free of charge and asks for exactly one thing in return — a credit — so
    // it lives where a player can actually find it rather than in a repo file
    // nobody ships. Kenney's sounds are CC0 and ask for nothing; naming them
    // costs a line and is the decent thing.
    await addToBody(
      TextComponent(
        text: '음악: 魔王魂  ·  효과음: Kenney',
        anchor: Anchor.topCenter,
        position: Vector2(body.left + body.width / 2, y + 6),
        textRenderer: AppText.paint(
          size: 21,
          color: _mutedInk,
          onArt: false,
        ),
      ),
    );
  }
}
