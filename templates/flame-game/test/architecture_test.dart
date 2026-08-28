import 'package:flame_game/core/event_bus.dart';
import 'package:flame_game/core/events.dart';
import 'package:flame_game/core/game_frame.dart';
import 'package:flame_game/core/game_session.dart';
import 'package:flame_game/core/scene_id.dart';
import 'package:flame/components.dart';
import 'package:flame_game/systems/game_system.dart';
import 'package:flame_game/world/game_object.dart';
import 'package:flame_test/flame_test.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('EventBus', () {
    test('delivers only the requested type', () async {
      final bus = EventBus();
      final seen = <String>[];
      bus.on<ButtonPressed>().listen((e) => seen.add(e.id));

      bus
        ..emit(const ButtonPressed('start'))
        ..emit(const GameStarted())
        ..emit(const ButtonPressed('quit'));
      await Future<void>.delayed(Duration.zero);

      expect(seen, ['start', 'quit']);
      await bus.dispose();
    });

    test('keeps a bounded history', () async {
      final bus = EventBus(historyLimit: 2);
      bus
        ..emit(const ScoreChanged(1))
        ..emit(const ScoreChanged(2))
        ..emit(const ScoreChanged(3));

      expect(bus.history.length, 2);
      expect(bus.history.last.label, 'ScoreChanged(3)');
      await bus.dispose();
    });

    test('emitting after dispose is a no-op, not a crash', () async {
      final bus = EventBus();
      await bus.dispose();
      expect(() => bus.emit(const GameStarted()), returnsNormally);
    });
  });

  group('GameSession', () {
    test('remembers the best run across runs', () {
      final session = GameSession()
        ..beginRun()
        ..recordEnd(outcome: GameOutcome.cleared, score: 40)
        ..beginRun()
        ..recordEnd(outcome: GameOutcome.quit, score: 12);

      expect(session.lastScore, 12);
      expect(session.highScore, 40);
      expect(session.runCount, 2);
    });
  });

  group('tap-to-score loop', () {
    test('an actor reports its own defeat exactly once', () {
      var defeats = 0;
      final actor = Actor(
        position: Vector2.zero(),
        velocity: Vector2.zero(),
        radius: 40,
        onDefeated: (_) => defeats++,
      );

      expect(actor.isAlive, isTrue);
      actor.takeDamage(1);
      actor.takeDamage(1); // already dead — must not fire again

      expect(actor.isAlive, isFalse);
      expect(defeats, 1);
    });

    test('the score system counts pops and announces the total', () async {
      final bus = EventBus();
      final score = ScoreSystem()..onAttach(bus);
      final announced = <int>[];
      bus.on<ScoreChanged>().listen((e) => announced.add(e.score));

      bus
        ..emit(const TargetPopped(10))
        ..emit(const TargetPopped(10));
      await Future<void>.delayed(Duration.zero);

      expect(score.score, 20);
      expect(announced.last, 20);
      score.onDetach();
      await bus.dispose();
    });

    test('a detached score system stops counting', () async {
      final bus = EventBus();
      final score = ScoreSystem()..onAttach(bus);
      bus.emit(const TargetPopped(10));
      await Future<void>.delayed(Duration.zero);
      expect(score.score, 10);

      score.onDetach();
      bus.emit(const TargetPopped(10));
      await Future<void>.delayed(Duration.zero);

      expect(score.score, 10, reason: 'subscription must be cancelled');
      await bus.dispose();
    });
  });

  group('scene flow', () {
    final gameTester = FlameTester(GameFrame.new);

    gameTester.testGameWidget(
      'the frame is fully wired once loaded',
      verify: (game, tester) async {
        // Regression: the scene manager performs the first switch inside its own
        // onLoad, so anything that switch touches must be constructed before the
        // manager is added. Reading these is what a broken order throws on.
        expect(game.debugOverlay, isNotNull);
        expect(game.backdrop, isNotNull);
        expect(game.currentSceneId, isNotNull);
      },
    );

    gameTester.testGameWidget(
      'starts on the main menu',
      verify: (game, tester) async {
        expect(game.currentSceneId, SceneId.mainMenu);
      },
    );

    gameTester.testGameWidget(
      'a scene request moves the player and reports the change',
      verify: (game, tester) async {
        final changes = <String>[];
        game.bus.on<SceneChanged>().listen((e) => changes.add(e.to.name));

        game.bus.emit(const SceneRequested(SceneId.game));
        // The bus delivers on a microtask and mounting a scene costs a frame,
        // so a transition is never same-tick. Pump a few frames for it.
        for (var i = 0; i < 5; i++) {
          await tester.pump(const Duration(milliseconds: 16));
        }

        expect(game.currentSceneId, SceneId.game);
        expect(changes, contains('game'));
      },
    );

    gameTester.testGameWidget(
      'a repeat request for the live scene changes nothing',
      verify: (game, tester) async {
        await tester.pump();
        await game.sceneManager.switchTo(SceneId.game);
        final before = game.bus.history.length;

        await game.sceneManager.switchTo(SceneId.game);

        expect(game.currentSceneId, SceneId.game);
        expect(game.bus.history.length, before);
      },
    );

    gameTester.testGameWidget(
      'back-to-back requests all land, last one wins',
      verify: (game, tester) async {
        await tester.pump();
        // Fired without awaiting the first — the switch is atomic, so nothing
        // can be lost in between and the player ends up where they last asked.
        final first = game.sceneManager.switchTo(SceneId.gameEnd);
        await game.sceneManager.switchTo(SceneId.game);
        await first;
        for (var i = 0; i < 5; i++) {
          await tester.pump(const Duration(milliseconds: 16));
        }

        expect(game.currentSceneId, SceneId.game);
      },
    );
  });
}
