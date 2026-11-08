"use client";

import { useEffect } from "react";

/**
 * Scrolls to the URL fragment after a full page load.
 *
 * Pages with a loading state stream their content: the target element first
 * arrives inside a hidden container, so the browser's own fragment scroll
 * finds nothing to show and gives up. This retries until the element is
 * rendered, for up to eight seconds. In-app links are left to the router, and
 * any scroll, touch or key press by the reader cancels the retry.
 */
export default function HashScroll() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    let frame = 0;
    const deadline = performance.now() + 8000;
    const stop = () => cancelAnimationFrame(frame);
    const attempt = () => {
      const el = document.getElementById(id);
      if (el && el.getClientRects().length > 0) {
        el.scrollIntoView();
        return;
      }
      if (performance.now() < deadline) frame = requestAnimationFrame(attempt);
    };
    const events = ["wheel", "touchstart", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, stop, { once: true, passive: true }));
    attempt();
    return () => {
      stop();
      events.forEach((e) => window.removeEventListener(e, stop));
    };
  }, []);
  return null;
}
