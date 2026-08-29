import 'dart:ui';

import 'package:flame/components.dart';
import 'package:flame/flame.dart';

/// What the character is doing. The animation follows from this rather than
/// being set directly, so no caller can leave her walking on the spot.
enum PlayerState { idle, walk, hurt }

/// The player character.
///
/// She knows how to stand, walk, and face a direction. She does not know what a
/// level is, what collecting something means, or when the stage ends — a scene
/// tells her where to go and reads whether she got there. Keeping her this
/// ignorant is what lets the same character appear in a stage with completely
/// different rules without being rewritten.
class Player extends PositionComponent {
  Player({required super.position, double height = 150})
    : super(
        size: Vector2(height * _frame.x / _frame.y, height),
        anchor: Anchor.bottomCenter,
      );

  /// Design-space pixels per second. Fast enough not to feel like a chore over
  /// the width of the screen, slow enough that the walk cycle reads.
  static const double speed = 235;

  /// How close counts as arrived. Without a tolerance the character overshoots
  /// the target by a fraction of a pixel every frame and jitters forever.
  static const double _arrival = 3;

  /// Frame size, shared by every sheet.
  ///
  /// The pack ships 128×128 frames in which the character occupies a 34×45
  /// patch in one corner — so she rendered small and 7px off-centre, and the
  /// box the scene positions had almost nothing to do with where she appeared.
  /// The sheets are cropped to one shared rect at 59×57; sharing it is what
  /// keeps her from jumping when the animation changes.
  static final Vector2 _frame = Vector2(59, 57);

  late final SpriteAnimationComponent _body;
  late final Map<PlayerState, SpriteAnimation> _animations;

  PlayerState _state = PlayerState.idle;
  Vector2? _target;
  bool _facingLeft = false;

  /// Where she is headed, or null if she is standing still.
  Vector2? get target => _target;
  bool get isWalking => _target != null;

  @override
  Future<void> onLoad() async {
    await super.onLoad();

    Future<SpriteAnimation> sheet(String name, int frames, double step) async {
      return SpriteAnimation.fromFrameData(
        await Flame.images.load('character/schoolgirl_$name.png'),
        SpriteAnimationData.sequenced(
          amount: frames,
          stepTime: step,
          textureSize: _frame,
        ),
      );
    }

    _animations = {
      PlayerState.idle: await sheet('idle', 4, 0.18),
      PlayerState.walk: await sheet('walk', 6, 0.1),
      PlayerState.hurt: await sheet('hurt', 2, 0.12),
    };

    _body = SpriteAnimationComponent(
      animation: _animations[PlayerState.idle],
      size: size,
      anchor: Anchor.center,
      position: size / 2,
      // Pixel art scaled up with the default smoothing turns to mush — every
      // hard edge the artist drew gets averaged away. Nearest-neighbour keeps
      // the pixels as pixels, which is the whole point of the style.
      paint: Paint()
        ..filterQuality = FilterQuality.none
        ..isAntiAlias = false,
    );
    await add(_body);
  }

  /// Sets a destination. Repeated calls simply retarget, so tapping again while
  /// she is already walking redirects her instead of queueing a second trip.
  void walkTo(Vector2 destination) => _target = destination.clone();

  void stop() => _target = null;

  void _setState(PlayerState next) {
    if (_state == next) return;
    _state = next;
    _body.animation = _animations[next];
  }

  /// A soft ellipse under her feet.
  ///
  /// Without it she reads as pasted onto the background rather than standing on
  /// it — the sprite has no ground of its own and the stage has no floor line.
  @override
  void render(Canvas canvas) {
    super.render(canvas);
    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(size.x / 2, size.y - 4),
        width: size.x * 0.52,
        height: size.x * 0.16,
      ),
      Paint()
        ..color = const Color(0x424A2436)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
    );
  }

  @override
  void update(double dt) {
    super.update(dt);

    final destination = _target;
    if (destination == null) {
      _setState(PlayerState.idle);
      return;
    }

    final delta = destination - position;
    final distance = delta.length;
    if (distance <= _arrival) {
      position.setFrom(destination);
      _target = null;
      _setState(PlayerState.idle);
      return;
    }

    // Never step past the target: at this speed a single frame can cover more
    // ground than remains, and overshooting reads as a stutter on arrival.
    final step = (speed * dt).clamp(0.0, distance);
    position += delta.normalized() * step;

    // Flipped only when the direction actually changes. Setting the scale every
    // frame would fight anything else that wants to scale her.
    final wantsLeft = delta.x < 0;
    if (wantsLeft != _facingLeft) {
      _facingLeft = wantsLeft;
      _body.scale = Vector2(wantsLeft ? -1 : 1, 1);
    }

    _setState(PlayerState.walk);
  }
}
