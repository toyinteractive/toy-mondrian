export function createBrandLogo(): HTMLDivElement {
  const logo = document.createElement('div');
  logo.className = 'brand-logo';
  logo.tabIndex = 0;
  logo.setAttribute('aria-label', 'Mondrian logo — hover to reveal the ToyMaker');

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
