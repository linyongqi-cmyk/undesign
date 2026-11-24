type CarouselInstance = {
  root: HTMLElement;
  previous: HTMLButtonElement;
  next: HTMLButtonElement;
  cleanup: () => void;
};

let instances: CarouselInstance[] = [];

function clearCarousels() {
  instances.forEach((instance) => instance.cleanup());
  instances = [];
}

function setupCarousels() {
  clearCarousels();
  document.querySelectorAll<HTMLElement>('[data-image-carousel]').forEach((root) => {
    const slides = [...root.querySelectorAll<HTMLElement>('.detail-image-carousel-slide')];
    const previous = root.querySelector<HTMLButtonElement>('[data-carousel-previous]');
    const next = root.querySelector<HTMLButtonElement>('[data-carousel-next]');
    if (slides.length < 2 || !previous || !next) return;

    const dots = [...root.querySelectorAll<HTMLElement>('.detail-image-carousel-dots > span')];
    let current = Math.max(slides.findIndex((slide) => slide.classList.contains('is-active')), 0);
    let timer: number | undefined;
    let hovering = matchMedia('(hover: hover)').matches && root.matches(':hover');
    const showSlide = (requested: number) => {
      slides[current]?.classList.remove('is-active');
      slides[current]?.setAttribute('aria-hidden', 'true');
      current = (requested + slides.length) % slides.length;
      slides[current]?.classList.add('is-active');
      slides[current]?.setAttribute('aria-hidden', 'false');
      dots.forEach((dot, dotIndex) => dotIndex === current ? dot.setAttribute('aria-current', 'true') : dot.removeAttribute('aria-current'));
    };
    const stopRotation = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    };
    const scheduleRotation = () => {
      stopRotation();
      if (hovering) return;
      const seconds = Number(root.dataset.rotationSeconds) || 6;
      timer = window.setTimeout(() => {
        showSlide(current + 1);
        scheduleRotation();
      }, seconds * 1000);
    };
    const changeSlide = (requested: number) => {
      showSlide(requested);
      scheduleRotation();
    };
    const onPrevious = () => changeSlide(current - 1);
    const onNext = () => changeSlide(current + 1);
    const onEnter = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      hovering = true;
      stopRotation();
    };
    const onLeave = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      hovering = false;
      scheduleRotation();
    };
    root.addEventListener('pointerenter', onEnter);
    root.addEventListener('pointerleave', onLeave);
    previous.addEventListener('click', onPrevious);
    next.addEventListener('click', onNext);
    scheduleRotation();
    instances.push({ root, previous, next, cleanup: () => {
      stopRotation();
      root.removeEventListener('pointerenter', onEnter);
      root.removeEventListener('pointerleave', onLeave);
      previous.removeEventListener('click', onPrevious);
      next.removeEventListener('click', onNext);
    } });
  });
}

setupCarousels();
document.addEventListener('astro:before-swap', clearCarousels);
document.addEventListener('astro:after-swap', setupCarousels);
