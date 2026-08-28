import 'package:flame/components.dart';

/// The one virtual resolution the whole game lays out in.
///
/// Every scene positions things in this space and the camera letterboxes it onto
/// whatever the device actually is. That is what makes the layout identical on a
/// tall phone, a short phone, a tablet and a resizable desktop window — instead
/// of each scene doing its own arithmetic against the real screen size and
/// drifting apart as aspect ratios change.
///
/// 9:16 portrait, because this ships as a phone app first.
final class Design {
  const Design._();

  static const double width = 720;
  static const double height = 1280;

  static Vector2 get size => Vector2(width, height);
  static Vector2 get center => Vector2(width / 2, height / 2);

  /// Safe inset from the edges, so nothing sits under a notch or a home bar.
  static const double margin = 44;
}
