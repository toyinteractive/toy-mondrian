const FADE_MS = 500;

export type LandingPage = {
  root: HTMLElement;
  waitUntilDismissed: () => Promise<void>;
};

export function createLandingPage(): LandingPage {
  const root = document.createElement('div');
  root.className = 'landing';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'Toy Mondrian — start screen');

  const logo = document.createElement('div');
  logo.className = 'landing-logo';
  logo.tabIndex = 0;
  logo.setAttribute('aria-label', 'Mondrian logo — hover to reveal the ToyMaker');

  const logoMondrian = document.createElement('img');
  logoMondrian.className = 'landing-logo-img landing-logo-img--mondrian';
  logoMondrian.src = '/images/mondrian-logo.svg';
  logoMondrian.alt = '';
  logoMondrian.setAttribute('aria-hidden', 'true');

  const logoAmrit = document.createElement('img');
  logoAmrit.className = 'landing-logo-img landing-logo-img--amrit';
  logoAmrit.src = '/images/amrit-logo.svg';
  logoAmrit.alt = '';
  logoAmrit.setAttribute('aria-hidden', 'true');

  logo.append(logoMondrian, logoAmrit);

  const main = document.createElement('div');
  main.className = 'landing-main';

  const panel = document.createElement('div');
  panel.className = 'landing-panel';

  const hero = document.createElement('div');
  hero.className = 'landing-hero';

  const toy = document.createElement('img');
  toy.className = 'landing-hero-toy';
  toy.src = '/images/handheld-toy.png';
  toy.alt = 'Handheld Mondrian Blocks Toy';

  const titleDesktop = document.createElement('div');
  titleDesktop.className = 'landing-title landing-title--desktop';
  for (const line of ['TOY', 'OBJECTS', 'MONDRIAN', 'BLOCKS']) {
    const span = document.createElement('span');
    span.className = 'landing-title-line';
    span.textContent = line;
    titleDesktop.appendChild(span);
  }

  const titleMobileLeft = document.createElement('div');
  titleMobileLeft.className = 'landing-title landing-title--mobile-left';
  titleMobileLeft.textContent = 'TOY OBJECTS';

  const titleMobileRight = document.createElement('div');
  titleMobileRight.className = 'landing-title landing-title--mobile-right';
  titleMobileRight.textContent = 'MONDRIAN BLOCKS';

  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'landing-play';
  playButton.textContent = 'PLAY';

  hero.append(toy, titleDesktop, titleMobileLeft, titleMobileRight, playButton);

  const instructions = document.createElement('div');
  instructions.className = 'landing-instructions';
  instructions.innerHTML = `
    <p>USE ARROW <span aria-hidden="true">← →</span> KEYS TO MOVE</p>
    <p>USE UP ARROW <span aria-hidden="true">↑</span> KEY TO ROTATE</p>
    <p>DOWNLOAD ARTWORK AT END</p>
  `;

  panel.append(hero, instructions);
  main.append(panel);

  const footer = document.createElement('footer');
  footer.className = 'landing-footer';
  footer.innerHTML = `
    Crafted with <span class="landing-footer-heart" aria-hidden="true">♥️</span> by
    <a class="landing-footer-link landing-footer-link--amrit" href="https://amrit.art" target="_blank" rel="noopener noreferrer">Amrit</a>
    <span aria-hidden="true">&</span>
    <a class="landing-footer-link landing-footer-link--karan" href="https://karanwasabi.com" target="_blank" rel="noopener noreferrer">Karan</a>
  `;

  root.append(logo, main, footer);

  let dismissResolve: (() => void) | null = null;
  const dismissPromise = new Promise<void>((resolve) => {
    dismissResolve = resolve;
  });

  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
