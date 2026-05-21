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

export function createSfxController(): SfxController {
  let volume = readPersistedVolume();
  let muted = volume <= 0.0001;
  let lastNonZeroVolume = muted ? DEFAULT_VOLUME : volume;

  const audioContext = new AudioContext();
  const masterGain = audioContext.createGain();
  masterGain.connect(audioContext.destination);

  const buffers: Partial<Record<SfxId, AudioBuffer>> = {};
  let buffersReady = false;
  let buffersPromise: Promise<void> | null = null;

  const loadBuffers = (): Promise<void> => {
    if (buffersPromise) {
      return buffersPromise;
    }

    buffersPromise = (async () => {
      const entries = Object.entries(SFX_URLS) as [SfxId, string][];
      await Promise.all(
        entries.map(async ([id, url]) => {
          const response = await fetch(url);
          const data = await response.arrayBuffer();
          buffers[id] = await audioContext.decodeAudioData(data);
        })
      );
      buffersReady = true;
    })().catch(() => {
      buffersPromise = null;
    });

    return buffersPromise;
  };

  void loadBuffers();

  let unlocked = false;
  let lastMoveAt = 0;

  const applyMasterVolume = (): void => {
    masterGain.gain.setValueAtTime(muted ? 0 : volume, audioContext.currentTime);
  };

  applyMasterVolume();

  const unlock = (): void => {
    if (typeof window === 'undefined') {
      unlocked = true;
      return;
    }

    unlocked = true;

    if (muted) {
      return;
    }

    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }

    void loadBuffers();
  };

  const playBuffer = (id: SfxId): void => {
    const buffer = buffers[id];
    if (!buffer) {
      return;
    }

    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(masterGain);
    source.start(0);
    source.addEventListener(
      'ended',
      () => {
        source.disconnect();
      },
      { once: true }
    );
  };

  const play = (id: SfxId): void => {
    if (!unlocked || muted) {
      return;
    }

    if (!buffersReady) {
      void loadBuffers().then(() => {
        if (unlocked && !muted && buffersReady) {
          playBuffer(id);
        }
      });
      return;
    }

    playBuffer(id);
  };

  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      void audioContext.suspend();
      return;
    }

    if (document.visibilityState === 'visible' && unlocked && !muted) {
      void audioContext.resume();
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
      applyMasterVolume();
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
      applyMasterVolume();
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
