// Small helper: adds classes to <html> or returns booleans for JS usage.
// This is optional — CSS media queries are usually enough.
export function isMobileViewport() {
  // mobile-ish threshold; prefer responsive breakpoints aligned with your CSS
  return window.matchMedia('(max-width: 767px)').matches;
}

export function watchViewportChange(callback) {
  const mq = window.matchMedia('(max-width: 767px)');
  const listener = (e) => callback(e.matches);
  if (mq.addEventListener) mq.addEventListener('change', listener);
  else mq.addListener(listener); // older browsers
  return () => {
    if (mq.removeEventListener) mq.removeEventListener('change', listener);
    else mq.removeListener(listener);
  };
}

// Example usage (in your app bootstrap):
// if (isMobileViewport()) document.documentElement.classList.add('is-mobile');
// const stopWatching = watchViewportChange((isMobile) => {
//   document.documentElement.classList.toggle('is-mobile', isMobile);
// });
