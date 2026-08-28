import 'package:flame_game/core/event_bus.dart';
import 'package:flame_game/core/events.dart';
import 'package:flame_game/core/game_frame.dart';
import 'package:flame_game/core/game_session.dart';
import 'package:flame_game/core/design.dart';
import 'package:flame_game/core/scene_id.dart';
import 'package:flame_game/core/scene_manager.dart';
import 'package:flame/components.dart';
import 'package:flame_game/systems/game_system.dart';
import 'package:flame_game/ui/modal_card.dart';
import 'package:flame_game/ui/settings_panel.dart';
import 'package:flame_game/world/game_object.dart';
import 'package:flame_test/flame_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  // GameSettings reads preferences over a platform channel, which has no
  // implementation under flutter_test — without a stub the failed call surfaces
  // as an uncaught error and fails whichever test happens to be running.
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

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

  group('modals', () {
    final gameTester = FlameTester(GameFrame.new);

    gameTester.testGameWidget(
      'a modal sits above the scene and dims past the design rectangle',
      verify: (game, tester) async {
        final scene = game.currentScene!;
        scene.openModal(
          ConfirmDialog(
            title: '그만할까요?',
            message: '점수가 사라져요.',
            confirmLabel: '네',
            onConfirm: () {},
            onCancel: () {},
          ),
        );
        await tester.pump(const Duration(milliseconds: 16));
        await tester.pump(const Duration(milliseconds: 16));

        // In the world, not on the game root: CameraComponent renders at the
        // maximum priority, so a root-level modal can never cover the scene.
        final modals = game.world.children.whereType<ModalCard>();
        expect(modals, hasLength(1));
        expect(game.children.whereType<ModalCard>(), isEmpty);
        expect(scene.hasModal, isTrue);

        // And it must outrank the scene manager, or it would draw underneath
        // the very scene it is interrupting.
        final manager = game.world.children.whereType<SceneManager>().single;
        expect(modals.single.priority, greaterThan(manager.priority));

        // The dimmable area has to be the whole viewport. On anything taller
        // than 9:16 that is strictly larger than the design rectangle, and
        // dimming only the design rectangle is what leaves lit bands.
        final visible = game.camera.visibleWorldRect;
        expect(visible.width, greaterThanOrEqualTo(Design.width));
        expect(visible.height, greaterThanOrEqualTo(Design.height));
      },
    );

    gameTester.testGameWidget(
      'leaving a scene takes its modal with it',
      verify: (game, tester) async {
        final scene = game.currentScene!;
        scene.openModal(SettingsPanel(onClose: () {}));
        await tester.pump(const Duration(milliseconds: 16));
        await tester.pump(const Duration(milliseconds: 16));
        expect(game.world.children.whereType<ModalCard>(), hasLength(1));

        game.bus.emit(const SceneRequested(SceneId.game));
        await tester.pump(const Duration(milliseconds: 16));
        await tester.pump(const Duration(milliseconds: 16));

        // A modal stranded after its scene is gone would sit over the next
        // scene with no way to dismiss it.
        expect(game.world.children.whereType<ModalCard>(), isEmpty);
      },
    );
  });
}
