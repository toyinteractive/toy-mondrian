import { Container, Sprite } from 'pixi.js';
import { BOARD_TEXTURE_HEIGHT, BOARD_TEXTURE_WIDTH, GridTextureBridge } from './grid-texture';
import type { Application } from 'pixi.js';
import type { GameState } from '../engine/types';

const LANDSCAPE_LAYOUT_QUERY = '(max-width: 1280px) and (orientation: landscape)';

export class MondrianScene {
  private readonly app: Application;

  private readonly hostElement: HTMLElement;

  private readonly boardContainer: Container;

  private readonly boardSprite: Sprite;

  private readonly gridTextureBridge: GridTextureBridge;

  constructor(app: Application, hostElement: HTMLElement) {
    this.app = app;
    this.hostElement = hostElement;
    this.gridTextureBridge = new GridTextureBridge();
    this.boardContainer = new Container({ label: 'board-container' });
    this.boardSprite = new Sprite(this.gridTextureBridge.texture);
    this.boardSprite.roundPixels = true;

    this.boardContainer.addChild(this.boardSprite);
    this.app.stage.addChild(this.boardContainer);

    this.applyLayout();
    this.syncSprite();
    this.app.renderer.on('resize', this.syncSprite);
  }

  renderSnapshot(state: GameState): void {
    this.gridTextureBridge.composeWithActivePiece(state);
  }

  destroy(): void {
    this.app.renderer.off('resize', this.syncSprite);
  }

  /** Sizes the landscape canvas host to the largest board that fits the shell. */
  applyLayout(): void {
    const isLandscapeLayout = window.matchMedia(LANDSCAPE_LAYOUT_QUERY).matches;
    const gameLayout = this.hostElement.closest<HTMLElement>('.game-layout');

    if (!isLandscapeLayout || !gameLayout) {
      this.clearLandscapeInlineStyles();
      return;
    }

    const sidebar = gameLayout.querySelector<HTMLElement>('.sidebar');
    const layoutStyles = getComputedStyle(gameLayout);
    const frameGap = Number.parseFloat(layoutStyles.columnGap || layoutStyles.gap || '0') || 0;
    const frameBorder = Number.parseFloat(layoutStyles.getPropertyValue('--frame-border') || '0') || 0;
    const sidebarWidth = sidebar?.offsetWidth ?? 0;
    const layoutHeight = gameLayout.clientHeight;
    const layoutWidth = gameLayout.clientWidth;
    const boardAreaWidth = Math.max(0, layoutWidth - sidebarWidth - frameGap - frameBorder * 2);
    const boardAreaHeight = Math.max(0, layoutHeight - frameBorder * 2);

    // Fill available height first so there is no grey band above/below the playfield.
    let boardWidth = Math.floor((boardAreaHeight * BOARD_TEXTURE_WIDTH) / BOARD_TEXTURE_HEIGHT);

    if (boardWidth > boardAreaWidth) {
      boardWidth = boardAreaWidth;
    }

    this.hostElement.style.width = `${boardWidth}px`;
    this.hostElement.style.height = '100%';
    this.hostElement.style.maxWidth = `${boardAreaWidth}px`;
    this.hostElement.style.maxHeight = '100%';
  }

  private clearLandscapeInlineStyles(): void {
    this.hostElement.style.width = '';
    this.hostElement.style.height = '';
    this.hostElement.style.maxWidth = '';
    this.hostElement.style.maxHeight = '';
  }

  private syncSprite = (): void => {
    const { width: viewportWidth, height: viewportHeight } = this.app.screen;
    const isLandscapeLayout = window.matchMedia(LANDSCAPE_LAYOUT_QUERY).matches;

    if (isLandscapeLayout) {
      this.app.renderer.background.color = 0x111111;
      this.boardSprite.width = viewportWidth;
      this.boardSprite.height = viewportHeight;
      this.boardContainer.scale.set(1, 1);
      this.boardContainer.position.set(0, 0);
      return;
    }

    this.app.renderer.background.color = 0xffffff;

    const scale = Math.max(
      1,
      Math.floor(Math.min(viewportWidth / BOARD_TEXTURE_WIDTH, viewportHeight / BOARD_TEXTURE_HEIGHT))
    );
    const boardWidth = BOARD_TEXTURE_WIDTH * scale;
    const boardHeight = BOARD_TEXTURE_HEIGHT * scale;

    this.boardSprite.width = boardWidth;
    this.boardSprite.height = boardHeight;
    this.boardContainer.scale.set(1, 1);
    this.boardContainer.position.set(
      Math.floor((viewportWidth - boardWidth) * 0.5),
      Math.floor((viewportHeight - boardHeight) * 0.5)
    );
  };
}
