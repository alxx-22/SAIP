import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Resets scroll position on navigation.
 *
 * Without this the browser keeps the previous page's scroll offset across a
 * client-side route change. On its own that's merely untidy — but combined with
 * the scroll-triggered reveals (`whileInView`), it made pages look BROKEN:
 * you'd arrive at Home already scrolled past the header, with the sections
 * above you still sitting at `opacity: 0` because their viewport trigger had
 * never fired. The page read as blank.
 *
 * Scrolling is instant rather than smooth — a route change is a new page, not
 * a movement within the current one, and animating it fights the page's own
 * entrance animation.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}
