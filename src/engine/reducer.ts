import { findLenientSpawnY, isValidPosition, willCollideAtOffset } from './collision';
import {
  gravityMsForElapsed,
  LINE_CLEAR_BASE_SCORE,
  PASSIVE_SCORE_PER_SECOND,
  PIECE_LOCAL_CELLS,
  SPAWN_Y,
} from './constants';
import { processLineClears } from './line-clear';
import { getNextPiece } from './piece-bag';
import {
  GamePhase,
  type ActivePiece,
  type CellColorId,
  type GameState,
  type QueuedCommand,
  type TickAction,
} from './types';

const SOFT_DROP_INTERVAL_MS = 50;

export function reduce(state: GameState, action: QueuedCommand | TickAction): GameState {
  if (isTickAction(action)) {
    return applyTick(state, action);
  }

  if (state.phase === GamePhase.GalleryClosed) {
    return state;
  }

  switch (action.command.type) {
    case 'MoveLeft':
      return tryMoveHorizontal(state, -1);
    case 'MoveRight':
      return tryMoveHorizontal(state, 1);
    case 'RotateCW':
      return tryRotateClockwise(state);
    case 'SoftDropStart':
      return {
        ...state,
        softDropActive: true,
      };
    case 'SoftDropStop':
      return {
        ...state,
        softDropActive: false,
      };
    case 'SoftDropStep':
      return tryStepDrop(state);
    default:
      return state;
  }
}

function isTickAction(action: QueuedCommand | TickAction): action is TickAction {
  return 'type' in action && action.type === 'TickAction';
}

function tryMoveHorizontal(state: GameState, deltaX: number): GameState {
  if (!state.activePiece || state.lockPending) {
    return state;
  }

  if (willCollideAtOffset(state, state.activePiece, deltaX, 0)) {
    return state;
  }

  return {
    ...state,
    activePiece: {
      ...state.activePiece,
      position: {
        x: state.activePiece.position.x + deltaX,
        y: state.activePiece.position.y,
      },
    },
  };
}

function tryRotateClockwise(state: GameState): GameState {
  if (!state.activePiece || state.lockPending) {
    return state;
  }

  const rotatedCells = rotateCellsClockwise(state.activePiece.cells);
  const rotatedPiece: ActivePiece = {
    ...state.activePiece,
    rotation: ((state.activePiece.rotation + 1) % 4) as ActivePiece['rotation'],
    cells: rotatedCells,
  };

  const wallKickOffsets = [0, 1, -1, 2, -2];
  for (const offsetX of wallKickOffsets) {
    const targetX = rotatedPiece.position.x + offsetX;
    const targetY = rotatedPiece.position.y;
    if (!isValidPosition(state, rotatedPiece, targetX, targetY)) {
      continue;
    }

    return {
      ...state,
      activePiece: {
        ...rotatedPiece,
        position: {
          x: targetX,
          y: targetY,
        },
      },
    };
  }

  return state;
}

function applyTick(state: GameState, action: TickAction): GameState {
  if (state.phase === GamePhase.GalleryClosed) {
    return state;
  }

  const runningState =
    state.phase === GamePhase.Idle
      ? {
          ...state,
          phase: GamePhase.Running,
        }
      : state;
  const timeProgressedState = applyTimeProgression(runningState, action.deltaMs);

  if (timeProgressedState.lockPending) {
    return resolveLockPending(timeProgressedState);
  }

  if (!timeProgressedState.activePiece) {
    return {
      ...timeProgressedState,
      tick: timeProgressedState.tick + 1,
    };
  }

  const activeDropInterval = timeProgressedState.softDropActive ? SOFT_DROP_INTERVAL_MS : timeProgressedState.gravityMs;
  const nextDropCounter = timeProgressedState.dropCounterMs + action.deltaMs;
  if (nextDropCounter < activeDropInterval) {
    return {
      ...timeProgressedState,
      tick: timeProgressedState.tick + 1,
      dropCounterMs: nextDropCounter,
    };
  }

  if (willCollideAtOffset(timeProgressedState, timeProgressedState.activePiece, 0, 1)) {
    return resolveLockPending(triggerLockPiece(timeProgressedState));
  }

  return {
    ...timeProgressedState,
    tick: timeProgressedState.tick + 1,
    dropCounterMs: nextDropCounter - activeDropInterval,
    activePiece: {
      ...timeProgressedState.activePiece,
      position: {
        x: timeProgressedState.activePiece.position.x,
        y: timeProgressedState.activePiece.position.y + 1,
      },
    },
  };
}

function tryStepDrop(state: GameState): GameState {
  if (!state.activePiece || state.lockPending) {
    return state;
  }

  if (willCollideAtOffset(state, state.activePiece, 0, 1)) {
    return triggerLockPiece(state);
  }

  return {
    ...state,
    activePiece: {
      ...state.activePiece,
      position: {
        x: state.activePiece.position.x,
        y: state.activePiece.position.y + 1,
      },
    },
  };
}

function triggerLockPiece(state: GameState): GameState {
  return {
    ...state,
    tick: state.tick + 1,
    dropCounterMs: 0,
    lockPending: true,
  };
}

