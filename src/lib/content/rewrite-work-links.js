function rewriteWorkHref(href, category, previousSlug, nextCategory, nextSlug) {
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//')) return href;
  let parsed;
  try { parsed = new URL(href, 'https://portfolio.invalid'); } catch { return href; }
  const directPath = new RegExp(`^/works/${category}/${previousSlug}/?$`);
  const isResearchAnchor = category === 'research'
    && /^\/works\/research\/?$/.test(parsed.pathname)
    && parsed.hash === `#research-${previousSlug}`;
  if (!directPath.test(parsed.pathname) && !isResearchAnchor) return href;

  const pointsToWorkAnchor = !parsed.hash || parsed.hash === `#research-${previousSlug}`;
  if (nextCategory === 'research') {
    parsed.pathname = '/works/research/';
    if (pointsToWorkAnchor) parsed.hash = `#research-${nextSlug}`;
  } else {
    parsed.pathname = `/works/${nextCategory}/${nextSlug}/`;
    if (parsed.hash === `#research-${previousSlug}`) parsed.hash = '';
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function hasWorkLink(value, category, slug) {
  if (!value || typeof value !== 'object') return false;
  if ((value.kind === 'internalLink' && value.category === category && value.workSlug === slug)
    || (value.type === 'InternalLinkBlock' && value.props?.category === category && value.props.workSlug === slug)) return true;
  const href = value.kind === 'link' ? value.linkHref : value.type === 'LinkBlock' ? value.props?.linkHref : undefined;
  if (typeof href === 'string' && href.startsWith('/') && !href.startsWith('//')) {
    try {
      const parsed = new URL(href, 'https://portfolio.invalid');
      if (new RegExp(`^/works/${category}/${slug}/?$`).test(parsed.pathname)) return true;
      if (category === 'research' && /^\/works\/research\/?$/.test(parsed.pathname) && parsed.hash === `#research-${slug}`) return true;
    } catch {}
  }
  return Object.values(value).some((child) => hasWorkLink(child, category, slug));
}

export function rewriteWorkLinks(value, category, previousSlug, nextSlug, nextCategory = category) {
  if (!value || typeof value !== 'object') return false;
  let changed = false;
  if (value.kind === 'internalLink' && value.category === category && value.workSlug === previousSlug) {
    value.category = nextCategory;
    value.workSlug = nextSlug;
    changed = true;
  }
  if (value.type === 'InternalLinkBlock' && value.props?.category === category && value.props.workSlug === previousSlug) {
    value.props.category = nextCategory;
    value.props.workSlug = nextSlug;
    changed = true;
  }
  if (value.kind === 'link' && typeof value.linkHref === 'string') {
    const nextHref = rewriteWorkHref(value.linkHref, category, previousSlug, nextCategory, nextSlug);
    if (nextHref !== value.linkHref) {
      value.linkHref = nextHref;
      changed = true;
    }
  }
  if (value.type === 'LinkBlock' && typeof value.props?.linkHref === 'string') {
    const nextHref = rewriteWorkHref(value.props.linkHref, category, previousSlug, nextCategory, nextSlug);
    if (nextHref !== value.props.linkHref) {
      value.props.linkHref = nextHref;
      changed = true;
    }
  }
  for (const child of Object.values(value)) {
    if (rewriteWorkLinks(child, category, previousSlug, nextSlug, nextCategory)) changed = true;
  }
  return changed;
}
