import { createBrandLogo } from './brand-logo';

const FADE_MS = 500;
/** Fallback if animationend does not fire (morph delay 5.35s + 1.05s). */
const LOGO_INTRO_FALLBACK_MS = 6450;

function appendFallingTitleLine(parent: HTMLElement, text: string, startIndex: number): number {
  const line = document.createElement('span');
  line.className = 'landing-title-line';

  let index = startIndex;
  for (const char of text) {
    const glyph = document.createElement('span');
    glyph.className = 'landing-title-char';
    glyph.textContent = char;
    glyph.style.setProperty('--landing-block-i', String(index));
    glyph.style.setProperty('--landing-block-drift', `${((index % 3) - 1) * 9}px`);
    line.appendChild(glyph);
    index += 1;
  }

  parent.appendChild(line);
  return index;
}

function createDesktopTitle(): HTMLDivElement {
  const title = document.createElement('div');
  title.className = 'landing-title landing-title--desktop';

  const toyObjects = document.createElement('div');
  toyObjects.className =
    'landing-title-group landing-title-group--toy-objects landing-animate-item landing-animate-item--toy-objects';
  for (const line of ['TOY', 'OBJECTS']) {
    const span = document.createElement('span');
    span.className = 'landing-title-line';
    span.textContent = line;
    toyObjects.appendChild(span);
  }

  const mondrianBlocks = document.createElement('div');
  mondrianBlocks.className =
    'landing-title-group landing-title-group--mondrian-blocks landing-animate-item landing-animate-item--mondrian-blocks';
  let blockIndex = 0;
  blockIndex = appendFallingTitleLine(mondrianBlocks, 'MONDRIAN', blockIndex);
  appendFallingTitleLine(mondrianBlocks, 'BLOCKS', blockIndex);

  title.append(toyObjects, mondrianBlocks);
  return title;
}

function appendInstructionLines(container: HTMLElement, lines: readonly string[]): void {
  for (const html of lines) {
    const line = document.createElement('p');
    line.className = 'landing-instructions-line';
    line.innerHTML = html;
    container.appendChild(line);
  }
}

function createMobileTitle(lines: [string, string], modifierClass: string): HTMLDivElement {
  const title = document.createElement('div');
  title.className = `landing-title ${modifierClass}`;
  for (const line of lines) {
    const span = document.createElement('span');
    span.className = 'landing-title-line';
    span.textContent = line;
    title.appendChild(span);
  }
  return title;
}

export type LandingPageOptions = {
  /** Fired when PLAY is pressed — use to fade the game in under the landing exit. */
  onPlayPressed?: () => void;
};

export type LandingPage = {
  root: HTMLElement;
  waitUntilDismissed: () => Promise<void>;
};

