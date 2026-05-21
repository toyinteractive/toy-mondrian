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

  private readonly onRendererResize = (): void => {
    this.syncSprite();
  };

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
    this.app.renderer.on('resize', this.onRendererResize);
  }

  renderSnapshot(state: GameState): void {
    this.gridTextureBridge.composeWithActivePiece(state);
  }

  destroy(): void {
    this.app.renderer.off('resize', this.onRendererResize);
  }

  /** Sizes the landscape canvas host. Desktop/portrait rely on CSS for host dimensions. */
  applyLayout(): void {
    const gameLayout = this.hostElement.closest<HTMLElement>('.game-layout');
    if (!gameLayout) {
      this.clearHostInlineStyles();
      return;
    }

    if (window.matchMedia(LANDSCAPE_LAYOUT_QUERY).matches) {
      this.applyLandscapeLayout(gameLayout);
      return;
    }

    this.clearHostInlineStyles();
  }

  syncSprite(): void {
    const screen = this.app.screen;
    if (!screen) {
      return;
    }

    const { width: viewportWidth, height: viewportHeight } = screen;
    const isLandscapeLayout = window.matchMedia(LANDSCAPE_LAYOUT_QUERY).matches;

    this.app.renderer.background.color = isLandscapeLayout ? 0x111111 : 0xffffff;
    this.boardSprite.width = viewportWidth;
    this.boardSprite.height = viewportHeight;
    this.boardContainer.scale.set(1, 1);
    this.boardContainer.position.set(0, 0);
  }

  private applyLandscapeLayout(gameLayout: HTMLElement): void {
    const sidebar = gameLayout.querySelector<HTMLElement>('.sidebar');
    const layoutStyles = getComputedStyle(gameLayout);
    const frameGap = Number.parseFloat(layoutStyles.columnGap || layoutStyles.gap || '0') || 0;
    const frameBorder = Number.parseFloat(layoutStyles.getPropertyValue('--frame-border') || '0') || 0;
    const sidebarWidth = sidebar?.offsetWidth ?? 0;
    const layoutHeight = gameLayout.clientHeight;
    const layoutWidth = gameLayout.clientWidth;
    const boardAreaWidth = Math.max(0, layoutWidth - sidebarWidth - frameGap - frameBorder * 2);
    const boardAreaHeight = Math.max(0, layoutHeight - frameBorder * 2);

    let boardWidth = Math.floor((boardAreaHeight * BOARD_TEXTURE_WIDTH) / BOARD_TEXTURE_HEIGHT);

    if (boardWidth > boardAreaWidth) {
      boardWidth = boardAreaWidth;
    }

    this.hostElement.style.width = `${boardWidth}px`;
    this.hostElement.style.height = '100%';
    this.hostElement.style.maxWidth = `${boardAreaWidth}px`;
    this.hostElement.style.maxHeight = '100%';
  }

  private clearHostInlineStyles(): void {
    this.hostElement.style.width = '';
    this.hostElement.style.height = '';
    this.hostElement.style.maxWidth = '';
    this.hostElement.style.maxHeight = '';
  }
}