function resolveLockPending(state: GameState): GameState {
  if (!state.activePiece) {
    return {
      ...state,
      lockPending: false,
    };
  }

  const stampedGrid = stampActivePieceIntoGrid(state.cells, state.activePiece, state.boardSize.width);
  const { newGrid, linesCleared } = processLineClears(stampedGrid);
  const scoreGain = calculateLineClearScore(linesCleared);
  const nextScore = state.score + scoreGain;
  const nextBlocksUsed = state.blocksUsed + state.activePiece.cells.length;

  const reachedTopRow = hasOccupiedTopRow(newGrid, state.boardSize.width);
  if (reachedTopRow) {
    return {
      ...state,
      cells: newGrid,
      score: nextScore,
      blocksUsed: nextBlocksUsed,
      activePiece: null,
      lockPending: false,
      phase: GamePhase.GalleryClosed,
    };
  }

  const { pieceKind, colorId, bagState, rngState } = getNextPiece(state.rngState, state.pieceBag);
  const nextActivePiece = createSpawnedPiece(pieceKind, colorId, state.boardSize.width);
  const isSpawnBlocked = !isValidPosition(
    { boardSize: state.boardSize, cells: newGrid },
    nextActivePiece,
    nextActivePiece.position.x,
    nextActivePiece.position.y
  );

  if (isSpawnBlocked) {
    const spawnX = nextActivePiece.position.x;
    const lenientY = findLenientSpawnY({ boardSize: state.boardSize, cells: newGrid }, nextActivePiece, spawnX);
    const placedPiece: ActivePiece =
      lenientY !== null
        ? {
            ...nextActivePiece,
            position: { x: spawnX, y: lenientY },
          }
        : nextActivePiece;

    return {
      ...state,
      cells: newGrid,
      score: nextScore,
      blocksUsed: nextBlocksUsed,
      pieceBag: bagState,
      rngState,
      activePiece: placedPiece,
      lockPending: false,
      phase: GamePhase.GalleryClosed,
    };
  }

  return {
    ...state,
    cells: newGrid,
    score: nextScore,
    blocksUsed: nextBlocksUsed,
    pieceBag: bagState,
    rngState,
    activePiece: nextActivePiece,
    lockPending: false,
    phase: state.phase,
  };
}

function stampActivePieceIntoGrid(grid: Uint8Array, piece: ActivePiece, boardWidth: number): Uint8Array {
  const nextGrid = new Uint8Array(grid);

  for (const cell of piece.cells) {
    const worldX = piece.position.x + cell.x;
    const worldY = piece.position.y + cell.y;
    const index = worldY * boardWidth + worldX;
    nextGrid[index] = cell.color;
  }

  return nextGrid;
}

function hasOccupiedTopRow(grid: Uint8Array, boardWidth: number): boolean {
  for (let x = 0; x < boardWidth; x += 1) {
    if (grid[x] !== 0) {
      return true;
    }
  }
  return false;
}

function calculateLineClearScore(linesCleared: number): number {
  if (linesCleared <= 0) {
    return 0;
  }

  // Matches prototype combo sweep: 100 + 200 + 400 ... per additional row.
  return LINE_CLEAR_BASE_SCORE * (2 ** linesCleared - 1);
}

function createSpawnedPiece(kind: ActivePiece['kind'], colorId: CellColorId, boardWidth: number): ActivePiece {
  const localCells = PIECE_LOCAL_CELLS[kind];
  const pieceWidth = getPieceWidth(localCells);
  const spawnX = Math.floor((boardWidth - pieceWidth) / 2);

  return {
    kind,
    rotation: 0,
    color: colorId,
    position: {
      x: spawnX,
      y: SPAWN_Y,
    },
    cells: localCells.map((cell) => ({
      x: cell.x,
      y: cell.y,
      color: colorId,
    })),
  };
}

function getPieceWidth(cells: readonly { x: number; y: number }[]): number {
  let maxX = 0;
  for (const cell of cells) {
    if (cell.x > maxX) {
      maxX = cell.x;
    }
  }
  return maxX + 1;
}

function rotateCellsClockwise(cells: ActivePiece['cells']): ActivePiece['cells'] {
  let maxX = 0;
  let maxY = 0;

  for (const cell of cells) {
    if (cell.x > maxX) {
      maxX = cell.x;
    }
    if (cell.y > maxY) {
      maxY = cell.y;
    }
  }

  const size = Math.max(maxX, maxY) + 1;
  return cells.map((cell) => ({
    x: size - 1 - cell.y,
    y: cell.x,
    color: cell.color,
  }));
}

function applyTimeProgression(state: GameState, deltaMs: number): GameState {
  if (deltaMs <= 0) {
    return state;
  }

  const nextElapsedMs = state.elapsedMs + deltaMs;
  const wholeSecondsElapsed = Math.floor(nextElapsedMs / 1000);
  const newSeconds = wholeSecondsElapsed - state.secondsElapsed;
  const nextGravity = gravityMsForElapsed(nextElapsedMs);

  if (newSeconds <= 0) {
    return {
      ...state,
      elapsedMs: nextElapsedMs,
      gravityMs: nextGravity,
    };
  }

  return {
    ...state,
    elapsedMs: nextElapsedMs,
    secondsElapsed: wholeSecondsElapsed,
    score: state.score + newSeconds * PASSIVE_SCORE_PER_SECOND,
    gravityMs: nextGravity,
  };
}
