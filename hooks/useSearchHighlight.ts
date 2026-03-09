/** Scroll to an element and flash it with a yellow highlight. */
export function flashElement(el: Element) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.remove('search-flash');
  void (el as HTMLElement).offsetWidth; // force reflow to restart animation
  el.classList.add('search-flash');
  setTimeout(() => el.classList.remove('search-flash'), 2200);
}
