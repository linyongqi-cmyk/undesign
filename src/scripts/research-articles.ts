let scrollFrame = 0;
const transitionDuration = 560;
const articleAnimations = new WeakMap<HTMLDetailsElement, Animation>();

function animateArticle(article: HTMLDetailsElement, opening: boolean) {
  const reveal = article.querySelector<HTMLElement>('.research-reveal');
  const previous = articleAnimations.get(article);

  if (!reveal || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    previous?.cancel();
    article.open = opening;
    article.removeAttribute('data-transitioning');
    articleAnimations.delete(article);
    return;
  }

  const bounds = reveal.getBoundingClientRect();
  const startHeight = article.open ? bounds.height : 0;
  previous?.cancel();
  article.open = true;
  const openBounds = reveal.getBoundingClientRect();
  // Finish the animated reveal below the viewport even if the title scrolls
  // down from above it. The rest can then enter the layout without a visible jump.
  const revealLimit = window.innerHeight + Math.max(0, -openBounds.top);
  const animatedHeight = opening
    ? Math.min(openBounds.height, Math.max(startHeight, revealLimit))
    : openBounds.height;
  const endHeight = opening ? animatedHeight : 0;

  article.dataset.transitioning = opening ? 'opening' : 'closing';
  const duration = animatedHeight
    ? transitionDuration * Math.min(1, Math.abs(endHeight - startHeight) / animatedHeight)
    : 0;
  const animation = reveal.animate(
    [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
    { duration, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' },
  );

  articleAnimations.set(article, animation);
  animation.onfinish = () => {
    if (articleAnimations.get(article) !== animation) return;
    article.open = opening;
    article.removeAttribute('data-transitioning');
    animation.cancel();
    articleAnimations.delete(article);
  };
}

function closeArticle(article: HTMLDetailsElement) {
  if (article.open && article.dataset.transitioning !== 'closing') animateArticle(article, false);
}

function openArticle(article: HTMLDetailsElement) {
  const list = article.closest<HTMLElement>('.research-list');
  if (!list) return;
  list.querySelectorAll<HTMLDetailsElement>('.research-item[open]').forEach((other) => {
    if (other !== article) closeArticle(other);
  });
  if (!article.open || article.dataset.transitioning === 'closing') animateArticle(article, true);

  scrollToArticle(article, list);
}

function scrollToArticle(article: HTMLDetailsElement, list: HTMLElement) {
  cancelAnimationFrame(scrollFrame);
  const offset = parseFloat(getComputedStyle(article).scrollMarginTop);
  const main = list.closest('main');
  const mainBottomPadding = main ? parseFloat(getComputedStyle(main).paddingBottom) : 0;
  const startTop = article.getBoundingClientRect().top;
  const startTime = performance.now();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let bottomPadding = parseFloat(list.style.paddingBottom) || 0;

  function alignArticle(now: number) {
    if (!article.isConnected || !article.open) return;

    // Closing the previous article can move this title on every frame.
    const articleTop = article.getBoundingClientRect().top;
    const progress = reducedMotion ? 1 : Math.min(1, Math.max(0, (now - startTime) / transitionDuration));
    const easedProgress = 1 - (1 - progress) ** 3;
    const desiredTop = startTop + (offset - startTop) * easedProgress;
    const scrollTop = window.scrollY + articleTop - desiredTop;
    const contentBelowTitle = list.getBoundingClientRect().bottom - articleTop - bottomPadding;
    const neededPadding = Math.max(0, Math.ceil(
      window.innerHeight - offset - contentBelowTitle - mainBottomPadding,
    ));
    if (neededPadding !== bottomPadding) {
      list.style.paddingBottom = neededPadding ? `${neededPadding}px` : '';
      bottomPadding = neededPadding;
    }

    window.scrollTo({ top: scrollTop, behavior: 'instant' });
    // Keep tracking until the browser has applied the final accordion layout.
    if (progress < 1 || list.querySelector('.research-item[data-transitioning]')) {
      scrollFrame = requestAnimationFrame(alignArticle);
    }
  }

  scrollFrame = requestAnimationFrame(alignArticle);
}

function openLinkedArticle() {
  const hash = window.location.hash;
  if (!hash.startsWith('#research-')) return;
  const article = [...document.querySelectorAll<HTMLDetailsElement>('.research-item')]
    .find((item) => item.dataset.researchId === hash.slice(1));
  if (article && !article.open) openArticle(article);
}

document.addEventListener('astro:before-swap', () => {
  cancelAnimationFrame(scrollFrame);
});
document.addEventListener('astro:after-swap', openLinkedArticle);
document.addEventListener('astro:page-load', openLinkedArticle);
window.addEventListener('hashchange', openLinkedArticle);
document.addEventListener('click', (event) => {
  const summary = (event.target as Element).closest('.research-item > summary');
  const article = summary?.parentElement;
  if (!(article instanceof HTMLDetailsElement)) return;
  event.preventDefault();
  if (article.open && article.dataset.transitioning !== 'closing') {
    closeArticle(article);
    cancelAnimationFrame(scrollFrame);
    return;
  }
  openArticle(article);
});
