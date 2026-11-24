function closeMobileNavigation() {
  const sidebar = document.querySelector<HTMLElement>('.sidebar');
  const toggle = document.querySelector<HTMLButtonElement>('.mobile-menu-toggle');
  sidebar?.classList.remove('is-open');
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.setAttribute('aria-label', 'Open menu');
}

function syncNavigationToUrl() {
  const brand = document.querySelector<HTMLAnchorElement>('.brand');
  const basePath = brand ? new URL(brand.href).pathname.replace(/\/$/, '') : '';
  const rawPath = window.location.pathname;
  const pathname = (basePath && rawPath.startsWith(`${basePath}/`) ? rawPath.slice(basePath.length) : rawPath).replace(/\/$/, '') || '/';
  const workMatch = pathname.match(/^\/works\/([^/]+)(?:\/[^/]+)?$/);
  const active = pathname === '/' ? 'home' : pathname === '/about' ? 'about' : pathname === '/contact' ? 'contact' : workMatch?.[1] || '';
  document.querySelectorAll<HTMLAnchorElement>('.sidebar nav > .nav-link').forEach((link) => {
    const linkPath = new URL(link.href).pathname;
    const href = (basePath && linkPath.startsWith(`${basePath}/`) ? linkPath.slice(basePath.length) : linkPath).replace(/\/$/, '') || '/';
    const section = href === '/' ? 'home' : href === '/about' ? 'about' : href === '/contact' ? 'contact' : '';
    link.classList.toggle('active', section !== '' && section === active);
  });
  const group = document.querySelector<HTMLElement>('.nav-group');
  const worksToggle = group?.querySelector<HTMLButtonElement>('.nav-works');
  const submenu = group?.querySelector<HTMLElement>('#works-submenu');
  const isWorks = Boolean(workMatch);
  group?.classList.toggle('active', isWorks);
  worksToggle?.setAttribute('aria-expanded', String(isWorks));
  submenu?.toggleAttribute('inert', !isWorks);
  submenu?.querySelectorAll<HTMLAnchorElement>('.nav-sublink').forEach((link) => {
    const linkPath = new URL(link.href).pathname;
    const relativePath = basePath && linkPath.startsWith(`${basePath}/`) ? linkPath.slice(basePath.length) : linkPath;
    const slug = relativePath.match(/^\/works\/([^/]+)\/?$/)?.[1];
    link.classList.toggle('active', Boolean(slug && slug === active));
  });
}

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const brandToggle = target.closest<HTMLAnchorElement>('.brand');
  if (brandToggle && document.querySelector('.home-hero') && window.matchMedia('(max-width: 1024px)').matches) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    document.querySelector<HTMLElement>('.sidebar')?.classList.toggle('is-open');
  }
}, true);

document.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const worksToggle = target.closest<HTMLButtonElement>('.nav-works');
  if (worksToggle) {
    const expanded = worksToggle.getAttribute('aria-expanded') === 'true';
    worksToggle.setAttribute('aria-expanded', String(!expanded));
    document.querySelector<HTMLElement>('#works-submenu')?.toggleAttribute('inert', expanded);
  }

  const menuToggle = target.closest<HTMLButtonElement>('.mobile-menu-toggle');
  if (menuToggle) {
    const open = document.querySelector<HTMLElement>('.sidebar')?.classList.toggle('is-open') ?? false;
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  if (target.closest('.sidebar a')) closeMobileNavigation();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMobileNavigation();
});

document.addEventListener('astro:after-swap', () => {
  closeMobileNavigation();
  syncNavigationToUrl();
});
