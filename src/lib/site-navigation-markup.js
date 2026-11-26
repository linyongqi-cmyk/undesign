function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

/** @param {{base?: string, routeBase?: string, active?: string, sections?: import('./content/types').Category[], expanded?: boolean, showAdminEntry?: boolean}} options */
export function renderSiteNavigation({
  base = '/',
  routeBase = base,
  active = 'home',
  sections = [],
  expanded = false,
  showAdminEntry = false,
} = {}) {
  const isWorks = sections.some((section) => section.slug === active);
  const worksExpanded = expanded || isWorks;
  const sectionLinks = sections.map((section) => (
    `<a class="nav-sublink${active === section.slug ? ' active' : ''}" href="${escapeHtml(`${routeBase}works/${section.slug}/`)}">${escapeHtml(section.title)}</a>`
  )).join('');

  return `<a class="brand" href="${escapeHtml(active === 'home' && routeBase !== base ? `${routeBase}home` : base)}" aria-label="Lin Yongqi home" translate="no"><img class="brand-logo" src="${escapeHtml(`${base}images/brand/logo.svg`)}" alt="" width="196" height="87" /></a>
    <nav aria-label="Main navigation">
      <a class="nav-link${active === 'home' ? ' active' : ''}" href="${escapeHtml(active === 'home' && routeBase !== base ? `${routeBase}home` : base)}">HOME</a>
      <a class="nav-link${active === 'about' ? ' active' : ''}" href="${escapeHtml(`${routeBase}about/`)}">ABOUT</a>
      <div class="nav-group${isWorks ? ' active' : ''}">
        <button class="nav-link nav-works" type="button" aria-expanded="${worksExpanded}" aria-controls="works-submenu">WORKS</button>
        <div class="nav-submenu-reveal" id="works-submenu"${worksExpanded ? '' : ' inert'}>
          <div class="nav-submenu">${sectionLinks}</div>
        </div>
      </div>
      <a class="nav-link${active === 'contact' ? ' active' : ''}" href="${escapeHtml(`${routeBase}contact/`)}">CONTACT</a>
    </nav>
    ${showAdminEntry ? '<a class="admin-entry" href="/admin/" target="_blank" rel="noreferrer">管理内容 ↗</a>' : ''}`;
}
