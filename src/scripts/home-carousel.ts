import { updateHomeNavigationContrast } from './home-navigation-contrast';
import { setHomeCoverState } from './home-cover-state.js';

let rotationTimer: number | undefined;
let carouselAbort: AbortController | undefined;
const navObserver = new ResizeObserver(refreshNavigationContrast);

function refreshNavigationContrast() {
  const cover = document.querySelector<HTMLImageElement>('.home-layout .home-hero > img.is-visible');
  if (cover) updateHomeNavigationContrast(cover);
}

function setupHomeCarousel() {
  if (rotationTimer !== undefined) window.clearTimeout(rotationTimer);
  rotationTimer = undefined;
  carouselAbort?.abort();
  carouselAbort = new AbortController();
  const { signal } = carouselAbort;
  navObserver.disconnect();

  const hero = document.querySelector<HTMLElement>('.home-hero');
  const covers = [...(hero?.querySelectorAll<HTMLImageElement>('img') ?? [])];
  if (!hero || !covers.length) return;

  const dots = [...hero.querySelectorAll<HTMLButtonElement>('[data-home-cover-index]')];
  let current = Math.max(covers.findIndex((cover) => cover.classList.contains('is-visible')), 0);
  const randomInitial = hero.dataset.randomInitial === 'true';
  if (randomInitial) hero.dataset.homeInitializing = 'true';
  const showCover = (index: number) => {
    current = setHomeCoverState(covers, dots, current, index);
    refreshNavigationContrast();
  };
  hero.addEventListener('load', refreshNavigationContrast, { capture: true, signal });
  const navigation = document.querySelector('.home-layout .sidebar nav');
  if (navigation) navObserver.observe(navigation);
  showCover(randomInitial ? Math.floor(Math.random() * covers.length) : current);
  if (randomInitial) {
    hero.dataset.homeReady = 'true';
    hero.getBoundingClientRect();
    delete hero.dataset.homeInitializing;
  }
  if (covers.length < 2) return;
  const rotationSeconds = Number(hero.dataset.rotationSeconds) || 6;
  const scheduleRotation = () => {
    if (rotationTimer !== undefined) window.clearTimeout(rotationTimer);
    rotationTimer = window.setTimeout(() => {
      showCover(current + 1);
      scheduleRotation();
    }, rotationSeconds * 1000);
  };
  dots.forEach((dot, index) => dot.addEventListener('click', () => {
    showCover(index);
    scheduleRotation();
  }, { signal }));
  let touchStartX = 0;
  let touchStartY = 0;
  let trackingTouch = false;
  hero.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1 || (event.target as Element | null)?.closest('.home-carousel-controls')) {
      trackingTouch = false;
      return;
    }
    trackingTouch = true;
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }, { passive: true, signal });
  hero.addEventListener('touchend', (event) => {
    if (!trackingTouch || event.changedTouches.length !== 1) return;
    trackingTouch = false;
    const dx = event.changedTouches[0].clientX - touchStartX;
    const dy = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      showCover(dx < 0 ? current + 1 : current - 1);
      scheduleRotation();
    }
  }, { passive: true, signal });
  hero.addEventListener('touchcancel', () => { trackingTouch = false; }, { passive: true, signal });
  scheduleRotation();
}

setupHomeCarousel();
document.addEventListener('astro:after-swap', setupHomeCarousel);
window.addEventListener('resize', refreshNavigationContrast, { passive: true });
