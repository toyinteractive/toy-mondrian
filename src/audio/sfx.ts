import { GamePhase, type GameState } from '../engine/types';
import lineUrl from '../assets/sounds/line.wav';
import moveUrl from '../assets/sounds/move.wav';
import victoryUrl from '../assets/sounds/victory.wav';

type SfxId = 'move' | 'line' | 'victory';

type SfxController = {
  installUnlockHandlers: () => void;
  unlock: () => void;
  getVolume: () => number;
  isMuted: () => boolean;
  setVolume: (value: number) => void;
  toggleMute: () => { muted: boolean; volume: number };
  playMove: () => void;
  playRotate: () => void;
  playLine: () => void;
  playVictory: () => void;
};

const MOVE_MIN_INTERVAL_MS = 60;
const LINE_CLEAR_MIN_SCORE_GAIN = 100;
const VOLUME_STORAGE_KEY = 'toy-mondrian-sfx-volume';
const DEFAULT_VOLUME = 0.65;

/** Pool sizes — overlapping plays on one element drop sounds on iOS. */
const POOL_SIZES: Record<SfxId, number> = {
  move: 6,
  line: 2,
  victory: 1,
};

const SFX_URLS: Record<SfxId, string> = {
  move: moveUrl,
  line: lineUrl,
  victory: victoryUrl,
};

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_VOLUME;
  }
  return Math.max(0, Math.min(1, value));
}

function readPersistedVolume(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_VOLUME;
  }
  const raw = window.localStorage.getItem(VOLUME_STORAGE_KEY);
  if (raw === null) {
    return DEFAULT_VOLUME;
  }
  return clampVolume(Number.parseFloat(raw));
}

function configureAudioElement(audio: HTMLAudioElement): void {
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');
}

type SfxPool = {
  elements: HTMLAudioElement[];
  cursor: number;
};

function createPool(url: string, size: number): SfxPool {
  const elements = Array.from({ length: size }, () => {
    const audio = new Audio(url);
    configureAudioElement(audio);
    return audio;
  });
  return { elements, cursor: 0 };
}

export function createSfxController(): SfxController {
  let volume = readPersistedVolume();
  let muted = volume <= 0.0001;
  let lastNonZeroVolume = muted ? DEFAULT_VOLUME : volume;

  const pools: Record<SfxId, SfxPool> = {
    move: createPool(SFX_URLS.move, POOL_SIZES.move),
    line: createPool(SFX_URLS.line, POOL_SIZES.line),
    victory: createPool(SFX_URLS.victory, POOL_SIZES.victory),
  };

  const allElements = (): HTMLAudioElement[] => Object.values(pools).flatMap((pool) => pool.elements);

  const applyVolumeToAll = (): void => {
    for (const audio of allElements()) {
      audio.volume = volume;
    }
  };

  applyVolumeToAll();

  let unlocked = false;
  let lastMoveAt = 0;

  /** Must call play() synchronously inside the user gesture (iOS Safari). */
  const primeElement = (audio: HTMLAudioElement): void => {
    const targetVolume = audio.volume;
    audio.volume = 0.001;
    const playPromise = audio.play();
    if (playPromise === undefined) {
      audio.volume = targetVolume;
      return;
    }
    void playPromise
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = targetVolume;
      })
      .catch(() => {
        audio.volume = targetVolume;
      });
  };

  const unlock = (): void => {
    if (typeof window === 'undefined') {
      unlocked = true;
      return;
    }

    if (muted) {
      unlocked = true;
      return;
    }

    if (!unlocked) {
      for (const audio of allElements()) {
        primeElement(audio);
      }
    }

    unlocked = true;
  };

  const play = (id: SfxId): void => {
    if (!unlocked || muted) {
      return;
    }

    const pool = pools[id];
    const audio = pool.elements[pool.cursor];
    pool.cursor = (pool.cursor + 1) % pool.elements.length;

    audio.volume = volume;
    if (!audio.paused && audio.currentTime > 0) {
      audio.pause();
    }
    audio.currentTime = 0;
    void audio.play().catch(() => {
      unlocked = false;
    });
  };

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      unlocked = false;
    }
  };

  return {
    installUnlockHandlers: () => {
      if (typeof window === 'undefined') {
        return;
      }

      const onGesture = (): void => {
        unlock();
      };

      window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
      window.addEventListener('touchstart', onGesture, { capture: true, passive: true });
      window.addEventListener('keydown', onGesture, { capture: true, passive: true });
      document.addEventListener('visibilitychange', onVisibilityChange);
    },
    unlock,
    getVolume: () => volume,
    isMuted: () => muted,
    setVolume: (value: number) => {
      volume = clampVolume(value);
      if (volume > 0.0001) {
        muted = false;
        lastNonZeroVolume = volume;
      } else {
        muted = true;
      }
      applyVolumeToAll();
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
      }
    },
    toggleMute: () => {
      if (muted) {
        volume = clampVolume(lastNonZeroVolume > 0.0001 ? lastNonZeroVolume : DEFAULT_VOLUME);
        muted = false;
      } else {
        if (volume > 0.0001) {
          lastNonZeroVolume = volume;
        }
        volume = 0;
        muted = true;
      }
      applyVolumeToAll();
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
      }
      return { muted, volume };
    },
    playMove: () => {
      const now = performance.now();
      if (now - lastMoveAt < MOVE_MIN_INTERVAL_MS) {
        return;
      }
      lastMoveAt = now;
      play('move');
    },
    playRotate: () => {
      play('move');
    },
    playLine: () => {
      play('line');
    },
    playVictory: () => {
      play('victory');
    },
  };
}

export function applySfxForTransition(previous: GameState, current: GameState, sfx: SfxController): void {
  const softDropJustStarted = !previous.softDropActive && current.softDropActive;
  if (softDropJustStarted) {
    sfx.playMove();
  }

  const phaseJustClosed = previous.phase !== GamePhase.GalleryClosed && current.phase === GamePhase.GalleryClosed;
  if (phaseJustClosed) {
    sfx.playVictory();
    return;
  }

  const pieceLocked = current.blocksUsed > previous.blocksUsed;
  const newPieceWhileSoftDropping =
    pieceLocked && current.softDropActive && current.phase !== GamePhase.GalleryClosed && current.activePiece !== null;
  if (newPieceWhileSoftDropping) {
    sfx.playMove();
  }

  const scoreGained = current.score - previous.score;
  if (pieceLocked && scoreGained >= LINE_CLEAR_MIN_SCORE_GAIN) {
    sfx.playLine();
  }

  if (pieceLocked || !previous.activePiece || !current.activePiece) {
    return;
  }
  const previousPiece = previous.activePiece;
  const currentPiece = current.activePiece;

  const rotated = currentPiece.rotation !== previousPiece.rotation;
  if (rotated) {
    sfx.playRotate();
    return;
  }

  const movedHorizontally = currentPiece.position.x !== previousPiece.position.x;
  if (movedHorizontally) {
    sfx.playMove();
  }
}
