type AuthorId = 'amrit' | 'karan';

const AUTHOR_LINK_SELECTOR = {
  amrit: '.app-byline-link--amrit, .landing-footer-link--amrit',
  karan: '.app-byline-link--karan, .landing-footer-link--karan',
} as const;

const LOGO_SRC: Record<AuthorId, string> = {
  amrit: '/images/amrit-logo.svg',
  karan: '/images/karan-logo.png',
};

const DESKTOP_MEDIA = '(min-width: 769px) and (hover: hover)';

/** Logo box is 30×30px — centered directly above the cursor. */
const LOGO_SIZE_PX = 30;
const CURSOR_GAP_ABOVE_PX = 10;

function authorFromTarget(target: EventTarget | null): AuthorId | null {
  if (!(target instanceof Element)) {
    return null;
  }
  if (target.closest(AUTHOR_LINK_SELECTOR.amrit)) {
    return 'amrit';
  }
  if (target.closest(AUTHOR_LINK_SELECTOR.karan)) {
    return 'karan';
  }
  return null;
}

/** Desktop only — author logo follows the cursor while hovering Amrit / Karan links. */
export function setupBylineCursorLogo(): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const desktopQuery = window.matchMedia(DESKTOP_MEDIA);

  const follower = document.createElement('div');
  follower.className = 'byline-cursor-logo';
  follower.setAttribute('aria-hidden', 'true');

  const img = document.createElement('img');
  img.alt = '';
  follower.append(img);
  document.body.append(follower);

  let activeAuthor: AuthorId | null = null;
  let enabled = desktopQuery.matches;

  const setActiveAuthor = (author: AuthorId | null): void => {
    activeAuthor = author;
    if (!enabled || !author) {
      follower.classList.remove('byline-cursor-logo--visible');
      return;
    }
    img.src = LOGO_SRC[author];
    follower.classList.add('byline-cursor-logo--visible');
  };

  const onMouseMove = (event: MouseEvent): void => {
    if (!enabled || !activeAuthor) {
      return;
    }
    const x = event.clientX - LOGO_SIZE_PX / 2;
    const y = event.clientY - LOGO_SIZE_PX - CURSOR_GAP_ABOVE_PX;
    follower.style.transform = `translate(${x}px, ${y}px)`;
  };

  const onMouseOver = (event: MouseEvent): void => {
    if (!enabled) {
      return;
    }
    const author = authorFromTarget(event.target);
    if (author) {
      setActiveAuthor(author);
      onMouseMove(event);
    }
  };

  const onMouseOut = (event: MouseEvent): void => {
    if (!enabled) {
      return;
    }
    const fromAuthor = authorFromTarget(event.target);
    if (!fromAuthor) {
      return;
    }
    const toAuthor = authorFromTarget(event.relatedTarget);
    if (fromAuthor && fromAuthor !== toAuthor) {
      setActiveAuthor(toAuthor);
    }
  };

  const onMediaChange = (): void => {
    enabled = desktopQuery.matches;
    if (!enabled) {
      setActiveAuthor(null);
    }
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseover', onMouseOver);
  document.addEventListener('mouseout', onMouseOut);
  desktopQuery.addEventListener('change', onMediaChange);

  return () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseover', onMouseOver);
    document.removeEventListener('mouseout', onMouseOut);
    desktopQuery.removeEventListener('change', onMediaChange);
    follower.remove();
  };
}
