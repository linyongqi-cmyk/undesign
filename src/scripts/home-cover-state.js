/** @param {HTMLImageElement[]} covers @param {HTMLButtonElement[]} dots @param {number} current @param {number} next */
export function setHomeCoverState(covers, dots, current, next) {
  covers[current]?.classList.remove('is-visible');
  covers[current]?.setAttribute('aria-hidden', 'true');
  dots[current]?.removeAttribute('aria-current');
  const active = ((next % covers.length) + covers.length) % covers.length;
  covers[active]?.classList.add('is-visible');
  covers[active]?.removeAttribute('aria-hidden');
  dots[active]?.setAttribute('aria-current', 'true');
  return active;
}
