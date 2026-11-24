// Touch devices: tapping a work thumbnail first reveals its colour, then navigates after a short delay.
const DELAY_MS = 520;
const touchOnly = matchMedia('(hover: none)');

function clearActivated() {
  document.querySelectorAll('.work-card.is-activated').forEach((card) => card.classList.remove('is-activated'));
}

document.addEventListener('click', (event) => {
  if (!touchOnly.matches || event.defaultPrevented) return;
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const card = (event.target as Element | null)?.closest<HTMLAnchorElement>('a.work-card');
  if (!card) return;
  event.preventDefault();
  if (card.classList.contains('is-activated')) return;
  card.classList.add('is-activated');
  window.setTimeout(() => { window.location.href = card.href; }, DELAY_MS);
});
window.addEventListener('pageshow', clearActivated);
