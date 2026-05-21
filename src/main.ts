import './style.css';
import { EngineRuntime } from './engine/runtime';
import { GamePhase, type GameState } from './engine/types';
import { createPixiApp } from './rendering/pixi-app';
import { MondrianScene } from './rendering/scene';
import { createUIRoot } from './ui/create-ui-root';
import { setupKeyboard } from './ui/keyboard-controller';
import { setupTouch } from './ui/touch-controller';
import { exportBoardAs4kJpegBlob } from './ui/board-jpeg-export';
import { createDownloadModal } from './ui/download-modal';
import { saveImageBlob } from './ui/save-image';
import { exportVectorArtFromGameState } from './ui/gallery-export';
import { setupHud, updateHud } from './ui/hud';
import { createBrandLogo } from './ui/brand-logo';
import { createConfettiOverlay } from './ui/confetti';
import { createLandingPage } from './ui/landing';
import { applySfxForTransition, createSfxController } from './audio/sfx';

function randomSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Date.now() >>> 0;
}

async function bootstrap(): Promise<void> {
  const appHost = document.querySelector<HTMLDivElement>('#app');
  if (!appHost) {
    throw new Error('Missing #app root element');
  }

  const appShell = document.createElement('div');
  appShell.className = 'app-shell app-shell--hidden';
  const gameLayout = document.createElement('div');
  gameLayout.className = 'game-layout';
  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'canvas-container';
  const sidebarContainer = document.createElement('div');
  sidebarContainer.className = 'sidebar';
  gameLayout.append(canvasContainer, sidebarContainer);

  const byline = document.createElement('p');
  byline.className = 'app-byline';
  byline.innerHTML = `
    Crafted with <span class="app-byline-heart" aria-hidden="true">♥️</span> by
    <a class="app-byline-link app-byline-link--amrit" href="https://amrit.art" target="_blank" rel="noopener noreferrer">Amrit</a>
    <span aria-hidden="true">&</span>
    <a class="app-byline-link app-byline-link--karan" href="https://karanwasabi.com" target="_blank" rel="noopener noreferrer">Karan</a>
  `;

  appShell.appendChild(gameLayout);

  const brandLogo = createBrandLogo();
  brandLogo.classList.add('app-brand-logo');

  appHost.append(brandLogo, appShell, byline);

  const revealGame = (instant: boolean): void => {
    appHost.classList.add('app--game-reveal');
    appShell.classList.remove('app-shell--hidden');

    const applyRevealed = (): void => {
      appHost.classList.add('app--game-revealed');
      appShell.classList.add('app-shell--revealed');
      brandLogo.classList.add('app-brand-logo--revealed');
    };

    if (instant) {
      applyRevealed();
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(applyRevealed);
    });
  };

  const landing = createLandingPage({
    onPlayPressed: () => {
      const reducedMotion =
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      revealGame(reducedMotion);
    },
  });
  appHost.prepend(landing.root);

  const app = await createPixiApp(canvasContainer);
  canvasContainer.appendChild(app.canvas);

  const scene = new MondrianScene(app, canvasContainer);

  const refreshRendererLayout = (): void => {
    scene.applyLayout();
    requestAnimationFrame(() => {
      app.resize();
      scene.syncSprite();
    });
  };
  window.addEventListener('resize', refreshRendererLayout);
  window.visualViewport?.addEventListener('resize', refreshRendererLayout);
  for (const query of ['(orientation: landscape)', '(orientation: portrait)'] as const) {
    window.matchMedia(query).addEventListener('change', refreshRendererLayout);
  }
  const layoutObserver = new ResizeObserver(refreshRendererLayout);
  layoutObserver.observe(appShell);
  layoutObserver.observe(gameLayout);
  layoutObserver.observe(sidebarContainer);
  const runtime = new EngineRuntime({ seed: randomSeed() });
  const sfx = createSfxController();
  const confetti = createConfettiOverlay(document.body);
  sfx.installUnlockHandlers();

  let latestState: GameState | null = null;
  let previousSnapshot: GameState | null = null;
  const uiRoot = createUIRoot();
  sidebarContainer.appendChild(uiRoot);

  const triggerDownload = (blob: Blob, filename: string): void => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadModal = createDownloadModal(document.body, {
    onDownloadVector: async () => {
      if (!latestState || latestState.phase !== GamePhase.GalleryClosed) {
        return;
      }
      const svg = await exportVectorArtFromGameState(latestState, 50);
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      triggerDownload(blob, 'toy-mondrian.svg');
    },
    onDownloadImage: async () => {
      if (!latestState || latestState.phase !== GamePhase.GalleryClosed) {
        return;
      }
      const blob = await exportBoardAs4kJpegBlob(latestState);
      await saveImageBlob(blob, 'toy-mondrian.jpg');
    },
  });

  setupHud(uiRoot, {
    initialVolume: sfx.getVolume(),
    initialMuted: sfx.isMuted(),
    onVolumeChange: (volume) => {
      sfx.setVolume(volume);
      sfx.playMove();
    },
    onVolumeToggleMute: () => {
      const result = sfx.toggleMute();
      if (!result.muted) {
        sfx.playMove();
      }
      return result;
    },
    onDownload: () => {
      if (!latestState || latestState.phase !== GamePhase.GalleryClosed) {
        return;
      }
      downloadModal.open();
    },
    onRestart: () => {
      confetti.stop();
      runtime.restart(randomSeed());
    },
  });

  const canDispatchInput = (): boolean => runtime.getState().phase !== GamePhase.GalleryClosed;
  setupKeyboard((command) => runtime.enqueueCommand(command, 'keyboard'), canDispatchInput);
  setupTouch((command) => runtime.enqueueCommand(command, 'touch'), canDispatchInput, canvasContainer);

  runtime.onSnapshot((state) => {
    if (previousSnapshot) {
      applySfxForTransition(previousSnapshot, state, sfx);
      if (previousSnapshot.phase !== GamePhase.GalleryClosed && state.phase === GamePhase.GalleryClosed) {
        confetti.burst();
      }
    }
    latestState = state;
    previousSnapshot = state;
    scene.renderSnapshot(state);
    updateHud(state);
  });

  await landing.waitUntilDismissed();
  requestAnimationFrame(refreshRendererLayout);
  runtime.start();
}

void bootstrap();
