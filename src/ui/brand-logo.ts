const AMRIT_ART_URL = 'https://amrit.art';

export function createBrandLogo(): HTMLAnchorElement {
  const logo = document.createElement('a');
  logo.className = 'brand-logo';
  logo.href = AMRIT_ART_URL;
  logo.target = '_blank';
  logo.rel = 'noopener noreferrer';
  logo.setAttribute('aria-label', 'Amrit — opens amrit.art in a new tab');

  const logoMondrian = document.createElement('img');
  logoMondrian.className = 'brand-logo-img brand-logo-img--mondrian';
  logoMondrian.src = '/images/mondrian-logo.svg';
  logoMondrian.alt = '';
  logoMondrian.setAttribute('aria-hidden', 'true');

  const logoAmrit = document.createElement('img');
  logoAmrit.className = 'brand-logo-img brand-logo-img--amrit';
  logoAmrit.src = '/images/amrit-logo.svg';
  logoAmrit.alt = '';
  logoAmrit.setAttribute('aria-hidden', 'true');

  logo.append(logoMondrian, logoAmrit);
  return logo;
}