export function createLandingPage(options: LandingPageOptions = {}): LandingPage {
  const root = document.createElement('div');
  root.className = 'landing';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Toy Mondrian — start screen');

  const logo = createBrandLogo();
  logo.classList.add('landing-animate-item', 'landing-animate-item--logo');

  const main = document.createElement('div');
  main.className = 'landing-main';

  const panel = document.createElement('div');
  panel.className = 'landing-panel';

  const colLeft = document.createElement('div');
  colLeft.className = 'landing-col-left';

  const toy = document.createElement('img');
  toy.className = 'landing-hero-toy landing-animate-item landing-animate-item--toy';
  toy.src = '/images/handheld-toy.png';
  toy.alt = 'Handheld Mondrian Blocks Toy';

  const titleMobileLeft = createMobileTitle(['TOY', 'OBJECTS'], 'landing-title--mobile-left');
  const titleMobileRight = createMobileTitle(['MONDRIAN', 'BLOCKS'], 'landing-title--mobile-right');

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'landing-play landing-animate-item landing-animate-item--play';
  playButton.textContent = 'PLAY';

  colLeft.append(toy, titleMobileLeft, titleMobileRight, playButton);

  const colRight = document.createElement('div');
  colRight.className = 'landing-col-right';

  const titleDesktop = createDesktopTitle();

  const instructionsDesktop = document.createElement('div');
  instructionsDesktop.className =
    'landing-instructions landing-instructions--desktop landing-animate-item landing-animate-item--instructions';
  appendInstructionLines(instructionsDesktop, [
    'USE ARROW <span aria-hidden="true">← →</span> KEYS TO MOVE',
    'USE UP ARROW <span aria-hidden="true">↑</span> KEY TO ROTATE',
    'DOWNLOAD ARTWORK AT END',
  ]);

  const instructionsMobile = document.createElement('div');
  instructionsMobile.className = 'landing-instructions landing-instructions--mobile';
  instructionsMobile.innerHTML = `
    <p>SWIPE LEFT <span aria-hidden="true">← →</span> RIGHT TO MOVE</p>
    <p>TAP TO ROTATE</p>
    <p>DOWNLOAD ARTWORK AT END</p>
  `;

  colRight.append(titleDesktop, instructionsDesktop, instructionsMobile);
  panel.append(colLeft, colRight);
  main.append(panel);

  const footer = document.createElement('footer');
  footer.className = 'landing-footer landing-animate-item landing-animate-item--footer';
  footer.innerHTML = `
    Crafted with <span class="landing-footer-heart" aria-hidden="true">♥️</span> by
    <a class="landing-footer-link landing-footer-link--amrit" href="https://amrit.art" target="_blank" rel="noopener noreferrer">Amrit</a>
    <span aria-hidden="true">&</span>
    <a class="landing-footer-link landing-footer-link--karan" href="https://karanwasabi.com" target="_blank" rel="noopener noreferrer">Karan</a>
  `;

  root.append(logo, main, footer);

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const finishLogoIntro = (): void => {
    if (root.classList.contains('landing--logo-intro-done')) {
      return;
    }
    root.classList.add('landing--logo-intro-done');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add('landing--logo-hover-ready');
      });
    });
  };

  const bindLogoIntroHandoff = (): void => {
    const mondrianImg = logo.querySelector('.brand-logo-img--mondrian');
    mondrianImg?.addEventListener(
      'animationend',
      (event: AnimationEvent) => {
        if (event.animationName === 'landing-logo-mondrian-in') {
          finishLogoIntro();
        }
      },
      { once: true }
    );
    window.setTimeout(finishLogoIntro, LOGO_INTRO_FALLBACK_MS);
  };

  if (!prefersReducedMotion && window.matchMedia('(min-width: 1281px)').matches) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add('landing--ready');
        bindLogoIntroHandoff();
      });
    });
  } else {
    root.classList.add('landing--ready', 'landing--logo-intro-done', 'landing--logo-hover-ready');
  }

  let dismissResolve: (() => void) | null = null;
  const dismissPromise = new Promise<void>((resolve) => {
    dismissResolve = resolve;
  });

  let finished = false;
  const finishDismiss = (): void => {
    if (finished) {
      return;
    }
    finished = true;
    root.remove();
    dismissResolve?.();
  };

  playButton.addEventListener('click', () => {
    if (root.classList.contains('landing--exiting')) {
      return;
    }
    playButton.disabled = true;
    options.onPlayPressed?.();
    root.classList.add('landing--exiting');

    if (prefersReducedMotion) {
      finishDismiss();
      return;
    }

    const onTransitionEnd = (event: TransitionEvent): void => {
      if (event.target !== root || event.propertyName !== 'opacity') {
        return;
      }
      root.removeEventListener('transitionend', onTransitionEnd);
      finishDismiss();
    };
    root.addEventListener('transitionend', onTransitionEnd);
    window.setTimeout(finishDismiss, FADE_MS + 80);
  });

  return {
    root,
    waitUntilDismissed: () => dismissPromise,
  };
}
