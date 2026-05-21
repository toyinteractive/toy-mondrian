import { GamePhase, type GameState } from '../engine/types';
import lineUrl from '../assets/sounds/line.wav';
import moveUrl from '../assets/sounds/move.wav';
import rotateUrl from '../assets/sounds/rotate.wav';
import victoryUrl from '../assets/sounds/victory.wav';

type SfxId = 'move' | 'rotate' | 'line' | 'victory';

type SfxController = {
  installUnlockHandlers: () => void;
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

export function createSfxController(): SfxController {
  let volume = readPersistedVolume();
  let muted = volume <= 0.0001;
  let lastNonZeroVolume = muted ? DEFAULT_VOLUME : volume;
  const sounds: Record<SfxId, HTMLAudioElement> = {
    move: new Audio(moveUrl),
    rotate: new Audio(lineUrl),
    line: new Audio(rotateUrl),
    victory: new Audio(victoryUrl),
  };

  for (const audio of Object.values(sounds)) {
    audio.preload = 'auto';
    audio.volume = volume;
  }

  let unlocked = false;
  let lastMoveAt = 0;

  const removeUnlockHandlers = (): void => {
    window.removeEventListener('pointerdown', tryUnlock, true);
    window.removeEventListener('keydown', tryUnlock, true);
    window.removeEventListener('touchstart', tryUnlock, true);
  };

  const tryUnlock = (): void => {
    if (unlocked) {
      return;
    }
    unlocked = true;
    removeUnlockHandlers();
  };

  const play = (id: SfxId): void => {
    if (!unlocked) {
      return;
    }
    const audio = sounds[id];
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // Ignore transient browser playback failures.
    });
  };

  return {
    installUnlockHandlers: () => {
      // Capture phase ensures unlock runs before document/body input handlers.
      window.addEventListener('pointerdown', tryUnlock, { capture: true, passive: true });
      window.addEventListener('keydown', tryUnlock, { capture: true, passive: true });
      window.addEventListener('touchstart', tryUnlock, { capture: true, passive: true });
    },
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
      for (const audio of Object.values(sounds)) {
        audio.volume = volume;
      }
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
      for (const audio of Object.values(sounds)) {
        audio.volume = volume;
      }
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
      play('rotate');
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
